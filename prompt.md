# Consolidación y síntesis del contexto de investigación de la tesis

Quiero que analices exhaustivamente la información de mi tesis contenida en los archivos adjuntos (`Tesis V1-c.md`), junto con los archivos de Postman que documentan la implementación y ejecución de los diferentes tratamientos experimentales.

El objetivo es **consolidar toda la información relevante de la investigación en un documento de referencia técnico, compacto y estructurado**, que permita comprender el contexto de la tesis, interpretar correctamente los datos obtenidos y continuar con futuros análisis sin necesidad de volver a procesar todos los documentos originales, reduciendo así el consumo de tokens.

## 1. Análisis de la documentación

Analiza los archivos proporcionados considerando dos fuentes principales:

- **Documentación de la tesis:** planteamiento del problema, objetivos, metodología, arquitectura, tecnologías, diseño experimental, tratamientos, métricas, resultados y conclusiones.
- **Archivos de Postman:** colecciones
`T1 — API KEYs + RBAC (30 pruebas individuales).postman_collection.json`
`T2 — ABAC + API KEY (30 pruebas individuales).postman_collection.json`
`T3 — JWT + RBAC (30 pruebas individuales).postman_collection.json`
`T4 — JWT + ABAC (30 pruebas individuales).postman_collection.json`
`T5 — OAuth 2.0 + RBAC (30 pruebas individuales).postman_collection.json`

Es fundamental que revises cómo están diseñados los tratamientos en Postman y no te limites a describirlos superficialmente. Debes comprender su estructura, diferencias, propósito y relación con las pruebas experimentales.
_Nota: para el tratamiento 6 aún no existe una colección_

## 2. Consolidación de los tratamientos experimentales

Genera una síntesis que permita identificar claramente:

- Cada tratamiento experimental y su identificador.
- El mecanismo de autenticación utilizado.
- El mecanismo de autorización aplicado.
- Las configuraciones y parámetros relevantes.
- Las diferencias entre tratamientos.
- Los escenarios de prueba ejecutados.
- Los endpoints involucrados.
- El comportamiento esperado y obtenido.
- La relación entre cada tratamiento y las vulnerabilidades o vectores de ataque evaluados.

Conserva las diferencias técnicas entre tratamientos. No agrupes configuraciones que puedan parecer similares si representan mecanismos de seguridad distintos.


## 3. Métricas de evaluación e interpretación de resultados

La evaluación experimental utiliza tres métricas principales de seguridad. Estas métricas tienen definiciones operacionales específicas que deben respetarse durante todo el análisis.

**No modificar sus fórmulas, significado ni criterios de evaluación.** Los archivos de resultados deben interpretarse conforme a estas definiciones.

### 3.1. SCo-1-G — Tasa de Control de Acceso (TCA)

Mide la proporción de intentos no autorizados de acceder al objeto de otro usuario (ataque BOLA) que el sistema detecta y bloquea antes de retornar datos.

Un valor del 100 % indica que ninguna solicitud BOLA obtuvo acceso a datos ajenos.

**Fórmula:**

TCA = (Ataques BOLA bloqueados / Total de ataques BOLA ejecutados) × 100

**Criterio de interpretación:**
- 100 %: todos los ataques BOLA fueron bloqueados.
- Entre 0 % y 100 %: existieron ataques bloqueados y ataques que lograron acceso no autorizado.
- 0 %: ningún ataque BOLA fue bloqueado.

### 3.2. SIn-1-G — Tasa de Integridad de Datos (TID)

Mide si los ataques BOLA lograron modificar datos que no le correspondían al atacante. Complementa SCo-1-G al verificar que el control de acceso no solo impide la lectura, sino también la escritura no autorizada.

**Fórmula:**

TID = (Registros no alterados no autorizadamente / Total de registros objetivo) × 100

**Criterio de interpretación:**
- 100 %: ningún registro objetivo sufrió modificaciones no autorizadas.
- Entre 0 % y 100 %: existieron registros afectados por modificaciones no autorizadas.
- 0 %: todos los registros objetivo fueron alterados no autorizadamente.

### 3.3. SAu-1-G — Tasa de Rechazo de Credenciales Inválidas (TRCI)

Mide la proporción de intentos de autenticación con credenciales inválidas (tokens expirados, firmas incorrectas, claves revocadas y tokens de otro usuario) que el sistema rechaza correctamente mediante el código HTTP 401.

**Fórmula:**

TRCI = (Credenciales inválidas rechazadas / Total de credenciales inválidas enviadas) × 100

**Criterio de interpretación:**
- 100 %: todas las credenciales inválidas fueron rechazadas correctamente con HTTP 401.
- Entre 0 % y 100 %: algunas credenciales inválidas no fueron rechazadas correctamente.
- 0 %: ninguna credencial inválida fue rechazada correctamente con HTTP 401.

### 3.4. Reglas obligatorias para el cálculo e interpretación

1. Las tres métricas representan dimensiones diferentes de seguridad y no deben confundirse ni sustituirse entre sí.
2. SCo-1-G evalúa el bloqueo de accesos no autorizados de lectura mediante ataques BOLA.
3. SIn-1-G evalúa la protección de la integridad de los registros frente a modificaciones no autorizadas.
4. SAu-1-G evalúa el rechazo de credenciales inválidas durante la autenticación.
5. No considerar automáticamente cualquier respuesta HTTP 401 como un rechazo exitoso: debe corresponder a un intento con credenciales inválidas y cumplir el criterio definido para la métrica.
6. No considerar un HTTP 403 o cualquier otro código como un rechazo exitoso para SAu-1-G, cuya definición exige específicamente HTTP 401.
7. Para SCo-1-G, verificar que el bloqueo ocurra antes de retornar datos ajenos.
8. Para SIn-1-G, verificar el estado real de los registros objetivo y no inferir integridad únicamente a partir del código HTTP de respuesta.
9. No asumir que una solicitud bloqueada de lectura también garantiza la protección frente a escrituras no autorizadas.
10. No inventar denominadores, resultados ni valores faltantes.
11. Si no existen intentos o registros suficientes para calcular una métrica, identificarla como no calculable (N/C), en lugar de asignarle automáticamente 0 % o 100 %.
12. Mantener las definiciones y fórmulas constantes en todos los tratamientos y repeticiones experimentales.

### 3.5. Relación entre métricas y análisis comparativo

| Métrica | Dimensión evaluada | Comportamiento que verifica |
|---|---|---|
| SCo-1-G (TCA) | Control de acceso | Bloqueo de lectura no autorizada BOLA |
| SIn-1-G (TID) | Integridad de datos | Prevención de modificaciones no autorizadas |
| SAu-1-G (TRCI) | Autenticación | Rechazo de credenciales inválidas |

Al comparar los tratamientos experimentales, analiza las tres métricas de manera independiente. Identifica las fortalezas y debilidades de cada mecanismo de seguridad y evita concluir que un tratamiento ofrece mayor seguridad basándote exclusivamente en una métrica.

**Importante:** las métricas representan la evaluación de seguridad de la investigación. Las variables de rendimiento, como latencia, tamaño de solicitud y tamaño de respuesta, deben analizarse por separado y relacionarse con las métricas de seguridad únicamente cuando exista fundamento experimental.

## 4. Estructura del Excel de resultados experimentales

Los resultados de las pruebas experimentales se encuentran organizados en archivos Excel, siguiendo una estructura uniforme para cada tratamiento.

### 4.1. Organización de las pruebas

Cada tratamiento experimental contiene 5 repeticiones de cada escenario de prueba.

Cada fila representa una ejecución individual de un escenario dentro de un tratamiento determinado.

La columna `Repetición` utiliza una numeración consecutiva que permite identificar las ejecuciones. Por ejemplo, en el tratamiento T2:

| Repetición | Escenario | Interpretación |
|---:|---|---|
| 1 | ESC-01 | Primera prueba del escenario 01 |
| 6 | ESC-02 | Primera prueba del escenario 02 |
| 11 | ESC-03 | Primera prueba del escenario 03 |
| 16 | ESC-04 | Primera prueba del escenario 04 |
| 21 | ESC-05 | Primera prueba del escenario 05 |
| 26 | ESC-06 | Primera prueba del escenario 06 |

La numeración continúa siguiendo la misma secuencia para las siguientes repeticiones de cada escenario.

Por tanto, no se debe interpretar la columna `Repetición` como el número de repetición dentro de un escenario, sino como un identificador secuencial de ejecución. Para identificar la repetición efectiva, se debe considerar conjuntamente el tratamiento y el escenario.

### 4.2. Diccionario de columnas

El Excel contiene las siguientes columnas:

| Columna | Significado | Uso en el análisis |
|---|---|---|
| Repetición | Identificador secuencial de ejecución | Identificar cada prueba |
| Autenticación | Mecanismo de autenticación utilizado | Caracterizar el tratamiento |
| Autorización | Mecanismo de autorización utilizado | Caracterizar el tratamiento |
| Tratamiento | Identificador experimental (T1, T2, etc.) | Agrupar y comparar resultados |
| Escenario | Escenario de prueba ejecutado | Clasificar el tipo de prueba |
| Descripción | Explicación del comportamiento evaluado | Comprender el objetivo de la prueba |
| VECTOR OWASP | Vulnerabilidad o categoría OWASP evaluada | Clasificar el escenario de seguridad |
| HTTP OBTENIDO | Código HTTP devuelto por el sistema | Evaluar el comportamiento observado |
| HTTP ESPERADO | Código HTTP definido como respuesta correcta | Determinar conformidad |
| Response Size (B) | Tamaño de la respuesta en bytes | Analizar el tamaño de respuesta |
| Request Size (B) | Tamaño de la solicitud en bytes | Analizar el tamaño de solicitud |
| Latencia (ms) | Tiempo de respuesta en milisegundos | Evaluar rendimiento |
| Controlabilidad (SCo-1-G) | Resultado asociado al control de acceso | Evaluación de TCA |
| Integridad (SIn-1-G) | Resultado asociado a la integridad de datos | Evaluación de TID |
| Suficiencia (SAu-1-G) | Resultado asociado al rechazo de credenciales inválidas | Evaluación de TRCI |

**Nota:** Los nombres originales de las columnas deben conservarse al procesar los archivos. Las equivalencias entre nombres y métricas son las siguientes:

- `Controlabilidad (SCo-1-G)` → Tasa de Control de Acceso (TCA).
- `Integridad (SIn-1-G)` → Tasa de Integridad de Datos (TID).
- `Suficiencia (SAu-1-G)` → Tasa de Rechazo de Credenciales Inválidas (TRCI).

### 4.3. Interpretación de las columnas de métricas

Las columnas de métricas contienen resultados individuales asociados a cada ejecución experimental.

En los ejemplos proporcionados, los valores `1` y `N/A` tienen los siguientes significados:

- `1`: resultado individual satisfactorio para el criterio evaluado.
- `N/A`: la métrica no aplica al escenario correspondiente.

**Importante:** el valor `1` no representa directamente un porcentaje del 100 % para todo el tratamiento. Es un resultado individual que debe agregarse considerando las cinco pruebas correspondientes al escenario y la definición operacional de cada métrica.

No asumir que todos los escenarios deben contribuir al cálculo de las tres métricas. La aplicabilidad depende del objetivo de cada escenario.

### 4.4. Relación entre escenarios y métricas

Los escenarios deben clasificarse según el comportamiento de seguridad que evalúan:

- **Escenarios de validación:** verifican operaciones legítimas y el funcionamiento normal del sistema. No necesariamente contribuyen al cálculo de las métricas de seguridad.
- **Escenarios BOLA:** evalúan intentos de acceso no autorizado a recursos de otros usuarios. Se relacionan principalmente con SCo-1-G y SIn-1-G, según las operaciones de lectura o escritura evaluadas.
- **Escenarios Broken Authentication:** evalúan el rechazo de credenciales inválidas, como sesiones caducadas, firmas incorrectas y credenciales revocadas. Se relacionan con SAu-1-G.

La clasificación definitiva debe contrastarse con las solicitudes de Postman y la descripción de cada escenario. No clasificar únicamente por el nombre del escenario.

### 4.5. Reglas para el procesamiento estadístico

Al analizar los archivos Excel, aplicar las siguientes reglas:

1. Agrupar los registros por tratamiento y escenario.
2. Verificar que cada escenario tenga cinco ejecuciones por tratamiento.
3. No confundir el identificador secuencial de repetición con el número de repetición del escenario.
4. Comparar HTTP OBTENIDO con HTTP ESPERADO para identificar conformidad.
5. Calcular las métricas de seguridad utilizando sus definiciones operacionales oficiales, no mediante promedios indiscriminados de todas las filas.
6. Tratar `N/A` como un valor no aplicable, nunca como cero.
7. Analizar latencia, Request Size y Response Size como variables de rendimiento.
8. Mantener separados los resultados individuales, los resultados agregados por escenario y los resultados globales por tratamiento.
9. Verificar la existencia de datos faltantes, duplicados o inconsistentes antes de calcular estadísticas.
10. No completar automáticamente ejecuciones ausentes ni asumir que los datos faltantes representan resultados satisfactorios o fallidos.

### 4.6. Validaciones antes de analizar

Antes de realizar cualquier análisis estadístico, comprobar:

- Cantidad de escenarios por tratamiento.
- Cinco ejecuciones por escenario.
- Correspondencia entre tratamiento, autenticación y autorización.
- Consistencia de los códigos HTTP obtenidos y esperados.
- Aplicabilidad de las tres métricas.
- Integridad de los registros utilizados para calcular SIn-1-G.
- Clasificación correcta de los intentos de autenticación inválidos.
- Existencia de valores nulos, duplicados o anómalos.

Si alguna condición no se cumple, reportar la inconsistencia antes de presentar resultados o conclusiones.

## 5. Estructura del documento final

Genera un documento compacto con las siguientes secciones:

1. **Contexto general de la tesis:** tema, problema, objetivos y alcance.
2. **Arquitectura tecnológica:** componentes, tecnologías, servicios y comunicación entre ellos.
3. **Diseño experimental:** metodología, variables, tratamientos y escenarios.
4. **Tratamientos de Postman:** configuración y diferencias técnicas de cada tratamiento.
5. **Diccionario de datos:** descripción de columnas, variables, métricas y unidades.
6. **Interpretación de resultados:** criterios, fórmulas y reglas de evaluación.
7. **Criterios de comparación:** cómo comparar tratamientos y analizar su rendimiento y seguridad.
8. **Hallazgos relevantes:** resultados confirmados y observaciones importantes.
9. **Instrucciones para futuros análisis:** reglas que deberá respetar la IA al trabajar con nuevos datos.

## 6. Consideraciones importantes

- Prioriza la precisión técnica sobre la extensión del documento.
- Elimina información redundante, explicaciones repetitivas y contenido que no aporte al análisis.
- Conserva nombres de tecnologías, tratamientos, endpoints, métricas, variables y configuraciones originales.
- No inventes información para completar apartados.
- Si existen contradicciones entre documentos, identifícalas y explica dónde se encuentran.
- Si algún archivo de Postman presenta información que no coincide con la descripción de la tesis, señala la discrepancia.
- No confundas la configuración experimental con los resultados obtenidos.
- Utiliza tablas cuando permitan condensar información sin perder precisión.

## 7. Resultado esperado

Quiero obtener un **documento maestro de contexto de investigación**, suficientemente compacto para utilizarlo como referencia en futuras conversaciones.

Este documento debe permitir que, al proporcionar nuevos archivos de resultados o solicitar un análisis adicional, puedas comprender inmediatamente:

- Qué se está investigando.
- Cómo está construida la arquitectura.
- Qué representa cada tratamiento.
- Cómo se ejecutan las pruebas.
- Qué significa cada dato obtenido.
- Cómo interpretar los resultados.
- Qué criterios utilizar para comparar los tratamientos.

La prioridad es que el documento funcione como una memoria técnica reutilizable de la tesis, evitando tener que volver a leer y analizar todos los archivos originales en cada sesión.

**Antes de finalizar, verifica que la síntesis sea suficiente para interpretar correctamente los resultados experimentales sin depender constantemente de la documentación original. Si existe información indispensable que no pueda condensarse sin perder precisión, consérvala.**