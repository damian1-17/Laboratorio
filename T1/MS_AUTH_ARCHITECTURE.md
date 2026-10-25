# ms-auth T1 — Documento de Arquitectura

> **Tratamiento:** T1 — **RBAC + API Key**
> **Propósito:** Microservicio de autenticación y autorización para el tratamiento T1 del experimento de tesis. Recibe solicitudes de validación desde `ms-data`, autentica la credencial (API Key) y aplica control de acceso basado en roles (RBAC) para decidir si la operación está permitida.

---

## 1. Contexto del Experimento

| Campo | Valor |
|---|---|
| Tratamiento | T1 |
| Mecanismo de autenticación | API Key (opaca, hash SHA-256) |
| Mecanismo de autorización | RBAC puro (solo verifica rol) |
| Vector de vulnerabilidad | BOLA (API1:2023) — RBAC no verifica propiedad del objeto |
| Directorio del código | `experiment/T1/` |

---

## 2. Stack Tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Runtime | Node.js | ≥ 18 |
| Framework | NestJS | ^10 |
| Lenguaje | TypeScript | ^5.1 |
| API | REST (Express) | — |
| ORM | TypeORM | ^0.3 |
| Base de datos | PostgreSQL | 14+ |
| Hashing | Node.js `crypto` (SHA-256) | nativo |
| Package manager | pnpm | workspace |

---

## 3. Variables de Entorno (`.env`)

```env
PORT=3101                           # Puerto en que escucha el servicio
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=123
DB_DATABASE=experiment_tesis        # Base de datos PostgreSQL
JWT_SECRET=my-super-secret-key-for-jwt    # Reservado (no usado en T1)
OAUTH_SECRET=my-super-secret-key-for-oauth  # Reservado (no usado en T1)
```

> En T1 solo se usan las variables de BD. `JWT_SECRET` y `OAUTH_SECRET` están presentes para mantener paridad de entorno con otros tratamientos pero no son consumidas.

---

## 4. Endpoint

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/auth/validate` | Valida credencial y aplica RBAC |

Este es el **único endpoint** del servicio. Es consumido exclusivamente por `ms-data` a través de `AuthHttpService`.

### Request Body

```typescript
// ValidateRequestDto
{
  credential: string;        // API Key en texto plano (sin prefijo)
  action?: string;           // "query" | "mutation"
  resource?: string;         // "Order" | "Product" | "Customer" | "Seller"
  resourceOwnerId?: string;  // customer_id propietario del recurso (ignorado en RBAC)
  graphqlOperation?: string; // Reservado, no usado actualmente
}
```

### Response Body

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
  user_id: string;         // UUID interno del usuario
  role: string;            // "admin" | "seller" | "customer"
  customer_id?: string;    // customer_id del dataset Olist (si aplica)
  seller_id?: string;      // seller_id del dataset Olist (si aplica)
  api_key_id: string;      // UUID de la API Key usada
}
```

### Ejemplo de request

```http
POST http://localhost:3101/auth/validate
Content-Type: application/json

{
  "credential": "tesis-customer01-key-2026",
  "action": "query",
  "resource": "Order",
  "resourceOwnerId": "9ef432eb6251297304e76186b10a928d"
}
```

### Ejemplo de response exitosa

```json
{
  "isValid": true,
  "payload": {
    "isValid": true,
    "user_id": "<uuid>",
    "role": "customer",
    "customer_id": "9ef432eb6251297304e76186b10a928d",
    "api_key_id": "<uuid>"
  }
}
```

### Ejemplo de response fallida

```json
{
  "isValid": false,
  "error": "API Key expired"
}
```

---

## 5. Flujo Interno de Validación

```
ms-data → POST /auth/validate
              │
              ▼
        AuthController
              │
              ├─── PASO 1: ApiKeyStrategy.validate(credential)
              │         │
              │         │  SHA-256(credential) → busca en tabla api_keys
              │         │
              │         ├── Hash no encontrado  → { isValid: false, error: "Invalid API Key" }
              │         ├── is_active = false   → { isValid: false, error: "API Key revoked" }
              │         ├── expires_at < now()  → { isValid: false, error: "API Key expired" }
              │         └── OK                  → { isValid: true, user_id, role, ... }
              │
              ├─── (si isValid=false) → return { isValid: false, error }
              │
              └─── PASO 2: RbacGuard.canActivate(mockContext)
                        │
                        │  Evalúa: role × resource × action
                        │
                        ├── role = "admin"    → ALLOW (acceso total)
                        ├── role = "seller"   → ver tabla de permisos
                        ├── role = "customer" → ver tabla de permisos
                        └── role desconocido  → ForbiddenException
```

---

## 6. Tabla de Permisos RBAC

| Rol | Resource | Action | Resultado |
|---|---|---|---|
| `admin` | cualquiera | cualquiera | ✅ Permitido |
| `seller` | `Product` | `query` | ✅ Permitido |
| `seller` | `Product` | `mutation` | ✅ Permitido |
| `seller` | `Order` | `query` | ✅ Permitido |
| `seller` | `Order` | `mutation` | ❌ `RBAC: Sellers cannot create or modify Orders directly` |
| `seller` | otros | cualquiera | ❌ `RBAC: Sellers cannot access resource '<res>'` |
| `customer` | `Order` | `query` | ✅ Permitido ⚠️ **Sin verificar propiedad — vector BOLA** |
| `customer` | `Order` | `mutation` | ✅ Permitido ⚠️ **Sin verificar propiedad — vector BOLA** |
| `customer` | `Product` | `query` | ✅ Permitido |
| `customer` | `Seller` | `query` | ✅ Permitido |
| `customer` | `Product` | `mutation` | ❌ `RBAC: Customers cannot modify 'Product'` |
| `customer` | `Seller` | `mutation` | ❌ `RBAC: Customers cannot modify 'Seller'` |
| `customer` | `Customer` | cualquiera | ❌ `RBAC: Customers cannot access Customer records` |

> ⚠️ **Nota crítica:** El `RbacGuard` **ignora completamente `resourceOwnerId`**. Un `customer` con credencial válida puede consultar o crear órdenes de cualquier otro customer. Esta es la vulnerabilidad BOLA (API1:2023) que el tratamiento T1 deja expuesta intencionalmente.

---

## 7. Escenarios de Error y Códigos HTTP

| Escenario | Error retornado | HTTP en ms-data |
|---|---|---|
| Credencial ausente en ms-data | — (previo al llamado) | `401` |
| API Key no registrada | `"Invalid API Key"` | `401` |
| API Key revocada (`is_active=false`) | `"API Key revoked"` | `401` |
| API Key expirada (`expires_at` pasada) | `"API Key expired"` | `401` |
| Acción prohibida por RBAC | mensaje `"RBAC: ..."` | `403` |
| ms-auth no disponible | `"Auth service unavailable"` | `401` |

---

## 8. Modelo de Datos

### `User` → tabla `users` (`synchronize: true`)

| Campo | Tipo | Descripción |
|---|---|---|
| `user_id` | `uuid` PK | Generado automáticamente |
| `username` | `varchar` unique | Nombre de usuario |
| `role` | `varchar` | `"admin"` \| `"seller"` \| `"customer"` |
| `seller_id` | `varchar` nullable | FK lógica a `sellers.seller_id` del dataset Olist |
| `customer_id` | `varchar` nullable | FK lógica a `customers.customer_id` del dataset Olist |
| `created_at` | `timestamp` | Auto-generado |

### `ApiKey` → tabla `api_keys` (`synchronize: true`)

| Campo | Tipo | Descripción |
|---|---|---|
| `api_key_id` | `uuid` PK | Generado automáticamente |
| `key_hash` | `varchar` unique | SHA-256 del valor real de la API Key |
| `user_id` | `varchar` | FK → `users.user_id` |
| `is_active` | `boolean` default `true` | `false` = revocada |
| `created_at` | `timestamp` | Auto-generado |
| `expires_at` | `timestamp` nullable | `null` = sin expiración |

> `synchronize: true` — TypeORM crea/actualiza las tablas automáticamente al arrancar.

---

## 9. Datos de Seed (SeedService)

El `SeedService` se ejecuta en `OnApplicationBootstrap` y solo inserta datos si `users` está vacía. Crea los siguientes usuarios y API Keys:

### Usuarios con API Keys válidas

| Username | Rol | customer_id (Olist) | seller_id (Olist) | API Key (texto plano) |
|---|---|---|---|---|
| `admin` | `admin` | — | — | `tesis-admin-key-2026` |
| `seller01` | `seller` | — | `3442f8959a84dea7ee197c632cb2df15` | `tesis-seller01-key-2026` |
| `customer01` | `customer` | `9ef432eb6251297304e76186b10a928d` | — | `tesis-customer01-key-2026` |
| `customer02` | `customer` | `ed0271e0b7da060a393796590e7b737a` | — | `tesis-customer02-key-2026` |
| `customer3` | `customer` | `8886130db0ea6e9e70ba0b03d7c0d286` | — | `tesis-customer03-key-2026` |
| `customer4` | `customer` | `6d6b50b66d79f80827b6d96751528d30` | — | `tesis-customer04-key-2026` |
| `customer5` | `customer` | `65a227fbf7d798cdeadee8c0bea74993` | — | `tesis-customer05-key-2026` |

### API Keys expiradas (`is_active=true`, `expires_at` pasada — 2026-06/07)

| Customer | API Key (texto plano) |
|---|---|
| `customer01` | `tesis-customer01-EXPIRED-key-2026` |
| `customer02` | `tesis-customer02-EXPIRED-key-2026` |
| `customer3` | `tesis-customer03-EXPIRED-key-2026` |
| `customer4` | `tesis-customer04-EXPIRED-key-2026` |
| `customer5` | `tesis-customer05-EXPIRED-key-2026` |

### API Keys revocadas (`is_active=false`, `expires_at` 2027)

| Customer | API Key (texto plano) |
|---|---|
| `customer01` | `tesis-customer01-REVOKED-key-2026` |
| `customer02` | `tesis-customer02-REVOKED-key-2026` |
| `customer3` | `tesis-customer03-REVOKED-key-2026` |
| `customer4` | `tesis-customer04-REVOKED-key-2026` |
| `customer5` | `tesis-customer05-REVOKED-key-2026` |

---

## 10. Estructura de Directorios

```
T1/
├── .env                              # Variables de entorno
├── nest-cli.json
├── package.json                      # Nombre: "ms-auth" | pnpm
├── tsconfig.json
└── src/
    ├── main.ts                       # Bootstrap — escucha en PORT (default 3101)
    ├── app.module.ts                 # Módulo raíz: TypeORM, estrategia, guard, seed
    ├── auth-core/
    │   ├── auth.controller.ts        # POST /auth/validate → orquesta strategy + guard
    │   ├── index.ts                  # Barrel exports
    │   ├── entities/
    │   │   ├── user.entity.ts        # Tabla users
    │   │   └── api-key.entity.ts     # Tabla api_keys
    │   ├── strategies/
    │   │   └── api-key.strategy.ts   # Autentica: SHA-256 hash lookup en DB
    │   ├── guards/
    │   │   └── rbac.guard.ts         # Autoriza: role × resource × action (sin BOLA check)
    │   └── seeds/
    │       └── seed.service.ts       # Inserta usuarios y keys al arrancar
    └── shared/
        ├── index.ts                  # Barrel exports
        ├── auth/
        │   ├── auth-payload.type.ts          # Tipo AuthPayload
        │   └── auth-strategy.interface.ts    # Interface IAuthStrategy
        └── dtos/
            ├── validate-request.dto.ts       # DTO de entrada de /auth/validate
            └── validate-response.dto.ts      # DTO de salida de /auth/validate
```

---

## 11. Módulos NestJS

```
AppModule
├── ConfigModule (global)
├── TypeOrmModule (PostgreSQL, synchronize: true)
│   └── forFeature([ApiKey, User])
├── AuthController  (POST /auth/validate)
├── ApiKeyStrategy  (token: 'IAuthStrategy')
├── RbacGuard       (token: 'IAuthGuard')
└── SeedService     (OnApplicationBootstrap)
```

---

## 12. Consideraciones de Integración para ms-data

- **URL base:** `http://localhost:3101` (configurable en `ms-data/.env` con `MS_AUTH_URL`)
- **Único endpoint consumido:** `POST /auth/validate`
- **Credencial esperada:** API Key en texto plano, extraída del header `X-Api-Key` por ms-data (sin prefijo)
- **`resourceOwnerId`:** Se envía desde ms-data pero **T1 lo ignora** — no realizar comprobación de ownership en RBAC
- **Interpretación del error por ms-data:**
  - `error` contiene `"rbac"` o `"forbidden"` → ms-data responde `403`
  - Cualquier otro error → ms-data responde `401`
- **Arranque:** el servicio es stateful en BD — requiere PostgreSQL activo y ejecuta el seed automáticamente en el primer arranque
