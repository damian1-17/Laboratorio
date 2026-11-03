# ms-auth T6 — Documento de Arquitectura

> **Tratamiento:** T6 — **OAuth 2.0 (self-hosted) + ABAC**
> **Propósito:** Microservicio de autenticación y autorización para el tratamiento T6 del experimento de tesis. Extiende T5 (OAuth 2.0 + RBAC) reemplazando el `RbacGuard` por un `AbacGuard` que, además del rol, **verifica la propiedad del recurso** comparando `resourceOwnerId` con el `customer_id` / `seller_id` del token. Esto **mitiga BOLA (API1:2023)** — un customer autenticado solo puede acceder a sus propios recursos.

---

## 1. Contexto del Experimento

| Campo | Valor |
|---|---|
| Tratamiento | T6 |
| Mecanismo de autenticación | OAuth 2.0 Client Credentials — Access Token opaco (token de referencia, BD) |
| Mecanismo de autorización | ABAC (verifica rol **y** `resourceOwnerId` contra `customer_id` / `seller_id` del token) |
| Vector de vulnerabilidad | **BOLA mitigado (API1:2023)** — `AbacGuard` verifica propiedad del objeto |
| Authorization Server | Self-hosted en `ms-auth` — sin dependencias externas |
| Directorio del código | `experiment/T6/` |

---

## 2. Decisión de Diseño: OAuth 2.0 Self-Hosted + ABAC

T6 comparte con T5 el mismo mecanismo de autenticación (OAuth 2.0 Client Credentials con tokens opacos), pero introduce **Control de Acceso Basado en Atributos (ABAC)** en la capa de autorización:

- El cliente se autentica con `client_id + client_secret` → recibe un **Access Token opaco** (stateful, almacenado como hash SHA-256 en BD).
- En cada request, `ms-data` presenta el Access Token a `ms-auth` vía `POST /auth/validate`.
- `ms-auth` valida el token (introspección) **y** aplica la política ABAC:
  - Evalúa `role`, `resource`, `action` (igual que RBAC).
  - **Además** evalúa `resourceOwnerId` contra los atributos del token (`customer_id` / `seller_id`).
- El Access Token **no es un JWT** — es un token de referencia opaco. Cada validación requiere consulta a BD.

> **Diferencia clave con T5:** T5 recibe `resourceOwnerId` pero lo **ignora** (RBAC puro → BOLA activo). T6 **evalúa** `resourceOwnerId` en el `AbacGuard` (ABAC → BOLA mitigado).

> **Diferencia clave con T4:** T4 usa JWT + ABAC (stateless en validación). T6 usa tokens opacos + ABAC (stateful — requiere BD en cada validación), lo que permite revocación inmediata.

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
PORT=3106                                     # Puerto en que escucha el servicio
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=123
DB_DATABASE=olist_ecommerce                   # Base de datos PostgreSQL
OAUTH_SECRET=my-super-secret-key-for-oauth    # Usado para firmar/verificar client_secret (HMAC)
JWT_SECRET=my-super-secret-key-for-jwt        # Reservado (no usado en T6)
TOKEN_TTL_SECONDS=900                         # TTL del Access Token: 15 minutos (= T3/T4/T5)
```

> `JWT_SECRET` está presente para mantener paridad de entorno con los demás tratamientos pero **no es consumido en T6**. `OAUTH_SECRET` se usa como sal adicional en el hash del `client_secret`. El puerto `3106` distingue T6 del resto de tratamientos.

---

## 5. Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/auth/token` | OAuth 2.0 Token Endpoint — emite un Access Token opaco |
| `POST` | `/auth/validate` | Token Introspection + ABAC — valida Access Token y verifica propiedad del recurso |

---

### 5.1. `POST /auth/token` — OAuth 2.0 Token Endpoint

Idéntico a T5. Implementa **Client Credentials Grant** (RFC 6749 §4.4). Usado **exclusivamente por el cliente de prueba** (script del experimento) para obtener un Access Token antes de llamar a `ms-data`.

#### Request Body

```typescript
// Acepta application/json o application/x-www-form-urlencoded (estándar OAuth 2.0)
{
  grant_type: "client_credentials";  // único grant type soportado
  client_id: string;                 // username del usuario registrado en seed
  client_secret: string;             // secret en texto plano (equivalente a API Key)
  scope?: string;                    // Reservado — ignorado en T6
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

### 5.2. `POST /auth/validate` — Token Introspection + ABAC

Usado **exclusivamente por `ms-data`** en cada solicitud GraphQL. Extiende la introspección de T5 con evaluación ABAC de `resourceOwnerId`.

#### Request Body

```typescript
// ValidateRequestDto — idéntico a T1/T2/T3/T4/T5 para compatibilidad con ms-data
{
  credential: string;        // Access Token en texto plano (sin prefijo "Bearer ")
  action?: string;           // "query" | "mutation"
  resource?: string;         // "Order" | "Product" | "Customer" | "Seller"
  resourceOwnerId?: string;  // customer_id / seller_id — EVALUADO en T6 (mitiga BOLA)
  graphqlOperation?: string; // Reservado, no usado actualmente
}
```

#### Response Body

```typescript
// ValidateResponseDto — idéntico a T1/T2/T3/T4/T5
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

**Request legítimo (customer accede a su propio pedido):**
```http
POST http://localhost:3106/auth/validate
Content-Type: application/json

{
  "credential": "<access-token-opaco>",
  "action": "query",
  "resource": "Order",
  "resourceOwnerId": "9ef432eb6251297304e76186b10a928d"
}
```

**Response exitosa (customer01 accede a sus propios recursos):**
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

**Response fallida — BOLA bloqueado (customer01 intenta acceder a recursos de customer02):**
```json
{
  "isValid": false,
  "error": "ABAC: Access denied — resource belongs to another customer"
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

**Response fallida (ABAC — rol no autorizado):**
```json
{
  "isValid": false,
  "error": "ABAC: Sellers cannot create or modify Orders directly"
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
              `--- PASO 2: AbacGuard.canActivate(mockContext)
                        |
                        |  Evalúa: role x resource x action x resourceOwnerId
                        |  NOVEDAD vs T5: resourceOwnerId SÍ ES EVALUADO
                        |
                        |-- role = "admin"    -> ALLOW (acceso total, sin restricción de propiedad)
                        |-- role = "seller"   -> ver política ABAC de sellers
                        |-- role = "customer" -> ver política ABAC de customers
                        `-- role desconocido  -> ForbiddenException
```

---

## 7. Política de Autorización ABAC

> **BOLA mitigado:** El `AbacGuard` de T6 evalúa `resourceOwnerId` contra los atributos `customer_id` / `seller_id` embebidos en el token. Si el recurso pertenece a otro usuario, se deniega el acceso con error `403`.

### 7.1. Reglas para `admin`

| Resource | Action | `resourceOwnerId` | Resultado |
|---|---|---|---|
| cualquiera | cualquiera | cualquiera | ✅ Permitido (acceso total) |

### 7.2. Reglas para `customer`

| Resource | Action | Condición `resourceOwnerId` | Resultado |
|---|---|---|---|
| `Order` | `query` | `resourceOwnerId === token.customer_id` | ✅ Permitido |
| `Order` | `query` | `resourceOwnerId !== token.customer_id` | ❌ `ABAC: Access denied — resource belongs to another customer` |
| `Order` | `query` | `resourceOwnerId` ausente | ✅ Permitido (consulta de listado propio) |
| `Order` | `mutation` | `resourceOwnerId === token.customer_id` | ✅ Permitido |
| `Order` | `mutation` | `resourceOwnerId !== token.customer_id` | ❌ `ABAC: Access denied — resource belongs to another customer` |
| `Product` | `query` | cualquiera | ✅ Permitido (catálogo público) |
| `Seller` | `query` | cualquiera | ✅ Permitido (información pública) |
| `Product` | `mutation` | cualquiera | ❌ `ABAC: Customers cannot modify 'Product'` |
| `Seller` | `mutation` | cualquiera | ❌ `ABAC: Customers cannot modify 'Seller'` |
| `Customer` | cualquiera | cualquiera | ❌ `ABAC: Customers cannot access Customer records` |

### 7.3. Reglas para `seller`

| Resource | Action | Condición `resourceOwnerId` | Resultado |
|---|---|---|---|
| `Product` | `query` | `resourceOwnerId === token.seller_id` | ✅ Permitido |
| `Product` | `query` | `resourceOwnerId !== token.seller_id` | ❌ `ABAC: Access denied — product belongs to another seller` |
| `Product` | `query` | `resourceOwnerId` ausente | ✅ Permitido (listado propio) |
| `Product` | `mutation` | `resourceOwnerId === token.seller_id` | ✅ Permitido |
| `Product` | `mutation` | `resourceOwnerId !== token.seller_id` | ❌ `ABAC: Access denied — product belongs to another seller` |
| `Order` | `query` | cualquiera | ✅ Permitido (sellers pueden ver pedidos asociados a sus productos) |
| `Order` | `mutation` | cualquiera | ❌ `ABAC: Sellers cannot create or modify Orders directly` |
| otros | cualquiera | cualquiera | ❌ `ABAC: Sellers cannot access resource '<res>'` |

---

## 8. Ataques Cubiertos por el Experimento

| Código | Descripción | Dónde se maneja | Resultado en T6 |
|---|---|---|---|
| BA-01 | Token expirado (TTL 15 min) | `OAuthTokenStrategy` — `expires_at < now()` | ✅ BLOQUEADO `"Access Token expired"` → `401` en ms-data |
| BA-02 | Token inválido / falsificado | `OAuthTokenStrategy` — hash no encontrado en BD | ✅ BLOQUEADO `"Invalid Access Token"` → `401` en ms-data |
| BA-03 | Token revocado (`is_revoked=true`) | `OAuthTokenStrategy` — flag en BD | ✅ BLOQUEADO `"Access Token revoked"` → `401` en ms-data |
| BA-04 | Manipulación del token (alterar contenido) | Token opaco: cualquier alteración invalida el hash SHA-256 | ✅ BLOQUEADO `"Invalid Access Token"` |
| BOLA | Acceso a recurso de otro usuario | `AbacGuard` — compara `resourceOwnerId` con atributos del token | ✅ BLOQUEADO `"ABAC: Access denied — resource belongs to another customer/seller"` → `403` |

> **Mejora sobre T5:** T5 deja BOLA activo (RBAC ignora `resourceOwnerId`). T6 lo mitiga completamente mediante el `AbacGuard`.

> **Mejora sobre T4:** T4 usa JWT + ABAC pero no puede revocar tokens antes de su expiración. T6 (tokens opacos + ABAC) soporta revocación inmediata (BA-03) marcando `is_revoked=true` en BD.

---

## 9. Escenarios de Error y Códigos HTTP

| Escenario | Error retornado | HTTP en ms-data |
|---|---|---|
| Credencial ausente en ms-data | — (previo al llamado) | `401` |
| Token no registrado / falsificado | `"Invalid Access Token"` | `401` |
| Token expirado | `"Access Token expired"` | `401` |
| Token revocado | `"Access Token revoked"` | `401` |
| Acción prohibida por ABAC (rol) | mensaje `"ABAC: ..."` | `403` |
| BOLA — recurso de otro usuario | `"ABAC: Access denied — resource belongs to another customer/seller"` | `403` |
| ms-auth no disponible | `"Auth service unavailable"` | `401` |

> **Interpretación del error por ms-data:** si `error` contiene `"abac"` o `"forbidden"` → ms-data responde `403`; cualquier otro error → ms-data responde `401`.

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
               ms-auth calcula SHA-256(token), busca en oauth_tokens + aplica ABAC
                       |
                       |-- ABAC evalúa: role + resource + action + resourceOwnerId
                       |
                       -> { isValid, payload | error }
```

---

## 11. Modelo de Datos

### `OAuthClient` → tabla `oauth_clients` (`synchronize: false`)

Idéntica a T5. Equivalente a la tabla `users` de T1–T4, con la semántica OAuth 2.0 de "client".

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

### `OAuthToken` → tabla `oauth_tokens` (`synchronize: false`)

Idéntica a T5. Almacena los Access Tokens emitidos (como hashes SHA-256).

| Campo | Tipo | Descripción |
|---|---|---|
| `token_id` | `uuid` PK | Generado automáticamente |
| `token_hash` | `varchar` unique | SHA-256 del Access Token real (nunca se almacena el token en claro) |
| `client_id` | `uuid` | FK → `oauth_clients.client_id` |
| `is_revoked` | `boolean` default `false` | `true` = token revocado |
| `created_at` | `timestamp` | Auto-generado |
| `expires_at` | `timestamp` | `created_at + TOKEN_TTL_SECONDS` |

> `synchronize: false` — Las tablas deben existir previamente. Se crean mediante el SeedService que ejecuta DDL raw o TypeORM migrations fuera del ciclo de vida de la app.

---

## 12. Datos de Seed (SeedService)

El `SeedService` se ejecuta en `OnApplicationBootstrap` y solo inserta datos si `oauth_clients` está vacía.

### Clientes OAuth registrados

| client_name | Rol | customer_id (Olist) | seller_id (Olist) | client_secret (texto plano) |
|---|---|---|---|---|
| `admin` | `admin` | — | — | `tesis-admin-key-2026` |
| `seller01` | `seller` | — | `3442f8959a84dea7ee197c632cb2df15` | `tesis-seller01-key-2026` |
| `customer01` | `customer` | `9ef432eb6251297304e76186b10a928d` | — | `tesis-customer01-key-2026` |
| `customer02` | `customer` | `ed0271e0b7da060a393796590e7b737a` | — | `tesis-customer02-key-2026` |
| `customer03` | `customer` | `8886130db0ea6e9e70ba0b03d7c0d286` | — | `tesis-customer03-key-2026` |
| `customer04` | `customer` | `6d6b50b66d79f80827b6d96751528d30` | — | `tesis-customer04-key-2026` |
| `customer05` | `customer` | `65a227fbf7d798cdeadee8c0bea74993` | — | `tesis-customer05-key-2026` |

> Los `client_secret` en texto plano son idénticos a las API Keys de T1–T5 para mantener paridad en el script de experimento. El seed los hashea con `SHA-256(secret + OAUTH_SECRET)` al insertar.

### Tokens pre-expirados (escenario BA-01)

La expiración opera a nivel de **Access Token** (`oauth_tokens.expires_at`). El SeedService pre-inserta tokens expirados para prueba:

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
T6/
|-- .env                              # Variables de entorno
|-- nest-cli.json
|-- package.json                      # Nombre: "ms-auth" | pnpm
|-- tsconfig.json
`-- src/
    |-- main.ts                       # Bootstrap — escucha en PORT (default 3106)
    |-- app.module.ts                 # Módulo raíz: TypeORM, strategy, guard, seed
    |-- auth-core/
    |   |-- auth.controller.ts        # POST /auth/token + POST /auth/validate
    |   |-- index.ts                  # Barrel exports
    |   |-- entities/
    |   |   |-- oauth-client.entity.ts   # Tabla oauth_clients (idéntica a T5)
    |   |   `-- oauth-token.entity.ts    # Tabla oauth_tokens (idéntica a T5)
    |   |-- strategies/
    |   |   `-- oauth-token.strategy.ts  # Introspección: SHA-256 lookup en oauth_tokens (idéntica a T5)
    |   |-- guards/
    |   |   `-- abac.guard.ts            # Autoriza: role x resource x action x resourceOwnerId (NUEVO vs T5)
    |   `-- seeds/
    |       `-- seed.service.ts          # Inserta clientes + tokens pre-expirados/revocados
    `-- shared/
        |-- index.ts                  # Barrel exports
        |-- auth/
        |   |-- auth-payload.type.ts          # Tipo AuthPayload
        |   `-- auth-strategy.interface.ts    # Interface IAuthStrategy
        `-- dtos/
            |-- validate-request.dto.ts       # DTO de entrada (idéntico a T1–T5)
            `-- validate-response.dto.ts      # DTO de salida (idéntico a T1–T5)
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
|-- AbacGuard           (token: 'IAuthGuard')    ← reemplaza RbacGuard de T5
`-- SeedService         (OnApplicationBootstrap)
```

---

## 15. Componentes Clave a Implementar

### `auth.controller.ts` — Dos endpoints (idéntico a T5)

```typescript
@Controller('auth')
export class AuthController {
  // POST /auth/token — OAuth 2.0 Client Credentials Grant
  @Post('token')
  async issueToken(@Body() body: { grant_type: string; client_id: string; client_secret: string })
    : Promise<{ access_token: string; token_type: string; expires_in: number }>

  // POST /auth/validate — Token Introspection + ABAC
  @Post('validate')
  async validate(@Body() request: ValidateRequestDto): Promise<ValidateResponseDto>
}
```

### `oauth-token.strategy.ts` — Estrategia de introspección (idéntica a T5)

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

### `abac.guard.ts` — NUEVO en T6 (reemplaza `rbac.guard.ts` de T5)

```typescript
@Injectable()
export class AbacGuard implements IAuthGuard {
  canActivate(context: { payload: AuthPayload; request: ValidateRequestDto }): boolean {
    const { role, customer_id, seller_id } = context.payload;
    const { action, resource, resourceOwnerId } = context.request;

    // Admin: acceso total sin restricción de propiedad
    if (role === 'admin') return true;

    if (role === 'customer') {
      // Recursos de catálogo — públicos para customers
      if (resource === 'Product' && action === 'query') return true;
      if (resource === 'Seller' && action === 'query') return true;

      // Recursos propietarios — customer solo accede a los suyos
      if (resource === 'Order') {
        if (action === 'mutation' || action === 'query') {
          // Si se envía resourceOwnerId, verificar propiedad
          if (resourceOwnerId && resourceOwnerId !== customer_id) {
            throw new ForbiddenException(
              'ABAC: Access denied — resource belongs to another customer'
            );
          }
          return true;
        }
      }

      // Recursos prohibidos
      if (resource === 'Product' && action === 'mutation')
        throw new ForbiddenException("ABAC: Customers cannot modify 'Product'");
      if (resource === 'Seller' && action === 'mutation')
        throw new ForbiddenException("ABAC: Customers cannot modify 'Seller'");
      if (resource === 'Customer')
        throw new ForbiddenException('ABAC: Customers cannot access Customer records');
    }

    if (role === 'seller') {
      if (resource === 'Order' && action === 'query') return true;
      if (resource === 'Order' && action === 'mutation')
        throw new ForbiddenException('ABAC: Sellers cannot create or modify Orders directly');

      if (resource === 'Product') {
        // Si se envía resourceOwnerId, verificar que el producto pertenece al seller
        if (resourceOwnerId && resourceOwnerId !== seller_id) {
          throw new ForbiddenException(
            'ABAC: Access denied — product belongs to another seller'
          );
        }
        return true;
      }

      throw new ForbiddenException(`ABAC: Sellers cannot access resource '${resource}'`);
    }

    throw new ForbiddenException('ABAC: Unknown role');
  }
}
```

---

## 16. Consideraciones de Integración para ms-data

- **URL base:** `http://localhost:3106` (configurable en `ms-data/.env` con `MS_AUTH_URL`)
- **Endpoint OAuth Token:** `POST /auth/token` (para el cliente de prueba, no llamado por ms-data)
- **Endpoint de introspección:** `POST /auth/validate` (llamado por ms-data en cada request)
- **Credencial esperada en `/auth/validate`:** Access Token en texto plano, extraído del header `Authorization: Bearer <token>` por ms-data
- **`resourceOwnerId`:** Es enviado por ms-data y **T6 SÍ lo evalúa** — el `AbacGuard` compara contra `customer_id` / `seller_id` del token
- **Interpretación del error por ms-data:**
  - `error` contiene `"abac"` o `"forbidden"` → ms-data responde `403`
  - Cualquier otro error → ms-data responde `401`
- **Arranque:** el servicio es **stateful en BD** para emisión y validación de tokens — requiere PostgreSQL activo
- **Diferencia clave vs T5:** T5 tiene RBAC (ignora `resourceOwnerId` → BOLA activo); T6 tiene ABAC (evalúa `resourceOwnerId` → BOLA mitigado)
- **Diferencia clave vs T4:** T4 usa JWT + ABAC (stateless en validación, sin revocación); T6 usa tokens opacos + ABAC (stateful, con revocación inmediata)

---

## 17. Tabla Comparativa de Tratamientos

| Tratamiento | Autenticación | Autorización | BOLA | Revocación |
|---|---|---|---|---|
| T1 | API Key (hash BD) | RBAC | ❌ Vulnerable | N/A |
| T2 | API Key (hash BD) | ABAC | ✅ Mitigado | N/A |
| T3 | JWT (stateless) | RBAC | ❌ Vulnerable | ❌ No (JWT expira) |
| T4 | JWT (stateless) | ABAC | ✅ Mitigado | ❌ No (JWT expira) |
| T5 | OAuth 2.0 opaco | RBAC | ❌ Vulnerable | ✅ Inmediata (BD) |
| **T6** | **OAuth 2.0 opaco** | **ABAC** | **✅ Mitigado** | **✅ Inmediata (BD)** |

> T6 es el tratamiento con mayor nivel de seguridad del experimento: combina la revocabilidad inmediata de tokens opacos (OAuth 2.0) con la verificación de propiedad del recurso (ABAC).

---

## 18. Plan de Implementación

### Orden de ejecución

1. **Entidades TypeORM:** copiar `oauth-client.entity.ts` + `oauth-token.entity.ts` de T5 (sin cambios)
2. **SeedService:** copiar de T5 (mismos datos de seed — clientes, tokens pre-expirados/revocados)
3. **OAuthTokenStrategy:** copiar de T5 (misma lógica de introspección SHA-256)
4. **AbacGuard:** implementar nuevo guard (reemplaza `RbacGuard` — agrega evaluación de `resourceOwnerId`)
5. **AuthController:** copiar de T5 (mismo `POST /auth/token` + `POST /auth/validate`; el guard cambia a nivel de módulo)
6. **AppModule:** registrar entidades, strategy, **AbacGuard** (en lugar de RbacGuard), seed
7. **Shared DTOs:** verificar compatibilidad con `ValidateRequestDto` / `ValidateResponseDto` de T1–T5

### Prueba de humo

```bash
# 1. Obtener Access Token
curl -X POST http://localhost:3106/auth/token \
  -H "Content-Type: application/json" \
  -d '{"grant_type":"client_credentials","client_id":"customer01","client_secret":"tesis-customer01-key-2026"}'
# -> { "access_token": "...", "token_type": "Bearer", "expires_in": 900 }

# 2. Validar token — acceso propio (debe PERMITIR)
curl -X POST http://localhost:3106/auth/validate \
  -H "Content-Type: application/json" \
  -d '{"credential":"<token>","action":"query","resource":"Order","resourceOwnerId":"9ef432eb6251297304e76186b10a928d"}'
# -> { "isValid": true, "payload": { ... } }

# 3. BOLA bloqueado: customer01 intenta acceder a recursos de customer02 (debe DENEGAR)
curl -X POST http://localhost:3106/auth/validate \
  -H "Content-Type: application/json" \
  -d '{"credential":"<token-customer01>","action":"query","resource":"Order","resourceOwnerId":"ed0271e0b7da060a393796590e7b737a"}'
# -> { "isValid": false, "error": "ABAC: Access denied — resource belongs to another customer" }

# 4. Token expirado (BA-01)
curl -X POST http://localhost:3106/auth/validate \
  -H "Content-Type: application/json" \
  -d '{"credential":"<token-expirado>","action":"query","resource":"Order"}'
# -> { "isValid": false, "error": "Access Token expired" }

# 5. Token revocado (BA-03)
curl -X POST http://localhost:3106/auth/validate \
  -H "Content-Type: application/json" \
  -d '{"credential":"<token-revocado>","action":"query","resource":"Order"}'
# -> { "isValid": false, "error": "Access Token revoked" }
```

