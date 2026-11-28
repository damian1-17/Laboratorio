# Documento Maestro de Contexto de Investigación y Referencia Técnica

> **Propósito del documento:**  
> Este documento consolida de manera exhaustiva, estructurada y técnica todo el contexto de la tesis, la arquitectura del sistema, el diseño experimental, la implementación en Postman y código fuente, el diccionario de variables y las reglas operacionales de evaluación estadística. Funciona como **memoria técnica de referencia autosuficiente** para interpretar resultados experimentales y ejecutar futuros análisis sin reprocesar los archivos originales.

---

## 1. Contexto General de la Tesis

### 1.1. Tema
**Estudio comparativo de mecanismos de autenticación y autorización en APIs GraphQL dentro de arquitecturas de microservicios.**

### 1.2. Planteamiento del Problema
La combinación de la arquitectura de microservicios con GraphQL introduce importantes retos de seguridad. A diferencia de las APIs REST tradicionales (donde cada recurso se asocia a una URL y verbo HTTP específico), GraphQL expone un **endpoint único (`POST /graphql`)**, delegando la resolución de entidades y atributos a resolvers anidados. Esta flexibilidad:
- Invalida los controles perimetrales tradicionales de red o de API Gateway basados en paths/rutas HTTP.
- Traslada la complejidad computacional y de seguridad al servidor.
- Deja la superficie expuesta a ataques como **Broken Object Level Authorization (BOLA / OWASP API1:2023)** y **Broken Authentication (OWASP API2:2023)** si no se verifica la propiedad de los recursos a nivel de resolver/atributo.
- Existe una brecha en la literatura empírica: la mayoría de estudios sobre RBAC vs. ABAC y mecanismos de identidad (API Keys, JWT, OAuth 2.0) se han formulado a nivel teórico o sobre arquitecturas REST, sin mediciones cuantitativas experimentales controladas en entornos GraphQL.

### 1.3. Objetivos
- **Objetivo General:** Comparar los mecanismos de autenticación y autorización en APIs GraphQL dentro de arquitecturas de microservicios.
- **Objetivos Específicos:**
  1. *OE1:* Caracterizar los principales mecanismos de autenticación (API Keys, JWT, OAuth 2.0) y autorización (RBAC, ABAC) utilizados en APIs GraphQL.
  2. *OE2:* Diseñar un entorno experimental de microservicios con GraphQL para evaluar la eficacia de los mecanismos de seguridad de autenticación y autorización.
  3. *OE3:* Analizar los resultados cuantitativos de la ejecución del entorno experimental frente a vectores de ataque controlados.

### 1.4. Preguntas de Investigación (GQM)
- **PI1:** ¿Cuál mecanismo de autenticación (API Keys, JWT u OAuth 2.0) presenta la mayor tasa de bloqueo frente a ataques de Broken Authentication (OWASP API2:2023) en una API GraphQL sobre microservicios?
- **PI2:** ¿Cuál modelo de autorización (RBAC o ABAC) presenta la mayor tasa de bloqueo frente a ataques de Broken Object Level Authorization (OWASP API1:2023) en una API GraphQL sobre microservicios?
- **PI3:** ¿Qué combinación de mecanismo de autenticación y modelo de autorización (tratamientos T1 a T6) ofrece la mayor eficacia de seguridad global?

### 1.5. Alcance y Delimitación
- **Entorno:** Laboratorio local controlado con servicios independientes contenerizables.
- **Dataset:** *Brazilian E-Commerce Public Dataset* (Olist), con datos reales de e-commerce (órdenes, clientes, productos, vendedores, pagos).
- **Operaciones GraphQL evaluadas:** 
  - Lectura: Query `getOrder(order_id: String!)`
  - Escritura: Mutation `createOrder(customer_id: String!, product_ids: [String!]!, seller_id: String!)`

---

## 2. Arquitectura Tecnológica del Entorno Experimental

El sistema experimental está compuesto por dos microservicios principales desacoplados y una base de datos relacional PostgreSQL.

```
                      +---------------------------------------+
                      |         Cliente / Postman             |
                      +---------------------------------------+
                                          |
                   [POST /graphql con Credencial en Header]
                   (x-api-key: ...  o  Authorization: Bearer ...)
                                          v
+---------------------------------------------------------------------------------+
| MS-DATA (Puerto 3001)                                                           |
|                                                                                 |
|  1. AuthMiddleware intercepta POST /graphql:                                    |
|     - Extrae credencial (API Key o Bearer Token).                               |
|     - Parsea body GraphQL: identifica operacion ('query' | 'mutation'),         |
|       recurso ('Order', 'Product', etc.), e IDs involucrados.                   |
|     - Si es getOrder: consulta PostgreSQL para obtener el propietario real      |
|       (resourceOwnerId = order.customerId).                                     |
|     - Si es createOrder: extrae customerId del body.                            |
|                                                                                 |
|  2. Solicitud de validacion interna HTTP (POST /auth/validate)                  |
+---------------------------------------------------------------------------------+
                                          |
                      payload: { credential, action, resource, resourceOwnerId }
                                          v
+---------------------------------------------------------------------------------+
| MS-AUTH (Puerto 3101 - 3106 segun Tratamiento T1 a T6)                          |
|                                                                                 |
|  Fase 1: Estrategia de Autenticacion (IAuthStrategy)                            |
|     - T1/T2: ApiKeyStrategy (hash SHA-256 en tabla api_keys)                    |
|     - T3/T4: JwtStrategy (verificacion de firma criptografica HS256)             |
|     - T5/T6: OAuthTokenStrategy (introspeccion de token opaco SHA-256 en BD)     |
|     * Si credencial invalida/expirada/revocada -> isValid: false                |
|                                                                                 |
|  Fase 2: Guard de Autorizacion (CanActivate)                                    |
|     - RbacGuard (T1, T3, T5): evalua SOLO payload.role.                         |
|       No verifica resourceOwnerId -> Permite query Order a customer (BOLA).    |
|     - AbacGuard (T2, T4, T6): evalua payload.role Y compara:                    |
|       resourceOwnerId === payload.customer_id. Si difiere -> 403 Forbidden.     |
+---------------------------------------------------------------------------------+
                                          |
                      Respuesta: { isValid, role, customer_id, error }
                                          v
+---------------------------------------------------------------------------------+
| MS-DATA (Decision final en AuthMiddleware)                                      |
|  - Si isValid == false:                                                         |
|      - Si error contiene 'Forbidden'/'ABAC'/'RBAC' -> HTTP 403                  |
|      - Si error de credencial -> HTTP 401 Unauthorized                          |
|  - Si isValid == true: req.user = payload; next()                               |
|      -> DataResolver -> DataService -> Retorna resultado GraphQL (HTTP 200)     |
+---------------------------------------------------------------------------------+
```

### 2.1. Componentes del Ecosistema

| Componente | Rol en el Experimento | Tecnologías Principales | Puerto |
|---|---|---|:---:|
| **MS-Data** | Microservicio de datos. Expone la API GraphQL protegida (`POST /graphql`). No implementa autenticación propia; delega toda validación a `ms-auth`. | Node.js, NestJS ^10, Apollo GraphQL (Driver), TypeORM ^0.3, Axios | `3001` |
| **MS-Auth** | Microservicio de seguridad. Contiene las estrategias de autenticación y los guards de autorización correspondientes a cada tratamiento experimental. | Node.js, NestJS ^10, TypeORM ^0.3, `@nestjs/jwt`, `crypto` nativo | `3101` a `3106` |
| **PostgreSQL** | Base de datos relacional unificada que almacena el dataset de Olist y las tablas de credenciales (`users`, `api_keys`, `oauth_clients`, `oauth_tokens`). | PostgreSQL 14+, base de datos `olist_ecommerce` o `experiment_tesis` | `5432` |

### 2.2. Flujo de Comunicación Detallado
1. **Cliente envía petición GraphQL a `ms-data`:**
   - URL: `http://localhost:3001/graphql`
   - Encabezado: `x-api-key: <clave>` (T1/T2) o `Authorization: Bearer <token>` (T3-T6).
2. **`AuthMiddleware` en `ms-data`:**
   - Detecta si es `query` o `mutation`.
   - Si la consulta es `getOrder(order_id: "...")`, consulta localmente a la tabla `orders` para extraer el `customerId` del dueño original (`resourceOwnerId`).
   - Envía vía HTTP `POST http://localhost:310X/auth/validate` con:
     ```json
     {
       "credential": "<api_key_o_token>",
       "action": "query",
       "resource": "Order",
       "resourceOwnerId": "9ef432eb6251297304e76186b10a928d"
     }
     ```
3. **`ms-auth` procesa la validación:**
   - *Autenticación:* Valida si la credencial existe, está activa, no ha expirado y su firma/hash es correcta.
   - *Autorización:* Si la credencial es válida, el Guard correspondiente (`RbacGuard` o `AbacGuard`) evalúa permisos.
   - Retorna a `ms-data` el objeto `AuthPayload` con `isValid: true/false` y mensaje de error.
4. **`ms-data` resuelve la respuesta HTTP:**
   - Si no es válido por credencial: responde `HTTP 401 Unauthorized`.
   - Si es rechazado por autorización (violación de rol o propiedad en ABAC): responde `HTTP 403 Forbidden`.
   - Si es válido: el resolver ejecuta la consulta en la BD y responde `HTTP 200 OK` con los datos solicitados.

---

## 3. Diseño Experimental (Metodología Wohlin)

La investigación se rige estrictamente por la metodología de experimentación en ingeniería de software de **Claes Wohlin** (fases: Scoping, Planning, Operation, Analysis & Interpretation, Presentation).

### 3.1. Diseño Factorial 3 × 2
El experimento utiliza un diseño factorial completo con dos factores controlados:

| Factor | Tipo | Niveles |
|---|---|---|
| **Factor A: Autenticación** | Independiente (3 niveles) | A1: API Keys<br>A2: JWT (JSON Web Tokens)<br>A3: OAuth 2.0 (Client Credentials / Tokens Opacos) |
| **Factor B: Autorización** | Independiente (2 niveles) | B1: RBAC (Role-Based Access Control)<br>B2: ABAC (Attribute-Based Access Control) |

Matriz de los 6 tratamientos experimentales:

| Factor Autenticación / Autorización | B1. RBAC | B2. ABAC |
|:---|:---:|:---:|
| **A1. API Keys** | **T1** (API Keys + RBAC) | **T2** (API Keys + ABAC) |
| **A2. JWT** | **T3** (JWT + RBAC) | **T4** (JWT + ABAC) |
| **A3. OAuth 2.0** | **T5** (OAuth 2.0 + RBAC) | **T6** (OAuth 2.0 + ABAC) |

### 3.2. Variables del Experimento
- **Variables Independientes:** Mecanismo de autenticación (API Keys, JWT, OAuth 2.0) y modelo de autorización (RBAC, ABAC).
- **Variable Dependiente:** Eficacia de seguridad, cuantificada mediante las tasas de bloqueo de ataques.
- **Variables de Rendimiento (observables secundarias):** Latencia (ms), tamaño de solicitud (Request Size en bytes), tamaño de respuesta (Response Size en bytes).
- **Variables de Control:** Dataset fijo (Olist), esquema GraphQL fijo, operaciones fijas (`getOrder`, `createOrder`), infraestructura de red local constante, 30 ejecuciones por tratamiento.

### 3.3. Hipótesis Estadísticas
1. **Hipótesis de Autenticación (PI1 / API2: Broken Authentication):**
   - $H_{0,\text{auth}}$: No existe diferencia estadísticamente significativa en la tasa de rechazo de credenciales inválidas entre API Keys, JWT y OAuth 2.0.
   - $H_{1,\text{auth}}$: Al menos uno de los mecanismos de autenticación presenta una tasa de rechazo estadísticamente significativa diferente a los demás.
   - *Prueba estadística:* Kruskal-Wallis (comparación entre 3 grupos independientes).
2. **Hipótesis de Autorización (PI2 / API1: BOLA):**
   - $H_{0,\text{authz}}$: No existe diferencia estadísticamente significativa en la tasa de bloqueo de ataques BOLA entre los modelos RBAC y ABAC.
   - $H_{1,\text{authz}}$: El modelo ABAC presenta una tasa de bloqueo de ataques BOLA estadísticamente superior al modelo RBAC.
   - *Prueba estadística:* Mann-Whitney U (comparación entre 2 grupos independientes).

### 3.4. Escenarios Experimentales (ESC-01 a ESC-06)

Cada tratamiento ejecuta **6 escenarios de prueba**, con **5 repeticiones** cada uno, totalizando **30 ejecuciones individuales por tratamiento** (180 ejecuciones en el experimento global).

| Escenario | Nombre | Tipo de Escenario | Vector OWASP | Operación | Código Esperado | Propósito / Justificación |
|:---:|---|---|:---:|:---:|:---:|---|
| **ESC-01** | Acceso válido propio | Línea base (Lícito) | N/A | Query `getOrder` | `200 OK` | Verifica que el cliente legítimo consulta su propio pedido exitosamente. Sin falsos positivos. |
| **ESC-02** | Crear pedido propio | Línea base (Lícito) | N/A | Mutation `createOrder` | `200 OK` | Verifica que el cliente legítimo registra un pedido exitosamente. Valida escritura lícita. |
| **ESC-03** | Ataque BOLA | Ataque de Autorización | API1:2023 (BOLA) | Query `getOrder` (ID ajeno) | `403` (ABAC)<br>`200` (RBAC) | Cliente legítimo consulta el pedido de otro cliente. En RBAC pasa (`200`, vulnerable); en ABAC se bloquea (`403`). |
| **ESC-04** | Credencial expirada | Ataque de Autenticación | API2:2023 (BA-01) | Query / Mutation | `401 Unauthorized` | Presentación de token/clave con tiempo de expiración vencido. Debe retornar HTTP 401. |
| **ESC-05** | Credencial inválida / falsificada | Ataque de Autenticación | API2:2023 (BA-02) | Query / Mutation | `401 Unauthorized` | Token con firma alterada (tampering) o API Key inexistente/adulterada. Debe retornar HTTP 401. |
| **ESC-06** | Credencial revocada | Ataque de Autenticación | API2:2023 (BA-03) | Query / Mutation / Token | `401 Unauthorized` | Intento de operar o emitir token con credencial revocada administrativamente. Debe retornar HTTP 401. |

---

## 4. Tratamientos Experimentales y Colecciones de Postman

### 4.1. Configuración Técnica de Cada Tratamiento

#### Tratamiento 1 (T1) — API Keys + RBAC
- **Puerto `ms-auth`:** `3101`
- **Autenticación:** API Key transmitida en cabecera `x-api-key`. `ApiKeyStrategy` calcula hash SHA-256 y busca en tabla `api_keys`.
- **Autorización:** `RbacGuard` evalúa exclusivamente `payload.role`. Al rol `customer` se le permite consultar `Order` sin contrastar `resourceOwnerId`.
- **Comportamiento BOLA:** Vulnerable. ESC-03 responde `200 OK`.
- **Colección Postman:** `T1 — API KEYs + RBAC (30 pruebas individuales).postman_collection.json`.

#### Tratamiento 2 (T2) — API Keys + ABAC
- **Puerto `ms-auth`:** `3102`
- **Autenticación:** Idéntica a T1 (API Keys hasheadas con SHA-256 en BD).
- **Autorización:** `AbacGuard` evalúa rol y además verifica: `resourceOwnerId && payload.customer_id === resourceOwnerId`.
- **Comportamiento BOLA:** Protegido. ESC-03 detecta discrepancia de propiedad y responde `403 Forbidden`.
- **Colección Postman:** `T2 — ABAC + API KEY (30 pruebas individuales).postman_collection.json`.

#### Tratamiento 3 (T3) — JWT + RBAC
- **Puerto `ms-auth`:** `3103`
- **Autenticación:** JSON Web Token (RFC 7519) firmado con algoritmo simétrico **HS256** mediante `JWT_SECRET`. TTL de 15 minutos (900 s). `JwtStrategy` verifica firma y vigencia sin consultar base de datos (stateless).
- **Emisión de token:** Endpoint previo `POST /auth/token` intercambia `username + api_key` por el JWT firmado.
- **Autorización:** `RbacGuard` evalúa únicamente el claim `role` extraído del token decodificado.
- **Comportamiento BOLA:** Vulnerable. ESC-03 responde `200 OK`.
- **Colección Postman:** `T3 — JWT + RBAC (30 pruebas individuales).postman_collection.json`.

#### Tratamiento 4 (T4) — JWT + ABAC
- **Puerto `ms-auth`:** `3104`
- **Autenticación:** Idéntica a T3 (JWT HS256 stateless con claims `user_id`, `role`, `customer_id`, `seller_id`).
- **Autorización:** `AbacGuard` evalúa claims del JWT contra el `resourceOwnerId` extraído de la consulta.
- **Comportamiento BOLA:** Protegido. ESC-03 responde `403 Forbidden`.
- **Colección Postman:** `T4 — JWT + ABAC (30 pruebas individuales).postman_collection.json`.

#### Tratamiento 5 (T5) — OAuth 2.0 (Self-Hosted) + RBAC
- **Puerto `ms-auth`:** `3105`
- **Autenticación:** OAuth 2.0 Client Credentials Grant (RFC 6749 §4.4) implementado de forma **self-hosted** en `ms-auth`. Emite **Access Tokens opacos** (cadenas aleatorias de 32 bytes hex), almacenados como hash SHA-256 en la tabla `oauth_tokens` con TTL de 15 minutos. Validación stateful vía introspección (`POST /auth/validate`).
- **Autorización:** `RbacGuard` evalúa únicamente el rol asociado al cliente en la base de datos.
- **Comportamiento BOLA:** Vulnerable. ESC-03 responde `200 OK`.
- **Colección Postman:** `T5 — OAuth 2.0 + RBAC (30 pruebas individuales).postman_collection.json` (y colección auxiliar `ms-auth T5 — OAuth 2.0 + RBAC.postman_collection.json`).

#### Tratamiento 6 (T6) — OAuth 2.0 (Self-Hosted) + ABAC
- **Puerto `ms-auth`:** `3106`
- **Autenticación:** Idéntica a T5 (OAuth 2.0 Client Credentials con tokens opacos validados por introspección en BD).
- **Autorización:** `AbacGuard` valida rol y propiedad (`resourceOwnerId === client.customer_id`).
- **Comportamiento BOLA:** Protegido. ESC-03 responde `403 Forbidden`.
- **Colección Postman:** *Pendiente de generación* (no existe archivo Postman previo para T6; se deriva directamente de T5 modificando el puerto a 3106 y los asserts de ESC-03 a `403`).

### 4.2. Matriz Comparativa Técnica entre Tratamientos

| Característica | T1 | T2 | T3 | T4 | T5 | T6 |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Mecanismo Auth** | API Key | API Key | JWT | JWT | OAuth 2.0 | OAuth 2.0 |
| **Tipo de Credencial** | Estática opaca | Estática opaca | Token firmado (HS256) | Token firmado (HS256) | Access Token opaco | Access Token opaco |
| **Almacenamiento Auth** | BD (`api_keys`) | BD (`api_keys`) | Stateless (memoria/firma) | Stateless (memoria/firma) | BD (`oauth_tokens`) | BD (`oauth_tokens`) |
| **TTL Credencial** | Indefinido / Fijo | Indefinido / Fijo | 15 minutos | 15 minutos | 15 minutos | 15 minutos |
| **Modelo Authz** | RBAC | ABAC | RBAC | ABAC | RBAC | ABAC |
| **Guarda Activo** | `RbacGuard` | `AbacGuard` | `RbacGuard` | `AbacGuard` | `RbacGuard` | `AbacGuard` |
| **Verifica Propiedad** | No | Sí | No | Sí | No | Sí |
| **Resultado ESC-03** | `200` (Vulnerable) | `403` (Bloqueado) | `200` (Vulnerable) | `403` (Bloqueado) | `200` (Vulnerable) | `403` (Bloqueado) |
| **SCo-1-G Esperado** | 0 % | 100 % | 0 % | 100 % | 0 % | 100 % |
| **SAu-1-G Esperado** | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % |

### 4.3. Discrepancias Identificadas entre Documentos

1. **Ausencia de Colección Postman para T6:**
   - La colección para T6 aún no está creada formalmente en los archivos raíz. Sus especificaciones técnicas se infieren con exactitud a partir del código de `T6` y de la colección de `T5`.

---

## 5. Diccionario de Datos del Archivo Excel de Resultados

Los archivos de resultados experimentales siguen una estructura tabular uniforme de 15 columnas:

| # | Columna Excel | Tipo de Dato | Significado / Descripción Operacional | Valores Posibles |
|:---:|---|:---:|---|---|
| 1 | `Repetición` | Entero (1 a 30) | **Identificador secuencial de ejecución** dentro del tratamiento. No representa el número de repetición del escenario, sino el orden de corrida. | 1 a 30 |
| 2 | `Autenticación` | Texto | Mecanismo de autenticación evaluado en el tratamiento. | `API KEY`, `JWT`, `OAuth 2.0` |
| 3 | `Autorización` | Texto | Mecanismo de control de acceso aplicado. | `RBAC`, `ABAC` |
| 4 | `Tratamiento` | Texto | Código identificador del tratamiento factorial. | `T1`, `T2`, `T3`, `T4`, `T5`, `T6` |
| 5 | `Escenario` | Texto | Código del escenario de prueba ejecutado. | `ESC-01`, `ESC-02`, `ESC-03`, `ESC-04`, `ESC-05`, `ESC-06` |
| 6 | `Descripción` | Texto | Resumen técnico de la tarea ejecutada y usuario simulado. | Ej: `C01 accede a su orden`, `C01 -> orden de C02`, etc. |
| 7 | `VECTOR OWASP` | Texto | Categoría de riesgo OWASP API Security Top 10 asociada al escenario. | `N/A`, `API1:2023`, `API2:2023` |
| 8 | `HTTP OBTENIDO` | Entero | Código de estado HTTP devuelto por el servidor en la prueba. | `200`, `401`, `403`, `500` |
| 9 | `HTTP ESPERADO` | Entero | Código de estado HTTP que define la respuesta segura/conforme. | `200`, `401`, `403` |
| 10 | `Response Size (B)` | Entero | Tamaño total del cuerpo y cabeceras de respuesta en bytes. Variable de rendimiento. | Entero positivo (bytes) |
| 11 | `Request Size (B)` | Entero | Tamaño total de la petición enviada en bytes. Variable de rendimiento. | Entero positivo (bytes) |
| 12 | `Latencia (ms)` | Numérico | Tiempo transcurrido entre el envío del request y la recepción de la respuesta completa. | Milisegundos |
| 13 | `Controlabilidad (SCo-1-G)` | Binario / Texto | Resultado individual de control de acceso frente a ataque BOLA (ESC-03). | `1` (bloqueado con 403), `0` (acceso indebido 200), `N/A` |
| 14 | `Integridad (SIn-1-G)` | Binario / Texto | Resultado individual sobre prevención de modificación no autorizada de registros. | `1` (sin alteración no autorizada), `0` (alterado), `N/A` |
| 15 | `Suficiencia (SAu-1-G)` | Binario / Texto | Resultado individual de rechazo de credenciales inválidas (ESC-04, ESC-05, ESC-06). | `1` (rechazado con 401), `0` (no rechazado con 401), `N/A` |

---

## 6. Interpretación de Resultados, Métricas y Reglas de Evaluación

Las métricas están estrictamente ancladas a las subcaracterísticas de seguridad del estándar **ISO/IEC 25023** y mapeadas al estándar **OWASP API Security Top 10 (2023)**.

### 6.1. Fórmulas y Definiciones Operacionales

#### 1. SCo-1-G — Tasa de Control de Acceso (TCA)
- **Dimensión:** Confidencialidad y Control de Acceso (ISO/IEC 25023 §Access Controllability).
- **Vector OWASP:** API1:2023 (BOLA).
- **Escenarios que aplican:** Exclusivamente **ESC-03**.
- **Fórmula:**
  $$\text{TCA} = \left( \frac{\text{Ataques BOLA bloqueados con HTTP 403}}{\text{Total de ataques BOLA ejecutados}} \right) \times 100$$
- **Criterio de Evaluación:**
  - $100\,\%$: Todos los intentos de acceso no autorizado a objetos ajenos fueron bloqueados antes de retornar datos (comportamiento esperado en ABAC: T2, T4, T6).
  - $0\,\%$: Ningún ataque BOLA fue bloqueado; el sistema retornó datos de otro cliente con HTTP 200 (comportamiento en RBAC puro: T1, T3, T5).

#### 2. SIn-1-G — Tasa de Integridad de Datos (TID)
- **Dimensión:** Integridad de Datos (ISO/IEC 25023 §Data Corruption Prevention).
- **Vector OWASP:** API1:2023 (BOLA en operaciones de modificación o impacto colateral).
- **Fórmula:**
  $$\text{TID} = \left( \frac{\text{Registros objetivo no alterados de forma no autorizada}}{\text{Total de registros objetivo}} \right) \times 100$$
- **Criterio de Evaluación:**
  - $100\,\%$: Ningún registro en la base de datos sufrió inserción, modificación o borrado no autorizado.
  - *Distinción técnica fundamental:* En una consulta de solo lectura como `getOrder` (ESC-03), la integridad física de la base de datos no es alterada (TID = 100 %), aun cuando la confidencialidad falle por BOLA (TCA = 0 %). No debe inferirse integridad únicamente a partir del código HTTP ni confundirse con la lectura no autorizada.

#### 3. SAu-1-G — Tasa de Rechazo de Credenciales Inválidas (TRCI)
- **Dimensión:** Autenticidad y Suficiencia del Mecanismo (ISO/IEC 25023 §Authentication Mechanism Sufficiency).
- **Vector OWASP:** API2:2023 (Broken Authentication).
- **Escenarios que aplican:** Exclusivamente **ESC-04, ESC-05 y ESC-06**.
- **Fórmula:**
  $$\text{TRCI} = \left( \frac{\text{Credenciales inválidas rechazadas estrictamente con HTTP 401}}{\text{Total de credenciales inválidas enviadas}} \right) \times 100$$
- **Criterio de Evaluación:**
  - $100\,\%$: Todas las credenciales caducadas, adulteradas o revocadas fueron rechazadas con código `HTTP 401`.
  - Exige estrictamente `HTTP 401`. Un código `HTTP 403` o `HTTP 500` **no** se computa como rechazo exitoso de autenticación.

### 6.2. Mapeo Canónico de Escenarios a Métricas

| Escenario | Naturaleza de la Prueba | SCo-1-G (TCA) | SIn-1-G (TID) | SAu-1-G (TRCI) |
|:---:|---|:---:|:---:|:---:|
| **ESC-01** | Operación lícita de lectura | `N/A` | `N/A` | `N/A` |
| **ESC-02** | Operación lícita de escritura | `N/A` | `N/A` | `N/A` |
| **ESC-03** | Intento de lectura ajena (BOLA) | **Aplica** (1 = 403, 0 = 200) | **Aplica** (1 = no alterado) | `N/A` |
| **ESC-04** | Credencial expirada (BA-01) | `N/A` | `N/A` | **Aplica** (1 = 401, 0 = otro) |
| **ESC-05** | Credencial alterada/falsa (BA-02) | `N/A` | `N/A` | **Aplica** (1 = 401, 0 = otro) |
| **ESC-06** | Credencial revocada (BA-03) | `N/A` | `N/A` | **Aplica** (1 = 401, 0 = otro) |

### 6.3. Reglas Obligatorias para el Procesamiento Estadístico
1. **Tratamiento de `N/A`:** El valor `N/A` representa una celda no aplicable. **Bajo ninguna circunstancia debe convertirse a 0 o promediarse como número**.
2. **Cálculo de tasas globales:** No promediar indiscriminadamente toda la columna. Cada métrica se calcula filtrando solo las filas de sus escenarios aplicables y dividiendo la suma de aciertos entre el total de intentos válidos de ese escenario.
3. **Identificador secuencial vs. Repetición:** La columna `Repetición` va de 1 a 30 por tratamiento:
   - Filas 1 a 5: ESC-01 (repeticiones 1 a 5 del escenario 1)
   - Filas 6 a 10: ESC-02 (repeticiones 1 a 5 del escenario 2)
   - Filas 11 a 15: ESC-03 (repeticiones 1 a 5 del escenario 3)
   - Filas 16 a 20: ESC-04 (repeticiones 1 a 5 del escenario 4)
   - Filas 21 a 25: ESC-05 (repeticiones 1 a 5 del escenario 5)
   - Filas 26 a 30: ESC-06 (repeticiones 1 a 5 del escenario 6)
4. **Denominadores Faltantes:** Si no hay suficientes ejecuciones, la métrica debe reportarse como **No Calculable (N/C)**.

---

## 7. Criterios para la Comparación de Tratamientos

El análisis comparativo debe mantener una separación estricta entre la **evaluación de seguridad** y el **análisis de rendimiento computacional**:

### 7.1. Comparación de Seguridad (Variable Dependiente Principal)
- **Comparación RBAC vs. ABAC:**
  - Se evalúa principalmente en **ESC-03 (BOLA)** a través de **SCo-1-G**.
  - Hipótesis: ABAC alcanza el 100 % de bloqueo; RBAC alcanza el 0 % de bloqueo frente a BOLA en GraphQL.
  - La magnitud de esta diferencia es de carácter absoluto (efecto determinista esperado en el diseño del guard).
- **Comparación API Keys vs. JWT vs. OAuth 2.0:**
  - Se evalúa en **ESC-04, ESC-05 y ESC-06** a través de **SAu-1-G**.
  - Si la implementación del backend valida correctamente expiración, firma y estado activo/revocado en todos los mecanismos, los tres pueden alcanzar el 100 % de suficiencia.
  - La diferenciación entre ellos radica en el **esfuerzo arquitectónico, el acoplamiento y el estado de la sesión** (stateless vs. stateful).

### 7.2. Comparación de Rendimiento (Variables Secundarias)
Las variables de rendimiento nunca deben enmascarar o compensar fallas de seguridad:
- **Latencia (ms):**
  - *JWT (T3, T4):* Presenta menor latencia en validación (`POST /auth/validate`), ya que la verificación criptográfica HS256 ocurre en memoria sin consultar base de datos.
  - *API Keys (T1, T2) y OAuth 2.0 (T5, T6):* Presentan latencias ligeramente superiores debido a la consulta I/O obligatoria contra PostgreSQL en cada validación.
- **Tamaño de Solicitud y Respuesta (Bytes):**
  - *Request Size:* Las peticiones con JWT o Access Token OAuth 2.0 poseen mayor tamaño que las de API Key debido a la longitud de los strings en cabecera `Authorization: Bearer <token>`.
  - *Response Size:* En ESC-03, una respuesta `200 OK` (RBAC vulnerable) tiene un tamaño notablemente mayor (retorna el árbol JSON completo de la orden) que una respuesta `403 Forbidden` (ABAC mitigado), la cual solo retorna el mensaje de error.

---

## 8. Hallazgos Relevantes y Observaciones Técnicas Confirmadas

1. **La vulnerabilidad BOLA en GraphQL es estructural del modelo RBAC:**
   En GraphQL, al converger todas las solicitudes en `POST /graphql`, un guard RBAC puro solo puede validar que el usuario tenga el rol `customer`. Como `customer` tiene permiso general sobre el recurso `Order`, el sistema aprueba la consulta sin verificar si el ID del pedido le pertenece, exponiendo datos de terceros.
2. **ABAC resuelve BOLA mediante inspección en middleware/resolver:**
   El `AbacGuard` bloquea el 100 % de los ataques BOLA porque evalúa el atributo `resourceOwnerId` extraído por el middleware contra el atributo `customer_id` del token/clave.
3. **El trade-off entre Stateless y Revocación Inmediata:**
   - JWT ofrece independencia de base de datos (alta escalabilidad y menor latencia), pero dificulta la revocación inmediata antes de que venza el TTL de 15 minutos sin un almacén centralizado (blacklist).
   - OAuth 2.0 con tokens opacos y API Keys permiten revocación instantánea mediante flag `is_active` / `is_revoked` en la base de datos, a costa de una consulta I/O en cada transacción.
4. **Implementación de OAuth 2.0 adaptada al laboratorio:**
   Para eliminar la dependencia de servidores externos pesados (Keycloak) que dificultarían la replicación en laboratorio, se construyó un servidor de autorización nativo y ligero en NestJS que sigue estrictamente el estándar RFC 6749 (Client Credentials).

---

## 9. Instrucciones Obligatorias para Futuros Análisis de Nuevos Datos

Cualquier agente de inteligencia artificial o analista que procese nuevos archivos de resultados experimentales deberá cumplir las siguientes reglas:

1. **Lectura y Validación Inicial:**
   - Comprobar que el archivo contenga exactamente 30 filas por tratamiento (5 repeticiones × 6 escenarios).
   - Validar que los códigos en `HTTP OBTENIDO` correspondan a los esperados según el tratamiento y escenario.
2. **Reglas de Cálculo de Métricas:**
   - **SCo-1-G (TCA):** Calcular únicamente con las 5 filas de ESC-03:
     $$\text{TCA} = \frac{\sum [HTTP\_OBTENIDO == 403]}{5} \times 100$$
   - **SIn-1-G (TID):** En operaciones de lectura, reportar 100 % si no hubo escrituras no autorizadas en BD.
   - **SAu-1-G (TRCI):** Calcular sumando los aciertos de ESC-04, ESC-05 y ESC-06 (15 intentos en total):
     $$\text{TRCI} = \frac{\sum [HTTP\_OBTENIDO == 401]}{15} \times 100$$
3. **Prohibición de Promedios Ciegos:**
   - Jamás ejecutar un promedio simple (`AVERAGE`) sobre la columna completa de una métrica en el Excel, pues mezclaría celdas `N/A` o escenarios no relacionados.
4. **Aislamiento de Rendimiento y Seguridad:**
   - Mantener separadas las tablas de latencia de las tablas de eficacia de seguridad.
   - Presentar media, desviación estándar, mediana y rango intercuartílico (IQR) para la latencia.
5. **Pruebas de Hipótesis:**
   - Usar pruebas no paramétricas (Kruskal-Wallis para los 3 mecanismos de autenticación y Mann-Whitney U para los 2 modelos de autorización) debido a la naturaleza discreta/binaria de los datos de bloqueo y al tamaño muestral ($N = 30$ por tratamiento).
6. **Manejo de Inconsistencias:**
   - Si se detecta un código HTTP inesperado (ej. HTTP 500), documentarlo como error no controlado de infraestructura y reportarlo antes de calcular las tasas.
