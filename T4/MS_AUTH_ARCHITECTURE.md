# ms-auth T4 — Documento de Arquitectura

> **Tratamiento:** T4 — **JWT + ABAC**
> **Propósito:** Microservicio de autenticación y autorización para el tratamiento T4 del experimento de tesis. Combina JWT como mecanismo de autenticación (igual que T3) con control de acceso basado en atributos (ABAC) para la autorización (igual que T2). El cliente intercambia su API Key por un JWT firmado (`POST /auth/token`), y `ms-data` valida ese JWT en cada solicitud (`POST /auth/validate`). El `AbacGuard` evalúa rol + propiedad del recurso (`resourceOwnerId`), **mitigando BOLA (API1:2023)**.

---

## 1. Contexto del Experimento

| Campo | Valor |
|---|---|
| Tratamiento | T4 |
| Mecanismo de autenticación | JWT (HS256, firmado con `JWT_SECRET`, TTL 15 min) |
| Mecanismo de autorización | ABAC (verifica rol + propiedad del objeto `resourceOwnerId`) |
| Vector de vulnerabilidad | Ninguno — ABAC mitiga BOLA (API1:2023) verificando `resourceOwnerId` |
| Directorio del código | `experiment/T4/` |

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
| Package manager | pnpm | workspace |

---

## 3. Variables de Entorno (`.env`)

```env
PORT=3104                                     # Puerto en que escucha el servicio
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=123
DB_DATABASE=olist_ecommerce                   # Base de datos PostgreSQL
JWT_SECRET=my-super-secret-key-for-jwt        # Clave de firma HS256 para los JWT
OAUTH_SECRET=my-super-secret-key-for-oauth    # Fallback si JWT_SECRET no está definido
```

> En T4, `JWT_SECRET` es la variable activa. `OAUTH_SECRET` existe como fallback de compatibilidad. Las variables de base de datos son necesarias para la fase de intercambio inicial (`/auth/token`); la validación JWT en `/auth/validate` es stateless.

---

## 4. Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/auth/token` | Intercambia `username + api_key` por un JWT firmado |
| `POST` | `/auth/validate` | Valida un JWT ya emitido y aplica ABAC |

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

---

### 4.2. `POST /auth/validate`

Usado **exclusivamente por `ms-data`** a través de `AuthHttpService` en cada solicitud GraphQL.

#### Request Body

```typescript
// ValidateRequestDto
{
  credential: string;        // JWT en texto plano (sin prefijo "Bearer ")
  action?: string;           // "query" | "mutation"
  resource?: string;         // "Order" | "Product" | "Customer" | "Seller"
  resourceOwnerId?: string;  // customer_id / seller_id propietario del recurso — EVALUADO en ABAC
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
  user_id: string;         // UUID interno del usuario (claim "sub") — ausente si JwtStrategy no lo mapea
  role: string;            // "admin" | "seller" | "customer"
  customer_id?: string;    // customer_id del dataset Olist (si aplica)
  seller_id?: string;      // seller_id del dataset Olist (si aplica)
}
```

> **Nota:** La `JwtStrategy` de T4 no incluye `user_id` en el payload retornado (a diferencia de T3). Solo extrae `role`, `customer_id` y `seller_id` del JWT. El `AbacGuard` usa únicamente estos tres campos para su evaluación.

#### Ejemplos

**Request:**
```http
POST http://localhost:3104/auth/validate
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
    "role": "customer",
    "customer_id": "9ef432eb6251297304e76186b10a928d"
  }
}
```

**Response fallida (JWT inválido o expirado):**
```json
{
  "isValid": false,
  "error": "Invalid or expired JWT"
}
```

**Response fallida (violación ABAC — ownership):**
```json
{
  "isValid": false,
  "error": "ABAC: You can only access your own resources"
}
```

**Response fallida (violación ABAC — rol):**
```json
{
  "isValid": false,
  "error": "ABAC: Sellers cannot create or modify Orders directly"
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
              |         |-- Error (expirado / firma inválida / malformado)
              |         |       -> { isValid: false, error: "Invalid or expired JWT" }
              |         `-- OK (firma válida)
              |                 -> { isValid: true, role, customer_id, seller_id }
              |
              |--- (si isValid=false) -> return { isValid: false, error }
              |
              `--- PASO 2: AbacGuard.canActivate(mockContext)
                        |
                        |  Evalúa: role x resource x action x resourceOwnerId
                        |
                        |-- role = "admin"    -> ALLOW (acceso total)
                        |-- role = "seller"   -> ver tabla de permisos ABAC
                        |-- role = "customer" -> ver tabla de permisos ABAC
                        `-- role desconocido  -> ForbiddenException
```

---

## 6. Tabla de Permisos ABAC

> **Mitigación BOLA:** A diferencia de T3, el `AbacGuard` de T4 **sí evalúa `resourceOwnerId`**. Si `resourceOwnerId` está presente, lo compara contra `payload.customer_id` (para customers) o `payload.seller_id` (para sellers). Si hay discordancia, se deniega el acceso. Si `resourceOwnerId` está ausente (e.g., en `createOrder` vía GraphQL variables), la validación de propiedad recae sobre el resolver de `ms-data`.

| Rol | Resource | Action | `resourceOwnerId` | Resultado |
|---|---|---|---|---|
| `admin` | cualquiera | cualquiera | cualquiera | OK Permitido |
| `seller` | `Product` | `query` | cualquiera | OK Permitido |
| `seller` | `Product` | `mutation` | cualquiera | OK Permitido |
| `seller` | `Order` | `query` | ausente | OK Permitido |
| `seller` | `Order` | `query` | `== payload.seller_id` | OK Permitido |
| `seller` | `Order` | `query` | `!= payload.seller_id` | ERROR `ABAC: You can only access your own resources` |
| `seller` | `Order` | `mutation` | cualquiera | ERROR `ABAC: Sellers cannot create or modify Orders directly` |
| `seller` | otros | cualquiera | cualquiera | ERROR `ABAC: Sellers cannot access resource '<res>'` |
| `customer` | `Order` | `query` | ausente | OK Permitido (resolver valida internamente) |
| `customer` | `Order` | `query` | `== payload.customer_id` | OK Permitido |
| `customer` | `Order` | `query` | `!= payload.customer_id` | ERROR `ABAC: You can only access your own resources` |
| `customer` | `Order` | `mutation` | ausente | OK Permitido (resolver valida internamente) |
| `customer` | `Order` | `mutation` | `== payload.customer_id` | OK Permitido |
| `customer` | `Order` | `mutation` | `!= payload.customer_id` | ERROR `ABAC: You can only access your own resources` |
| `customer` | `Product` | `query` | cualquiera | OK Permitido |
| `customer` | `Seller` | `query` | cualquiera | OK Permitido |
| `customer` | `Product` | `mutation` | cualquiera | ERROR `ABAC: Customers cannot modify 'Product'` |
| `customer` | `Seller` | `mutation` | cualquiera | ERROR `ABAC: Customers cannot modify 'Seller'` |
| `customer` | `Customer` | cualquiera | cualquiera | ERROR `ABAC: Customers cannot access Customer records` |

---

## 7. Ataques Cubiertos por el Experimento (Escenarios BA)

| Código | Descripción | Dónde se maneja | Resultado en T4 |
|---|---|---|---|
| BA-01 | JWT expirado (TTL 15 min) | `JwtStrategy` — error genérico de `JwtService.verify` | BLOQUEADO `"Invalid or expired JWT"` -> `401` en ms-data |
| BA-02 | Firma JWT inválida (secret incorrecto) | `JwtStrategy` — error genérico de `JwtService.verify` | BLOQUEADO `"Invalid or expired JWT"` -> `401` en ms-data |
| BA-03 | Token revocado (blacklist) | **No aplica en T4** — sin blacklist | VULNERABLE El token sigue siendo válido hasta expiración |
| BA-04 | Manipulación de claims (alterar rol) | `JwtStrategy` — firma HS256 invalida el token | BLOQUEADO `"Invalid or expired JWT"` |
| BOLA | Acceso a recurso de otro usuario | `AbacGuard` — verifica `resourceOwnerId` vs `payload` | BLOQUEADO `"ABAC: You can only access your own resources"` |

> **Diferencia con T3:** T3 distingue el tipo de error JWT (BA-01 vs BA-02) con mensajes específicos. T4 retorna un mensaje genérico `"Invalid or expired JWT"` para todos los errores de verificación JWT.

---

## 8. Escenarios de Error y Códigos HTTP

| Escenario | Error retornado | HTTP en ms-data |
|---|---|---|
| Credencial ausente en ms-data | — (previo al llamado) | `401` |
| JWT inválido / expirado / malformado | `"Invalid or expired JWT"` | `401` |
| Acción prohibida por ABAC (rol) | mensaje `"ABAC: ..."` | `403` |
| Acceso a recurso ajeno (ownership) | `"ABAC: You can only access your own resources"` | `403` |
| ms-auth no disponible | `"Auth service unavailable"` | `401` |

> **Interpretación del error por ms-data:** si `error` contiene `"abac"` o `"forbidden"` (case-insensitive) -> ms-data responde `403`; cualquier otro error -> ms-data responde `401`.

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
               ms-auth verifica JWT + aplica ABAC -> { isValid, payload | error }
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

> `synchronize: false` — TypeORM **no** crea ni modifica las tablas automáticamente. Las tablas deben existir previamente en la BD (compartida con el dataset Olist). La tabla `api_keys` solo se consulta en `/auth/token`; la validación en `/auth/validate` es enteramente stateless sobre el JWT.

---

## 11. Datos de Seed (SeedService)

El `SeedService` se ejecuta en `OnApplicationBootstrap` y solo inserta datos si `users` está vacía.

> **Nota:** T4 tiene un conjunto de seed **reducido** respecto a T2 y T3. Solo incluye 4 usuarios activos y 2 API Keys expiradas (sin keys revocadas).

### Usuarios con API Keys válidas

| Username | Rol | customer_id (Olist) | seller_id (Olist) | API Key (texto plano) |
|---|---|---|---|---|
| `admin` | `admin` | — | — | `tesis-admin-key-2026` |
| `seller01` | `seller` | — | `3442f8959a84dea7ee197c632cb2df15` | `tesis-seller01-key-2026` |
| `customer01` | `customer` | `9ef432eb6251297304e76186b10a928d` | — | `tesis-customer01-key-2026` |
| `customer02` | `customer` | `ed0271e0b7da060a393796590e7b737a` | — | `tesis-customer02-key-2026` |

### API Keys expiradas (`is_active=true`, `expires_at` pasada — 2026-06)

| Customer | API Key (texto plano) | Fecha de expiración |
|---|---|---|
| `customer01` | `tesis-customer01-EXPIRED-key-2026` | 2026-06-01 |
| `customer02` | `tesis-customer02-EXPIRED-key-2026` | 2026-06-01 |

> A diferencia de T2 y T3, T4 **no incluye keys revocadas** (`is_active=false`) en su seed.

---

## 12. Estructura de Directorios

```
T4/
|-- .env                              # Variables de entorno
|-- nest-cli.json
|-- package.json                      # Nombre: "ms-auth" | pnpm
|-- tsconfig.json
`-- src/
    |-- main.ts                       # Bootstrap — escucha en PORT (default 3104)
    |-- app.module.ts                 # Módulo raíz: TypeORM, JwtModule, strategy, guard, seed
    |-- auth-core/
    |   |-- auth.controller.ts        # POST /auth/token + POST /auth/validate
    |   |-- index.ts                  # Barrel exports
    |   |-- entities/
    |   |   |-- user.entity.ts        # Tabla users
    |   |   `-- api-key.entity.ts     # Tabla api_keys
    |   |-- strategies/
    |   |   `-- jwt.strategy.ts       # Autentica: verifica firma JWT (respuesta genérica)
    |   |-- guards/
    |   |   `-- abac.guard.ts         # Autoriza: role x resource x action + ownership check
    |   `-- seeds/
    |       `-- seed.service.ts       # Inserta 4 usuarios + 2 keys expiradas al arrancar
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
|-- AbacGuard       (token: 'IAuthGuard')
`-- SeedService     (OnApplicationBootstrap)
```

---

## 14. Consideraciones de Integración para ms-data

- **URL base:** `http://localhost:3104` (configurable en `ms-data/.env` con `MS_AUTH_URL`)
- **Endpoints consumidos por ms-data:** `POST /auth/validate` (el único llamado internamente)
- **Endpoint para clientes de prueba:** `POST /auth/token` (no es llamado por ms-data)
- **Credencial esperada en `/auth/validate`:** JWT en texto plano, extraído del header `Authorization: Bearer <token>` por ms-data
- **`resourceOwnerId`:** Se envía desde ms-data y **T4 sí lo evalúa** — si está presente, verifica que coincida con el `customer_id` (para customers) o `seller_id` (para sellers) del payload JWT; de lo contrario, deniega el acceso
- **Interpretación del error por ms-data:**
  - `error` contiene `"abac"` o `"forbidden"` -> ms-data responde `403`
  - Cualquier otro error -> ms-data responde `401`
- **Arranque:** el servicio usa BD solo para el seed inicial — requiere PostgreSQL activo; la validación JWT es stateless
- **Diferencia clave vs T2:** T2 autentica con API Key opaca (SHA-256); T4 autentica con JWT — ambos usan ABAC (mitigan BOLA)
- **Diferencia clave vs T3:** T3 usa JWT + RBAC (vulnerable a BOLA); T4 usa JWT + ABAC (mitiga BOLA)
- **Diferencia clave vs T6:** T6 agrega revocación de tokens (blacklist JWT) sobre la base de T4; T4 no tiene blacklist
- **Payload retornado:** La `JwtStrategy` de T4 no incluye `user_id` en el payload — solo retorna `role`, `customer_id` y `seller_id`, que son suficientes para que el `AbacGuard` opere
