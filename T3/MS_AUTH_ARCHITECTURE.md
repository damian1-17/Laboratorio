# ms-auth T3 — Documento de Arquitectura

> **Tratamiento:** T3 — **JWT + RBAC**
> **Propósito:** Microservicio de autenticación y autorización para el tratamiento T3 del experimento de tesis. Introduce JWT como mecanismo de autenticación (en reemplazo de la API Key opaca de T1/T2). El cliente primero intercambia su API Key por un JWT firmado (`POST /auth/token`) y luego `ms-data` valida ese JWT en cada solicitud (`POST /auth/validate`). La autorización usa RBAC puro: solo evalúa el rol del usuario, **sin** verificar la propiedad del recurso, por lo que es vulnerable a BOLA (API1:2023).

---

## 1. Contexto del Experimento

| Campo | Valor |
|---|---|
| Tratamiento | T3 |
| Mecanismo de autenticación | JWT (HS256, firmado con `JWT_SECRET`, TTL 15 min) |
| Mecanismo de autorización | RBAC puro (verifica solo el rol, **no** `resourceOwnerId`) |
| Vector de vulnerabilidad | **BOLA activo (API1:2023)** — `RbacGuard` no verifica propiedad del objeto |
| Directorio del código | `experiment/T3/` |

---

## 2. Stack Tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Runtime | Node.js | >= 18 |
| Framework | NestJS | ^10 |
| Lenguaje | TypeScript | ^5.1 |
| API | REST (Express) | — |
| ORM | TypeORM | ^0.3 |
| Base de datos | PostgreSQL | 14+ |
| Autenticación de tokens | `@nestjs/jwt` (HS256) | ^10 |
| Hashing (API Keys -> seed) | Node.js `crypto` (SHA-256) | nativo |
| Hashing de contraseñas (dep.) | `bcrypt` | ^5.1 |
| Package manager | pnpm | workspace |

---

## 3. Variables de Entorno (`.env`)

```env
PORT=3103                                     # Puerto en que escucha el servicio
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=123
DB_DATABASE=olist_ecommerce                   # Base de datos PostgreSQL
JWT_SECRET=my-super-secret-key-for-jwt        # Clave de firma HS256 para los JWT
OAUTH_SECRET=my-super-secret-key-for-oauth    # Fallback si JWT_SECRET no está definido
```

> En T3, `JWT_SECRET` es la variable activa. `OAUTH_SECRET` existe como fallback de compatibilidad (ver `app.module.ts`). Ambas están reservadas sin conflicto con los demás tratamientos.

---

## 4. Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/auth/token` | Intercambia `username + api_key` por un JWT firmado |
| `POST` | `/auth/validate` | Valida un JWT ya emitido y aplica RBAC |

### 4.1. `POST /auth/token`

Usado **exclusivamente por el cliente de prueba** (script del experimento) para obtener un JWT antes de llamar a `ms-data`.

#### Request Body

```typescript
{
  username: string;   // nombre del usuario registrado en seed
  api_key: string;    // API Key en texto plano
}
```

#### Response Body (éxito)

```json
{
  "access_token": "<jwt-string>",
  "expires_in": 900,
  "token_type": "Bearer"
}
```

#### Response Body (error)

```
HTTP 401 Unauthorized
{ "message": "Invalid or inactive API key for this user" }
```

#### Lógica interna de `/auth/token`

1. Busca el usuario por `username` en la tabla `users`.
2. Calcula `SHA-256(api_key)` y busca en `api_keys` por `{user_id, key_hash, is_active=true}`.
3. Si `expires_at` < `now()` → `401 API key has expired`.
4. Firma un JWT con los claims del usuario e incluye un `jti` (UUID v4) para garantizar unicidad incluso si dos tokens son emitidos en el mismo segundo.
5. TTL: **15 minutos** (`expiresIn: '15m'`).

#### Claims del JWT emitido

```typescript
{
  sub: string;           // user_id (UUID interno)
  jti: string;           // UUID único por emisión (RFC 7519 §4.1.7)
  username: string;
  role: string;          // "admin" | "seller" | "customer"
  customer_id?: string;  // customer_id de Olist (solo si aplica)
  seller_id?: string;    // seller_id de Olist (solo si aplica)
  iat: number;           // emitido en (Unix timestamp)
  exp: number;           // expira en (Unix timestamp, iat + 900)
}
```

> **Nota sobre `jti`:** Sin este campo, HMAC-SHA256 es determinista: mismo payload + mismo secret + mismo `iat` -> mismo token string. El `jti` garantiza que cada fila del CSV del experimento usa un JWT diferente, lo que es esencial para la trazabilidad.

---

### 4.2. `POST /auth/validate`

Usado **exclusivamente por `ms-data`** a través de `AuthHttpService` en cada solicitud GraphQL.

#### Request Body

```typescript
// ValidateRequestDto
{
  credential: string;        // JWT en texto plano (Bearer token, sin prefijo "Bearer ")
  action?: string;           // "query" | "mutation"
  resource?: string;         // "Order" | "Product" | "Customer" | "Seller"
  resourceOwnerId?: string;  // customer_id / seller_id — enviado por ms-data, IGNORADO en T3 (RBAC puro)
  graphqlOperation?: string; // Reservado, no usado actualmente
}
```

#### Response Body

```typescript
// ValidateResponseDto
{
  isValid: boolean;
  payload?: AuthPayload;  // Solo presente si isValid = true
  error?: string;         // Solo presente si isValid = false
}

// AuthPayload (cuando isValid = true)
{
  isValid: true;
  user_id: string;         // UUID interno del usuario (claim "sub")
  role: string;            // "admin" | "seller" | "customer"
  customer_id?: string;    // customer_id del dataset Olist (si aplica)
  seller_id?: string;      // seller_id del dataset Olist (si aplica)
}
```

#### Ejemplos

**Request:**
```http
POST http://localhost:3103/auth/validate
Content-Type: application/json

{
  "credential": "<jwt-emitido-por-/auth/token>",
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
    "customer_id": "9ef432eb6251297304e76186b10a928d"
  }
}
```

**Response fallida (JWT expirado — BA-01):**
```json
{
  "isValid": false,
  "error": "JWT expired (BA-01)"
}
```

**Response fallida (firma inválida — BA-02):**
```json
{
  "isValid": false,
  "error": "JWT invalid signature (BA-02)"
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

## 5. Flujo Interno de Validación (`/auth/validate`)

```
ms-data -> POST /auth/validate
              |
              v
        AuthController
              |
              |--- PASO 1: JwtStrategy.validate(credential)
              |         |
              |         |  JwtService.verify(credential, JWT_SECRET)
              |         |
              |         |-- TokenExpiredError  -> { isValid: false, error: "JWT expired (BA-01)" }
              |         |-- JsonWebTokenError  -> { isValid: false, error: "JWT invalid signature (BA-02)" }
              |         |-- Otro error         -> { isValid: false, error: "JWT verification failed: ..." }
              |         `-- OK (firma válida)  -> { isValid: true, user_id, role, customer_id, seller_id }
              |
              |--- (si isValid=false) -> return { isValid: false, error }
              |
              `--- PASO 2: RbacGuard.canActivate(mockContext)
                        |
                        |  Evalúa SOLO: role x resource x action
                        |  ADVERTENCIA: resourceOwnerId es recibido pero NUNCA evaluado
                        |
                        |-- role = "admin"    -> ALLOW (acceso total)
                        |-- role = "seller"   -> ver tabla de permisos RBAC
                        |-- role = "customer" -> ver tabla de permisos RBAC
                        `-- role desconocido  -> ForbiddenException
```

---

## 6. Tabla de Permisos RBAC

> **ADVERTENCIA - Vector BOLA:** A diferencia de T2/T4/T6, el `RbacGuard` de T3 **nunca evalúa `resourceOwnerId`**. Un customer autenticado puede acceder a los pedidos de cualquier otro customer si conoce su `order_id` o `customer_id`.

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

## 7. Ataques Cubiertos por el Experimento (Escenarios BA)

| Código | Descripción | Dónde se maneja | Resultado en T3 |
|---|---|---|---|
| BA-01 | JWT expirado (TTL 15 min) | `JwtStrategy` — `TokenExpiredError` | BLOQUEADO `"JWT expired (BA-01)"` -> `401` en ms-data |
| BA-02 | Firma JWT inválida (secret incorrecto) | `JwtStrategy` — `JsonWebTokenError` | BLOQUEADO `"JWT invalid signature (BA-02)"` -> `401` en ms-data |
| BA-03 | Token revocado (blacklist) | **No aplica en T3** — sin blacklist | VULNERABLE El token sigue siendo válido hasta expiración |
| BA-04 | Manipulación de claims (alterar rol) | `JwtStrategy` — firma HS256 invalida el token | BLOQUEADO `"JWT invalid signature (BA-02)"` |
| BOLA | Acceso a recurso de otro usuario | **No mitigado — RBAC no verifica `resourceOwnerId`** | VULNERABLE Acceso permitido |

---

## 8. Escenarios de Error y Códigos HTTP

| Escenario | Error retornado | HTTP en ms-data |
|---|---|---|
| Credencial ausente en ms-data | — (previo al llamado) | `401` |
| JWT malformado / firma inválida | `"JWT invalid signature (BA-02)"` | `401` |
| JWT expirado | `"JWT expired (BA-01)"` | `401` |
| JWT inválido (otro error) | `"JWT verification failed: ..."` | `401` |
| Acción prohibida por RBAC (rol) | mensaje `"RBAC: ..."` | `403` |
| ms-auth no disponible | `"Auth service unavailable"` | `401` |

> **Interpretación del error por ms-data:** si `error` contiene `"rbac"` o `"forbidden"` (case-insensitive) -> ms-data responde `403`; cualquier otro error -> ms-data responde `401`.

---

## 9. Flujo del Cliente (Experimento)

```
Script de prueba
      |
      |--- 1. POST /auth/token  { username, api_key }
      |                |
      |          { access_token, expires_in: 900, token_type: "Bearer" }
      |
      `--- 2. Adjunta JWT como Bearer token en cada request a ms-data
                       |
               ms-data extrae el JWT del header Authorization
                       |
               ms-data -> POST /auth/validate { credential: jwt, action, resource, resourceOwnerId }
                       |
               ms-auth verifica JWT + aplica RBAC -> { isValid, payload | error }
```

---

## 10. Modelo de Datos

### `User` -> tabla `users` (`synchronize: false`)

| Campo | Tipo | Descripción |
|---|---|---|
| `user_id` | `uuid` PK | Generado automáticamente |
| `username` | `varchar` unique | Nombre de usuario |
| `role` | `varchar` | `"admin"` \| `"seller"` \| `"customer"` |
| `seller_id` | `varchar` nullable | FK lógica a `sellers.seller_id` del dataset Olist |
| `customer_id` | `varchar` nullable | FK lógica a `customers.customer_id` del dataset Olist |
| `created_at` | `timestamp` | Auto-generado |

### `ApiKey` -> tabla `api_keys` (`synchronize: false`)

| Campo | Tipo | Descripción |
|---|---|---|
| `api_key_id` | `uuid` PK | Generado automáticamente |
| `key_hash` | `varchar` unique | SHA-256 del valor real de la API Key |
| `user_id` | `varchar` | FK -> `users.user_id` |
| `is_active` | `boolean` default `true` | `false` = revocada |
| `created_at` | `timestamp` | Auto-generado |
| `expires_at` | `timestamp` nullable | `null` = sin expiración |

> `synchronize: false` — TypeORM **no** crea ni modifica las tablas automáticamente. Las tablas deben existir previamente en la BD (compartida con el dataset Olist). La tabla `api_keys` es usada **únicamente** en `/auth/token` para la fase de intercambio inicial; la validación en `/auth/validate` opera enteramente sobre el JWT (stateless).

---

## 11. Datos de Seed (SeedService)

El `SeedService` se ejecuta en `OnApplicationBootstrap` y solo inserta datos si `users` está vacía.

### Usuarios con API Keys válidas

| Username | Rol | customer_id (Olist) | seller_id (Olist) | API Key (texto plano) |
|---|---|---|---|---|
| `admin` | `admin` | — | — | `tesis-admin-key-2026` |
| `seller01` | `seller` | — | `3442f8959a84dea7ee197c632cb2df15` | `tesis-seller01-key-2026` |
| `customer01` | `customer` | `9ef432eb6251297304e76186b10a928d` | — | `tesis-customer01-key-2026` |
| `customer02` | `customer` | `ed0271e0b7da060a393796590e7b737a` | — | `tesis-customer02-key-2026` |
| `customer03` | `customer` | `8886130db0ea6e9e70ba0b03d7c0d286` | — | `tesis-customer03-key-2026` |
| `customer04` | `customer` | `6d6b50b66d79f80827b6d96751528d30` | — | `tesis-customer04-key-2026` |
| `customer05` | `customer` | `65a227fbf7d798cdeadee8c0bea74993` | — | `tesis-customer05-key-2026` |

### API Keys expiradas (`is_active=true`, `expires_at` pasada — 2026-06/07)

| Customer | API Key (texto plano) | Fecha de expiración |
|---|---|---|
| `customer01` | `tesis-customer01-EXPIRED-key-2026` | 2026-06-01 |
| `customer02` | `tesis-customer02-EXPIRED-key-2026` | 2026-06-01 |
| `customer03` | `tesis-customer03-EXPIRED-key-2026` | 2026-07-01 |
| `customer04` | `tesis-customer04-EXPIRED-key-2026` | 2026-07-01 |
| `customer05` | `tesis-customer05-EXPIRED-key-2026` | 2026-07-01 |

### API Keys revocadas (`is_active=false`, `expires_at` 2027)

| Customer | API Key (texto plano) |
|---|---|
| `customer01` | `tesis-customer01-REVOKED-key-2026` |
| `customer02` | `tesis-customer02-REVOKED-key-2026` |
| `customer03` | `tesis-customer03-REVOKED-key-2026` |
| `customer04` | `tesis-customer04-REVOKED-key-2026` |
| `customer05` | `tesis-customer05-REVOKED-key-2026` |

> Las API Keys expiradas y revocadas solo son relevantes para `/auth/token`. Una vez que el cliente tiene un JWT válido, la API Key no se vuelve a usar hasta que el JWT expire.

---

## 12. Estructura de Directorios

```
T3/
|-- .env                              # Variables de entorno
|-- nest-cli.json
|-- package.json                      # Nombre: "ms-auth" | pnpm
|-- tsconfig.json
`-- src/
    |-- main.ts                       # Bootstrap — escucha en PORT (default 3103)
    |-- app.module.ts                 # Módulo raíz: TypeORM, JwtModule, strategy, guard, seed
    |-- auth-core/
    |   |-- auth.controller.ts        # POST /auth/token + POST /auth/validate
    |   |-- index.ts                  # Barrel exports
    |   |-- entities/
    |   |   |-- user.entity.ts        # Tabla users
    |   |   `-- api-key.entity.ts     # Tabla api_keys
    |   |-- strategies/
    |   |   `-- jwt.strategy.ts       # Autentica: verifica firma JWT con JWT_SECRET
    |   |-- guards/
    |   |   `-- rbac.guard.ts         # Autoriza: role x resource x action (sin ownership check)
    |   `-- seeds/
    |       `-- seed.service.ts       # Inserta usuarios y keys al arrancar
    `-- shared/
        |-- index.ts                  # Barrel exports
        |-- auth/
        |   |-- auth-payload.type.ts          # Tipo AuthPayload
        |   `-- auth-strategy.interface.ts    # Interface IAuthStrategy
        `-- dtos/
            |-- validate-request.dto.ts       # DTO de entrada de /auth/validate
            `-- validate-response.dto.ts      # DTO de salida de /auth/validate
```

---

## 13. Módulos NestJS

```
AppModule
|-- ConfigModule (global)
|-- TypeOrmModule (PostgreSQL, synchronize: false)
|   `-- forFeature([ApiKey, User])
|-- JwtModule (HS256, secret: JWT_SECRET || OAUTH_SECRET, expiresIn: '15m')
|-- AuthController  (POST /auth/token + POST /auth/validate)
|-- JwtStrategy     (token: 'IAuthStrategy')
|-- RbacGuard       (token: 'IAuthGuard')
`-- SeedService     (OnApplicationBootstrap)
```

---

## 14. Consideraciones de Integración para ms-data

- **URL base:** `http://localhost:3103` (configurable en `ms-data/.env` con `MS_AUTH_URL`)
- **Endpoints consumidos por ms-data:** `POST /auth/validate` (el único llamado internamente)
- **Endpoint para clientes de prueba:** `POST /auth/token` (no es llamado por ms-data)
- **Credencial esperada en `/auth/validate`:** JWT en texto plano, extraído del header `Authorization: Bearer <token>` por ms-data
- **`resourceOwnerId`:** Es enviado por ms-data pero **T3 no lo evalúa** — el `RbacGuard` lo recibe en `mockRequest.body` pero la lógica de autorización solo usa `role`, `resource` y `action`
- **Interpretación del error por ms-data:**
  - `error` contiene `"rbac"` o `"forbidden"` -> ms-data responde `403`
  - Cualquier otro error -> ms-data responde `401`
- **Arranque:** el servicio es stateful en BD para el seed inicial — requiere PostgreSQL activo; la validación de JWT posterior es stateless (no consulta BD)
- **Diferencia clave vs T1:** mecanismo de autenticación cambia de API Key opaca a JWT firmado; el guard sigue siendo RBAC puro (misma vulnerabilidad BOLA)
- **Diferencia clave vs T2:** T2 usa API Key + ABAC (mitiga BOLA); T3 usa JWT + RBAC (no mitiga BOLA)
- **Diferencia clave vs T4:** T4 combina JWT + ABAC (mitiga BOLA); T3 usa JWT + RBAC (no mitiga BOLA)
