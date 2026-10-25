# ms-auth T5 — Documento de Arquitectura

> **Tratamiento:** T5 — **OAuth 2.0 (self-hosted) + RBAC**
> **Propósito:** Microservicio de autenticación y autorización para el tratamiento T5 del experimento de tesis. Introduce OAuth 2.0 Client Credentials flow implementado **sin servidor de autorización externo** (sin Keycloak, sin Auth0): el propio `ms-auth` actúa como Authorization Server simplificado. El cliente intercambia `client_id + client_secret` por un Access Token opaco (token de referencia almacenado en BD), y `ms-data` valida ese token en cada solicitud (`POST /auth/validate`). La autorización usa **RBAC puro**: solo evalúa el rol del usuario, sin verificar la propiedad del recurso, por lo que es **vulnerable a BOLA (API1:2023)**.

---

## 1. Contexto del Experimento

| Campo | Valor |
|---|---|
| Tratamiento | T5 |
| Mecanismo de autenticación | OAuth 2.0 Client Credentials — Access Token opaco (token de referencia, BD) |
| Mecanismo de autorización | RBAC puro (verifica solo el rol, **no** `resourceOwnerId`) |
| Vector de vulnerabilidad | **BOLA activo (API1:2023)** — `RbacGuard` no verifica propiedad del objeto |
| Authorization Server | Self-hosted en `ms-auth` — sin dependencias externas |
| Directorio del código | `experiment/T5/` |

---

## 2. Decisión de Diseño: OAuth 2.0 Self-Hosted sin servidor externo

El flujo OAuth 2.0 estándar requiere un Authorization Server (AS). En este tratamiento el AS **está embebido en `ms-auth`** para mantener la independencia del experimento. El diseño sigue el estándar RFC 6749 (Client Credentials Grant) en los aspectos clave:

- El cliente se autentica con `client_id + client_secret` (equivalente a las API Keys de T1/T2).
- `ms-auth` emite un **Access Token opaco** (string aleatorio, almacenado hasheado en BD con TTL).
- `ms-data` presenta el Access Token en cada request y `ms-auth` lo valida mediante **token introspection** (`POST /auth/validate`).
- El Access Token **no es un JWT** — es un token de referencia que requiere consulta a BD para validarse (a diferencia de T3/T4 que usan JWT autocontenido).

> **Diferencia con T3/T4:** Los JWT son stateless y se validan sin BD. Los Access Tokens opacos de T5 son stateful — cada validación consulta la tabla `oauth_tokens`. Esto permite revocación inmediata (a diferencia de T3 sin blacklist), aunque T5 no implementa revocación activa en su seed de experimento.

---

## 3. Stack Tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Runtime | Node.js | >= 18 |
| Framework | NestJS | ^10 |
| Lenguaje | TypeScript | ^5.1 |
| API | REST (Express) | — |
| ORM | TypeORM | ^0.3 |
| Base de datos | PostgreSQL | 14+ |
| Generación de tokens | Node.js `crypto` (`randomBytes` + SHA-256) | nativo |
| Package manager | pnpm | workspace |

---

## 4. Variables de Entorno (`.env`)

```env
PORT=3105                                     # Puerto en que escucha el servicio
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=123
DB_DATABASE=olist_ecommerce                   # Base de datos PostgreSQL
OAUTH_SECRET=my-super-secret-key-for-oauth    # Usado para firmar/verificar client_secret (HMAC)
JWT_SECRET=my-super-secret-key-for-jwt        # Reservado (no usado en T5)
TOKEN_TTL_SECONDS=900                         # TTL del Access Token: 15 minutos (= T3/T4)
```

> `JWT_SECRET` está presente para mantener paridad de entorno con los demás tratamientos pero **no es consumido en T5**. `OAUTH_SECRET` se usa como sal adicional en el hash del `client_secret`.

---

## 5. Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/auth/token` | OAuth 2.0 Token Endpoint — emite un Access Token opaco |
| `POST` | `/auth/validate` | Token Introspection — valida Access Token y aplica RBAC |

---

### 5.1. `POST /auth/token` — OAuth 2.0 Token Endpoint

Implementa **Client Credentials Grant** (RFC 6749 §4.4). Usado **exclusivamente por el cliente de prueba** (script del experimento) para obtener un Access Token antes de llamar a `ms-data`.

#### Request Body

```typescript
// Acepta application/json o application/x-www-form-urlencoded (estándar OAuth 2.0)
{
  grant_type: "client_credentials";  // único grant type soportado
  client_id: string;                 // username del usuario registrado en seed
  client_secret: string;             // secret en texto plano (equivalente a API Key)
  scope?: string;                    // Reservado — ignorado en T5
}
```

#### Response Body (éxito — RFC 6749 §5.1)

```json
{
  "access_token": "<token-opaco-32-bytes-hex>",
  "token_type": "Bearer",
  "expires_in": 900
}
```

#### Response Body (error — RFC 6749 §5.2)

```json
{
  "error": "invalid_client",
  "error_description": "Invalid client credentials"
}
```

#### Lógica interna de `/auth/token`

1. Valida que `grant_type === "client_credentials"`.
2. Busca el usuario por `client_id` (= `username`) en tabla `oauth_clients`.
3. Verifica `client_secret`: calcula `SHA-256(client_secret + OAUTH_SECRET)` y compara con `client_secret_hash` almacenado.
4. Si el cliente está inactivo (`is_active=false`) → `{"error": "invalid_client"}`.
5. Genera un Access Token opaco: `token = crypto.randomBytes(32).toString('hex')` (64 chars hex).
6. Calcula `token_hash = SHA-256(token)` y almacena en tabla `oauth_tokens` con `expires_at = now + TOKEN_TTL_SECONDS`.
7. Retorna el token en texto plano (nunca se vuelve a almacenar en claro).

---

### 5.2. `POST /auth/validate` — Token Introspection

Usado **exclusivamente por `ms-data`** en cada solicitud GraphQL. Corresponde al endpoint de introspección de token (RFC 7662 simplificado).

#### Request Body

```typescript
// ValidateRequestDto — idéntico a T1/T2/T3/T4 para compatibilidad con ms-data
{
  credential: string;        // Access Token en texto plano (sin prefijo "Bearer ")
  action?: string;           // "query" | "mutation"
  resource?: string;         // "Order" | "Product" | "Customer" | "Seller"
  resourceOwnerId?: string;  // customer_id / seller_id — enviado por ms-data, IGNORADO en T5 (RBAC puro)
  graphqlOperation?: string; // Reservado, no usado actualmente
}
```

#### Response Body

```typescript
// ValidateResponseDto — idéntico a T1/T2/T3/T4
{
  isValid: boolean;
  payload?: AuthPayload;  // Solo presente si isValid = true
  error?: string;         // Solo presente si isValid = false
}

// AuthPayload (cuando isValid = true)
{
  isValid: true;
  user_id: string;         // UUID interno del usuario
  role: string;            // "admin" | "seller" | "customer"
  customer_id?: string;    // customer_id del dataset Olist (si aplica)
  seller_id?: string;      // seller_id del dataset Olist (si aplica)
  token_id: string;        // UUID del registro en oauth_tokens
}
```

#### Ejemplos

**Request:**
```http
POST http://localhost:3105/auth/validate
Content-Type: application/json

{
  "credential": "<access-token-opaco>",
  "action": "query",
  "resource": "Order",
  "resourceOwnerId": "9ef432eb6251297304e76186b10a928d"
}
```

**Response exitosa:**
```json
{
  "isValid": true,
  "payload": {
    "isValid": true,
    "user_id": "<uuid>",
    "role": "customer",
    "customer_id": "9ef432eb6251297304e76186b10a928d",
    "token_id": "<uuid>"
  }
}
```

**Response fallida (token inválido):**
```json
{
  "isValid": false,
  "error": "Invalid Access Token"
}
```

**Response fallida (token expirado):**
```json
{
  "isValid": false,
  "error": "Access Token expired"
}
```

**Response fallida (RBAC):**
```json
{
  "isValid": false,
  "error": "RBAC: Sellers cannot create or modify Orders directly"
}
```

---

## 6. Flujo Interno de Validación (`/auth/validate`)

```
ms-data -> POST /auth/validate
              |
              v
        AuthController
              |
              |--- PASO 1: OAuthTokenStrategy.validate(credential)
              |         |
              |         |  token_hash = SHA-256(credential)
              |         |  busca en tabla oauth_tokens por token_hash
              |         |
              |         |-- Hash no encontrado  -> { isValid: false, error: "Invalid Access Token" }
              |         |-- expires_at < now()  -> { isValid: false, error: "Access Token expired" }
              |         |-- is_revoked = true   -> { isValid: false, error: "Access Token revoked" }
              |         `-- OK                  -> { isValid: true, user_id, role, customer_id, seller_id, token_id }
              |
              |--- (si isValid=false) -> return { isValid: false, error }
              |
              `--- PASO 2: RbacGuard.canActivate(mockContext)
                        |
                        |  Evalúa SOLO: role x resource x action
                        |  ADVERTENCIA: resourceOwnerId recibido pero NUNCA evaluado
                        |
                        |-- role = "admin"    -> ALLOW (acceso total)
                        |-- role = "seller"   -> ver tabla de permisos RBAC
                        |-- role = "customer" -> ver tabla de permisos RBAC
                        `-- role desconocido  -> ForbiddenException
```

---

## 7. Tabla de Permisos RBAC

> **ADVERTENCIA - Vector BOLA:** Al igual que T1 y T3, el `RbacGuard` de T5 **nunca evalúa `resourceOwnerId`**. Un customer autenticado puede acceder a los pedidos de cualquier otro customer si conoce el `order_id`.

| Rol | Resource | Action | `resourceOwnerId` | Resultado |
|---|---|---|---|---|
| `admin` | cualquiera | cualquiera | cualquiera | OK Permitido |
| `seller` | `Product` | `query` | cualquiera | OK Permitido |
| `seller` | `Product` | `mutation` | cualquiera | OK Permitido |
| `seller` | `Order` | `query` | cualquiera | OK Permitido (**sin verificar propiedad**) |
| `seller` | `Order` | `mutation` | cualquiera | ERROR `RBAC: Sellers cannot create or modify Orders directly` |
| `seller` | otros | cualquiera | cualquiera | ERROR `RBAC: Sellers cannot access resource '<res>'` |
| `customer` | `Order` | `query` | cualquiera | OK Permitido (**BOLA — sin verificar propiedad**) |
| `customer` | `Order` | `mutation` | cualquiera | OK Permitido (**BOLA — sin verificar propiedad**) |
| `customer` | `Product` | `query` | cualquiera | OK Permitido |
| `customer` | `Seller` | `query` | cualquiera | OK Permitido |
| `customer` | `Product` | `mutation` | cualquiera | ERROR `RBAC: Customers cannot modify 'Product'` |
| `customer` | `Seller` | `mutation` | cualquiera | ERROR `RBAC: Customers cannot modify 'Seller'` |
| `customer` | `Customer` | cualquiera | cualquiera | ERROR `RBAC: Customers cannot access Customer records` |

---

## 8. Ataques Cubiertos por el Experimento

| Código | Descripción | Dónde se maneja | Resultado en T5 |
|---|---|---|---|
| BA-01 | Token expirado (TTL 15 min) | `OAuthTokenStrategy` — `expires_at < now()` | BLOQUEADO `"Access Token expired"` -> `401` en ms-data |
| BA-02 | Token inválido / falsificado | `OAuthTokenStrategy` — hash no encontrado en BD | BLOQUEADO `"Invalid Access Token"` -> `401` en ms-data |
| BA-03 | Token revocado (`is_revoked=true`) | `OAuthTokenStrategy` — flag en BD | BLOQUEADO `"Access Token revoked"` -> `401` en ms-data |
| BA-04 | Manipulación del token (alterar contenido) | Token opaco no contiene claims — cualquier alteración invalida el hash | BLOQUEADO `"Invalid Access Token"` |
| BOLA | Acceso a recurso de otro usuario | **No mitigado — RBAC no verifica `resourceOwnerId`** | VULNERABLE Acceso permitido |

> **Ventaja sobre T3:** T5 soporta revocación inmediata (BA-03) marcando `is_revoked=true` en la BD. T3 (JWT) no puede revocar tokens hasta que expiren naturalmente.

---

## 9. Escenarios de Error y Códigos HTTP

| Escenario | Error retornado | HTTP en ms-data |
|---|---|---|
| Credencial ausente en ms-data | — (previo al llamado) | `401` |
| Token no registrado / falsificado | `"Invalid Access Token"` | `401` |
| Token expirado | `"Access Token expired"` | `401` |
| Token revocado | `"Access Token revoked"` | `401` |
| Acción prohibida por RBAC (rol) | mensaje `"RBAC: ..."` | `403` |
| ms-auth no disponible | `"Auth service unavailable"` | `401` |

> **Interpretación del error por ms-data:** si `error` contiene `"rbac"` o `"forbidden"` -> ms-data responde `403`; cualquier otro error -> ms-data responde `401`.

---

## 10. Flujo del Cliente (Experimento)

```
Script de prueba
      |
      |--- 1. POST /auth/token  { grant_type: "client_credentials", client_id, client_secret }
      |                |
      |          { access_token, token_type: "Bearer", expires_in: 900 }
      |
      `--- 2. Adjunta Access Token como Bearer token en cada request a ms-data
                       |
               ms-data extrae el token del header Authorization: Bearer <token>
                       |
               ms-data -> POST /auth/validate { credential: token, action, resource, resourceOwnerId }
                       |
               ms-auth calcula SHA-256(token), busca en oauth_tokens + aplica RBAC
                       -> { isValid, payload | error }
```

---

## 11. Modelo de Datos

### `OAuthClient` -> tabla `oauth_clients` (`synchronize: false`)

Equivalente a la tabla `users` de T1-T4, con la semántica OAuth 2.0 de "client".

| Campo | Tipo | Descripción |
|---|---|---|
| `client_id` | `uuid` PK | Generado automáticamente (UUID) |
| `client_name` | `varchar` unique | Identificador legible (= `username` en otros tratamientos) |
| `client_secret_hash` | `varchar` | SHA-256(`client_secret` + `OAUTH_SECRET`) |
| `role` | `varchar` | `"admin"` \| `"seller"` \| `"customer"` |
| `seller_id` | `varchar` nullable | FK lógica a `sellers.seller_id` del dataset Olist |
| `customer_id` | `varchar` nullable | FK lógica a `customers.customer_id` del dataset Olist |
| `is_active` | `boolean` default `true` | `false` = cliente deshabilitado |
| `created_at` | `timestamp` | Auto-generado |

### `OAuthToken` -> tabla `oauth_tokens` (`synchronize: false`)

Almacena los Access Tokens emitidos (como hashes SHA-256).

| Campo | Tipo | Descripción |
|---|---|---|
| `token_id` | `uuid` PK | Generado automáticamente |
| `token_hash` | `varchar` unique | SHA-256 del Access Token real (nunca se almacena el token en claro) |
| `client_id` | `uuid` | FK -> `oauth_clients.client_id` |
| `is_revoked` | `boolean` default `false` | `true` = token revocado |
| `created_at` | `timestamp` | Auto-generado |
| `expires_at` | `timestamp` | `created_at + TOKEN_TTL_SECONDS` |

> `synchronize: false` — Las tablas deben existir previamente. Se crean mediante el SeedService que ejecuta DDL raw o TypeORM migrations fuera del ciclo de vida de la app.

---

## 12. Datos de Seed (SeedService)

El `SeedService` se ejecuta en `OnApplicationBootstrap` y solo inserta datos si `oauth_clients` está vacía.

### Clientes OAuth registrados (API Keys -> client_secrets)

| client_name | Rol | customer_id (Olist) | seller_id (Olist) | client_secret (texto plano) |
|---|---|---|---|---|
| `admin` | `admin` | — | — | `tesis-admin-key-2026` |
| `seller01` | `seller` | — | `3442f8959a84dea7ee197c632cb2df15` | `tesis-seller01-key-2026` |
| `customer01` | `customer` | `9ef432eb6251297304e76186b10a928d` | — | `tesis-customer01-key-2026` |
| `customer02` | `customer` | `ed0271e0b7da060a393796590e7b737a` | — | `tesis-customer02-key-2026` |
| `customer03` | `customer` | `8886130db0ea6e9e70ba0b03d7c0d286` | — | `tesis-customer03-key-2026` |
| `customer04` | `customer` | `6d6b50b66d79f80827b6d96751528d30` | — | `tesis-customer04-key-2026` |
| `customer05` | `customer` | `65a227fbf7d798cdeadee8c0bea74993` | — | `tesis-customer05-key-2026` |

> Los `client_secret` en texto plano son idénticos a las API Keys de T1/T2/T3 para mantener paridad en el script de experimento. El seed los hashea con `SHA-256(secret + OAUTH_SECRET)` al insertar.

### Clientes con secret expirado (`is_active=true` pero se simulará expiración a nivel de token)

La expiración en T5 opera a nivel de **Access Token** (tabla `oauth_tokens.expires_at`), no a nivel de client_secret. Para simular el escenario BA-01 (token expirado), el script de experimento usará un token emitido anteriormente cuyo `expires_at` ya pasó. El SeedService puede pre-insertar tokens expirados para estos customers:

| customer | token pre-insertado (expirado) |
|---|---|
| `customer01` | token hash con `expires_at = 2026-06-01` |
| `customer02` | token hash con `expires_at = 2026-06-01` |
| `customer03` | token hash con `expires_at = 2026-07-01` |
| `customer04` | token hash con `expires_at = 2026-07-01` |
| `customer05` | token hash con `expires_at = 2026-07-01` |

### Tokens pre-revocados (`is_revoked=true`) — Escenario BA-03

| customer | Descripción |
|---|---|
| `customer01` | token pre-insertado con `is_revoked=true` |
| `customer02` | token pre-insertado con `is_revoked=true` |
| `customer03` | token pre-insertado con `is_revoked=true` |
| `customer04` | token pre-insertado con `is_revoked=true` |
| `customer05` | token pre-insertado con `is_revoked=true` |

---

## 13. Estructura de Directorios

```
T5/
|-- .env                              # Variables de entorno
|-- nest-cli.json
|-- package.json                      # Nombre: "ms-auth" | pnpm
|-- tsconfig.json
`-- src/
    |-- main.ts                       # Bootstrap — escucha en PORT (default 3105)
    |-- app.module.ts                 # Módulo raíz: TypeORM, strategy, guard, seed
    |-- auth-core/
    |   |-- auth.controller.ts        # POST /auth/token + POST /auth/validate
    |   |-- index.ts                  # Barrel exports
    |   |-- entities/
    |   |   |-- oauth-client.entity.ts   # Tabla oauth_clients
    |   |   `-- oauth-token.entity.ts    # Tabla oauth_tokens
    |   |-- strategies/
    |   |   `-- oauth-token.strategy.ts  # Introspección: SHA-256 lookup en oauth_tokens
    |   |-- guards/
    |   |   `-- rbac.guard.ts            # Autoriza: role x resource x action (sin ownership check)
    |   `-- seeds/
    |       `-- seed.service.ts          # Inserta clientes + tokens pre-expirados/revocados
    `-- shared/
        |-- index.ts                  # Barrel exports
        |-- auth/
        |   |-- auth-payload.type.ts          # Tipo AuthPayload
        |   `-- auth-strategy.interface.ts    # Interface IAuthStrategy
        `-- dtos/
            |-- validate-request.dto.ts       # DTO de entrada (idéntico a T1-T4)
            `-- validate-response.dto.ts      # DTO de salida (idéntico a T1-T4)
```

---

## 14. Módulos NestJS

```
AppModule
|-- ConfigModule (global)
|-- TypeOrmModule (PostgreSQL, synchronize: false)
|   `-- forFeature([OAuthClient, OAuthToken])
|-- AuthController  (POST /auth/token + POST /auth/validate)
|-- OAuthTokenStrategy  (token: 'IAuthStrategy')
|-- RbacGuard           (token: 'IAuthGuard')
`-- SeedService         (OnApplicationBootstrap)
```

---

## 15. Componentes Clave a Implementar

### `auth.controller.ts` — Dos endpoints

```typescript
@Controller('auth')
export class AuthController {
  // POST /auth/token — OAuth 2.0 Client Credentials Grant
  @Post('token')
  async issueToken(@Body() body: { grant_type: string; client_id: string; client_secret: string })
    : Promise<{ access_token: string; token_type: string; expires_in: number }>

  // POST /auth/validate — Token Introspection + RBAC
  @Post('validate')
  async validate(@Body() request: ValidateRequestDto): Promise<ValidateResponseDto>
}
```

### `oauth-token.strategy.ts` — Estrategia de introspección

```typescript
@Injectable()
export class OAuthTokenStrategy implements IAuthStrategy {
  async validate(credential: string): Promise<AuthPayload> {
    // 1. Calcular SHA-256 del token recibido
    const tokenHash = createHash('sha256').update(credential).digest('hex');

    // 2. Buscar en oauth_tokens con JOIN a oauth_clients
    const token = await this.tokenRepo.findOne({
      where: { token_hash: tokenHash },
      relations: ['client'],
    });

    if (!token) return { isValid: false, error: 'Invalid Access Token' };
    if (token.is_revoked) return { isValid: false, error: 'Access Token revoked' };
    if (token.expires_at < new Date()) return { isValid: false, error: 'Access Token expired' };

    return {
      isValid: true,
      user_id: token.client.client_id,
      role: token.client.role,
      customer_id: token.client.customer_id,
      seller_id: token.client.seller_id,
      token_id: token.token_id,
    };
  }
}
```

### `rbac.guard.ts` — Idéntico a T1 y T3

El `RbacGuard` de T5 es funcionalmente idéntico al de T1 y T3 (RBAC puro sin verificación de `resourceOwnerId`). Implementa las mismas reglas de acceso por rol.

---

## 16. Consideraciones de Integración para ms-data

- **URL base:** `http://localhost:3105` (configurable en `ms-data/.env` con `MS_AUTH_URL`)
- **Endpoint OAuth Token:** `POST /auth/token` (para el cliente de prueba, no llamado por ms-data)
- **Endpoint de introspección:** `POST /auth/validate` (llamado por ms-data en cada request)
- **Credencial esperada en `/auth/validate`:** Access Token en texto plano, extraído del header `Authorization: Bearer <token>` por ms-data
- **`resourceOwnerId`:** Es enviado por ms-data pero **T5 no lo evalúa** — el `RbacGuard` opera solo con `role`, `resource` y `action`
- **Interpretación del error por ms-data:**
  - `error` contiene `"rbac"` o `"forbidden"` -> ms-data responde `403`
  - Cualquier otro error -> ms-data responde `401`
- **Arranque:** el servicio es **stateful en BD** para emisión y validación de tokens — requiere PostgreSQL activo (a diferencia de T3/T4 que solo necesitan BD para el seed inicial)
- **Diferencia clave vs T1:** T1 valida API Keys directamente; T5 añade el paso de intercambio (`/auth/token`) antes de cada sesión de uso
- **Diferencia clave vs T3:** T3 usa JWT (stateless, sin BD en validación); T5 usa tokens opacos (stateful, requiere BD en cada validación)
- **Diferencia clave vs T6:** T6 combina OAuth 2.0 + ABAC (mitiga BOLA); T5 usa OAuth 2.0 + RBAC (no mitiga BOLA)

---

## 17. Plan de Implementación

### Orden de ejecución

1. **Entidades TypeORM:** `oauth-client.entity.ts` + `oauth-token.entity.ts`
2. **SeedService:** inserta clientes + tokens pre-expirados/revocados en `OnApplicationBootstrap`
3. **OAuthTokenStrategy:** introspección con SHA-256 lookup + mapeo de errores
4. **RbacGuard:** copiar de T1/T3 (misma lógica RBAC pura)
5. **AuthController:** implementar `/auth/token` (Client Credentials Grant) + `/auth/validate` (orquesta strategy + guard)
6. **AppModule:** registrar entidades, strategy, guard, seed
7. **Shared DTOs:** verificar compatibilidad con `ValidateRequestDto` / `ValidateResponseDto` de T1-T4

### Prueba de humo

```bash
# 1. Obtener Access Token
curl -X POST http://localhost:3105/auth/token \
  -H "Content-Type: application/json" \
  -d '{"grant_type":"client_credentials","client_id":"customer01","client_secret":"tesis-customer01-key-2026"}'
# -> { "access_token": "...", "token_type": "Bearer", "expires_in": 900 }

# 2. Validar token (request normal)
curl -X POST http://localhost:3105/auth/validate \
  -H "Content-Type: application/json" \
  -d '{"credential":"<token>","action":"query","resource":"Order"}'
# -> { "isValid": true, "payload": { ... } }

# 3. BOLA: validar con resourceOwnerId de otro customer (debe PERMITIR — vector activo)
curl -X POST http://localhost:3105/auth/validate \
  -H "Content-Type: application/json" \
  -d '{"credential":"<token-customer01>","action":"query","resource":"Order","resourceOwnerId":"ed0271e0b7da060a393796590e7b737a"}'
# -> { "isValid": true, ... }  <-- BOLA activo

# 4. Token expirado (BA-01)
curl -X POST http://localhost:3105/auth/validate \
  -H "Content-Type: application/json" \
  -d '{"credential":"<token-expirado>","action":"query","resource":"Order"}'
# -> { "isValid": false, "error": "Access Token expired" }
```
