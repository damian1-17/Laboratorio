# ms-data — Documento de Arquitectura

> **Propósito:** Microservicio de datos del experimento de tesis. Expone un API GraphQL protegido que permite consultar y crear órdenes del dataset Olist e-commerce. Delega toda la autenticación/autorización al microservicio `ms-auth`.

---

## 1. Stack Tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Runtime | Node.js | ≥ 18 |
| Framework | NestJS | ^10 |
| Lenguaje | TypeScript | ^5.1 |
| API | GraphQL (Apollo Driver) | ^16 / ^12 |
| ORM | TypeORM | ^0.3 |
| Base de datos | PostgreSQL | 14+ |
| HTTP Client | `@nestjs/axios` + Axios | ^3 / ^1.4 |
| Package manager | pnpm | workspace |

---

## 2. Variables de Entorno (`.env`)

```env
PORT=3001                          # Puerto en que escucha el servicio
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=123
DB_DATABASE=experiment_tesis       # Base de datos PostgreSQL
MS_AUTH_URL=http://localhost:3101  # URL base de ms-auth
```

> **Nota para otros microservicios:** `ms-data` no emite tokens ni valida credenciales por sí mismo. Toda solicitud de autenticación se reenvía a `MS_AUTH_URL`.

---

## 3. Endpoint Principal

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/graphql` | Único punto de entrada GraphQL (Apollo) |

El middleware de autenticación (`AuthMiddleware`) se aplica **exclusivamente** sobre `/graphql`. No existen rutas REST públicas.

### Cabeceras requeridas en cada request

```http
# Opción A — API Key
X-Api-Key: <api_key>

# Opción B — Bearer Token (OAuth 2.0 / JWT)
Authorization: Bearer <token>
```

Si ninguna cabecera está presente, la petición es rechazada con `401 Unauthorized`.

---

## 4. Operaciones GraphQL

### 4.1 Query — `getOrder`

Recupera una orden por su ID junto con la información del cliente propietario.

```graphql
query {
  getOrder(order_id: "<uuid>") {
    orderId
    customerId
    orderStatus
    orderPurchaseTimestamp
    orderApprovedAt
    orderDeliveredCarrierDate
    orderDeliveredCustomerDate
    orderEstimatedDeliveryDate
    customer {
      customerId
      customerUniqueId
      customerCity
      customerState
    }
  }
}
```

**Parámetros:**

| Nombre | Tipo | Requerido | Descripción |
|---|---|---|---|
| `order_id` | `String` | ✅ | UUID de la orden a recuperar |

**Respuesta:** Objeto `Order` (nullable) con relación `Customer` eager-loaded.

**Comprobación BOLA en middleware:**
- Se consulta en DB el `customer_id` propietario de la orden.
- Se envía `resourceOwnerId` a `ms-auth` para validar que el solicitante tiene acceso a ese recurso.

---

### 4.2 Mutation — `createOrder`

Crea una nueva orden asociada a un cliente.

```graphql
mutation {
  createOrder(
    customer_id: "<customer_uuid>"
    product_ids: ["<product_uuid>", "..."]
    seller_id: "<seller_uuid>"
  ) {
    orderId
    customerId
    orderStatus
    orderPurchaseTimestamp
  }
}
```

**Parámetros:**

| Nombre | Tipo | Requerido | Descripción |
|---|---|---|---|
| `customer_id` | `String` | ✅ | ID del cliente que realiza la orden |
| `product_ids` | `[String]` | ✅ | Lista de IDs de productos |
| `seller_id` | `String` | ✅ | ID del vendedor |

**Comportamiento actual:**
- Genera un `orderId` con `randomUUID()`.
- Persiste la orden con estado `"created"` y timestamp actual.
- `product_ids` y `seller_id` se reciben pero **aún no se persisten** en `order_items` (implementación pendiente).

**Comprobación BOLA en middleware:**
- `resourceOwnerId` se establece igual al `customer_id` del argumento.
- Se valida con `ms-auth` antes de ejecutar la mutación.

---

## 5. Flujo de Autenticación / Autorización

```
Cliente
  │
  ▼
POST /graphql  ── AuthMiddleware (NestJS) ────────────────────────────────┐
  │                                                                        │
  │  1. Extrae credencial (X-Api-Key o Bearer token)                      │
  │  2. Parsea el body GraphQL → infiere {action, resource, id, owner}    │
  │  3. Consulta DB si necesita resolver resourceOwnerId (getOrder)       │
  │  4. POST http://ms-auth:3101/auth/validate ─────────────────────────►│
  │                                                          ms-auth       │
  │  5. Recibe AuthPayload ◄────────────────────────────────────────────-┘
  │     { isValid, user_id, role, customer_id, seller_id, api_key_id }
  │
  ├── isValid = false → 401 Unauthorized / 403 Forbidden
  └── isValid = true  → req.user = payload → DataResolver
```

### Payload propagado al contexto GraphQL (`req.user`)

```typescript
type AuthPayload = {
  isValid: boolean;
  user_id?: string;
  role?: string;
  customer_id?: string;
  seller_id?: string;
  api_key_id?: string;
  error?: string;
};
```

Este objeto está disponible en todos los resolvers a través del contexto:
```typescript
@Context() ctx: { user: AuthPayload }
```

---

## 6. Integración con ms-auth

### Endpoint consumido

```
POST http://<MS_AUTH_URL>/auth/validate
Content-Type: application/json
```

### Request Body (ValidateRequestDto)

```typescript
{
  credential: string;        // API Key o JWT/OAuth token (sin "Bearer ")
  action?: string;           // "query" | "mutation"
  resource?: string;         // "Order" | "Product" | "Customer" | "Seller"
  resourceOwnerId?: string;  // customer_id propietario del recurso (BOLA check)
  graphqlOperation?: string; // (reservado, no usado actualmente)
}
```

### Response Body (AuthPayload)

```typescript
{
  isValid: boolean;
  user_id?: string;
  role?: string;
  customer_id?: string;
  seller_id?: string;
  api_key_id?: string;
  error?: string;            // Mensaje si isValid = false
}
```

### Lógica de error en ms-data

| Condición en `error` | Excepción HTTP |
|---|---|
| Contiene `"forbidden"`, `"rbac"`, `"abac"` o `"only"` | `403 ForbiddenException` |
| Cualquier otro error | `401 UnauthorizedException` |
| ms-auth no disponible | `401` con mensaje `"Auth service unavailable"` |

---

## 7. Modelo de Datos

### Entidades TypeORM / GraphQL ObjectTypes

#### `Order` → tabla `orders`

| Campo TS | Columna DB | Tipo | Descripción |
|---|---|---|---|
| `orderId` | `order_id` | `varchar(50)` PK | UUID de la orden |
| `customerId` | `customer_id` | `varchar(50)` | FK → customers |
| `orderStatus` | `order_status` | `varchar(30)` | Estado de la orden |
| `orderPurchaseTimestamp` | `order_purchase_timestamp` | `timestamp` | Fecha de compra |
| `orderApprovedAt` | `order_approved_at` | `timestamp` | Fecha de aprobación |
| `orderDeliveredCarrierDate` | `order_delivered_carrier_date` | `timestamp` | Entrega a carrier |
| `orderDeliveredCustomerDate` | `order_delivered_customer_date` | `timestamp` | Entrega al cliente |
| `orderEstimatedDeliveryDate` | `order_estimated_delivery_date` | `timestamp` | Fecha estimada |
| `customer` | — | `Customer` | Relación ManyToOne |

#### `Customer` → tabla `customers`

| Campo TS | Columna DB | Tipo |
|---|---|---|
| `customerId` | `customer_id` | `varchar(50)` PK |
| `customerUniqueId` | `customer_unique_id` | `varchar(50)` |
| `customerZipCodePrefix` | `customer_zip_code_prefix` | `varchar(10)` |
| `customerCity` | `customer_city` | `varchar(100)` |
| `customerState` | `customer_state` | `char(2)` |

#### `Product` → tabla `products`

| Campo TS | Columna DB | Tipo |
|---|---|---|
| `productId` | `product_id` | `varchar(50)` PK |
| `productCategoryName` | `product_category_name` | `varchar(100)` |
| `productNameLenght` | `product_name_lenght` | `int` |
| `productDescriptionLenght` | `product_description_lenght` | `int` |
| `productPhotosQty` | `product_photos_qty` | `int` |
| `productWeightG` | `product_weight_g` | `numeric(10,2)` |

#### `Seller` → tabla `sellers`

| Campo TS | Columna DB | Tipo |
|---|---|---|
| `sellerId` | `seller_id` | `varchar(50)` PK |
| `sellerZipCodePrefix` | `seller_zip_code_prefix` | `varchar(10)` |
| `sellerCity` | `seller_city` | `varchar(100)` |
| `sellerState` | `seller_state` | `char(2)` |

#### `OrderItem` → tabla `order_items`

| Campo TS | Columna DB | Tipo |
|---|---|---|
| `orderId` | `order_id` | `varchar(50)` PK compuesta |
| `orderItemId` | `order_item_id` | `int` PK compuesta |
| `productId` | `product_id` | `varchar(50)` |
| `sellerId` | `seller_id` | `varchar(50)` |
| `price` | `price` | `numeric(10,2)` |

> La BD opera en modo `synchronize: false` — el schema es gestionado externamente (dataset Olist pre-cargado).

---

## 8. Estructura de Directorios

```
ms-data/
├── .env                          # Variables de entorno
├── nest-cli.json
├── package.json                  # Dependencias (pnpm)
├── tsconfig.json
└── src/
    ├── main.ts                   # Bootstrap — escucha en PORT (default 3001)
    ├── app.module.ts             # Módulo raíz: TypeORM, GraphQL, middlewares
    ├── auth-http.module.ts       # Módulo HttpModule para llamar a ms-auth
    ├── auth-http.service.ts      # AuthHttpService — POST /auth/validate
    ├── data-core/
    │   ├── auth.middleware.ts    # AuthMiddleware — extrae cred, BOLA check, llama ms-auth
    │   ├── data.module.ts        # Importa todas las entidades TypeORM
    │   ├── data.resolver.ts      # GraphQL Resolver (getOrder, createOrder)
    │   ├── data.service.ts       # Lógica de negocio — consultas TypeORM
    │   ├── index.ts              # Barrel exports
    │   └── entities/
    │       ├── order.entity.ts
    │       ├── order-item.entity.ts
    │       ├── customer.entity.ts
    │       ├── product.entity.ts
    │       └── seller.entity.ts
    └── shared/
        ├── index.ts              # Barrel exports
        ├── auth/
        │   ├── auth-payload.type.ts      # Tipo AuthPayload
        │   └── auth-strategy.interface.ts
        └── dtos/
            ├── validate-request.dto.ts   # DTO enviado a ms-auth
            └── validate-response.dto.ts  # DTO recibido de ms-auth
```

---

## 9. Módulos NestJS

```
AppModule
├── ConfigModule (global)
├── TypeOrmModule (PostgreSQL)
├── GraphQLModule (Apollo, autoSchemaFile)
├── DataModule
│   ├── TypeOrmModule.forFeature([Customer, Seller, Order, Product, OrderItem])
│   ├── DataService
│   └── DataResolver
└── AuthHttpModule
    ├── HttpModule
    └── AuthHttpService (alias: 'AUTH_HTTP_SERVICE')

Middleware: AuthMiddleware → aplicado a todas las rutas /graphql
```

---

## 10. Consumo de ms-data — Combinaciones de Mecanismos de Seguridad

El experimento evalúa **6 combinaciones** de control de acceso × credencial para consumir `POST /graphql`. En todos los casos ms-data delega la validación a `ms-auth`; la diferencia está en qué tipo de credencial se envía y qué modelo de autorización aplica ms-auth.

### Matriz de combinaciones

| # | Control de Acceso | Credencial | Cabecera HTTP |
|---|---|---|---|
| T1 | RBAC | API Key | `X-Api-Key: <key>` |
| T2 | ABAC | API Key | `X-Api-Key: <key>` |
| T3 | RBAC | JWT | `Authorization: Bearer <jwt>` |
| T4 | ABAC | JWT | `Authorization: Bearer <jwt>` |
| T5 | RBAC | OAuth 2.0 | `Authorization: Bearer <access_token>` |
| T6 | ABAC | OAuth 2.0 | `Authorization: Bearer <access_token>` |

### Cómo hacer una petición según cada combinación

#### T1 / T2 — API Key (RBAC o ABAC)

```http
POST http://localhost:3001/graphql
Content-Type: application/json
X-Api-Key: <api_key_registrada_en_ms_auth>

{ "query": "query { getOrder(order_id: \"<uuid>\") { orderId orderStatus } }" }
```

- La API Key es opaca; ms-auth resuelve el rol (RBAC) o los atributos (ABAC) del portador.
- No requiere flujo de obtención de token previo.

#### T3 / T4 — JWT (RBAC o ABAC)

```http
POST http://localhost:3001/graphql
Content-Type: application/json
Authorization: Bearer <jwt_firmado_con_JWT_SECRET>

{ "query": "query { getOrder(order_id: \"<uuid>\") { orderId orderStatus } }" }
```

- El JWT debe haber sido emitido por ms-auth y firmado con `JWT_SECRET`.
- ms-auth decodifica el payload para extraer `role` (RBAC) o atributos (ABAC).

#### T5 / T6 — OAuth 2.0 Access Token (RBAC o ABAC)

```http
POST http://localhost:3001/graphql
Content-Type: application/json
Authorization: Bearer <oauth_access_token>

{ "query": "mutation { createOrder(customer_id: \"<uuid>\", product_ids: [\"<uuid>\"], seller_id: \"<uuid>\") { orderId orderStatus } }" }
```

- El `access_token` es obtenido previamente del flujo OAuth 2.0 en ms-auth.
- ms-auth verifica la firma con `OAUTH_SECRET` y aplica RBAC o ABAC según el tratamiento.

### Comportamiento de ms-data (constante en las 6 combinaciones)

1. Extrae la credencial del header (`X-Api-Key` o `Bearer`).
2. Parsea el body GraphQL → infiere `action`, `resource`, `resourceOwnerId`.
3. `POST ms-auth:3101/auth/validate` con `ValidateRequestDto`.
4. Si `isValid = false` → `401` o `403` según el tipo de error.
5. Si `isValid = true` → ejecuta el resolver con `req.user = AuthPayload`.

> **ms-data no distingue entre combinaciones**; la lógica diferencial reside íntegramente en ms-auth.

### Contexto del experimento (Tesis)

- ms-data es el **recurso protegido** común a los 6 tratamientos del experimento.
- Está diseñado para ser atacado/probado con patrones BOLA (Broken Object Level Authorization).
- El middleware registra logs de debug con `Logger` de NestJS para trazabilidad de los checks de autorización.
