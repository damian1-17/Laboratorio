# CAPITULO I: INTRODUCCIÓN
El presente capítulo constituye la apertura metodológica y contextual de la investigación, donde se expone la problemática actual en torno a la seguridad de las interfaces de programación (APIs) modernas. En las siguientes secciones se detalla el planteamiento del problema, evidenciando los desafíos de autorización y autenticación que surgen al combinar arquitecturas de microservicios con la flexibilidad operativa de GraphQL. Asimismo, se establecen los objetivos generales y específicos que trazarán la hoja de ruta del proyecto, se delimita el alcance técnico del entorno experimental y se presenta la justificación tecnológica, académica y social que fundamenta la urgencia de llevar a cabo este análisis comparativo
## Tema 
Estudio comparativo de mecanismos de autenticación y autorización en APIs GraphQL dentro de arquitectura microservicios.	
## El problema 
## Problema de investigación.
### Problemática a investigar.
Hoy en día, los microservicios se han convertido en la forma preferida de construir aplicaciones que necesitan ser escalables y dividirse en módulos independientes [1]. Al mismo tiempo, GraphQL ha ganado popularidad, principalmente porque permite a los clientes solicitar exactamente los datos que necesitan [2]. Pero esta combinación trae consigo un desafío sustancial: la flexibilidad que hace atractivo a GraphQL a su vez abre puertas a posibles ataques sino se implementan con cuidado. Esto puede repercutir en accesos no autorizados y exposición de información confidencial [3]. El dilema que enfrentamos es que no está claro cual de los diferentes mecanismos de seguridad funciona mejor en este contexto en particular. Tenemos varias opciones disponibles para autenticación como OAuth 2.0, JWT, API Keys, y para autorización RBAC y ABAC [4], sin embargo, hace falta evidencia concreta sobre cual es realmente más efectiva. Lo que funciona en papel no siempre funciona en la práctica, ya que todo depende de cómo se implemente, como se gestione las identidades de los usuarios y que tan completa se su infraestructura [4]. Cuando estos mecanismos se implementan mal, cuando no hay políticas claras de control de acceso, o cuando los endpoints de GraphQL están mal configurados aparecen vulnerabilidades serias. Las repercusiones pueden ser graves: desde la exposición de datos privados y confidenciales hasta comprometer el sistema completo, pasando por la pérdida de credibilidad ante los usuarios [4]. Lo que realmente hace falta es información precisa sobre la aplicación práctica de estos mecanismos y saber cuál de estas combinaciones ofrece la mejor protección contra accesos no deseados cuando trabajamos con GraphQL sobre arquitecturas microservicios. Se carece de una evaluación experimental controlada que mida y compare su impacto real en la mitigación de amenazas [5], [6], dejando a los equipos de desarrollo sin una guía clara para seleccionar la estrategia de seguridad más adecuada. 
## Objetivos 
### Objetivo general
Comparar los mecanismos de autenticación y autorización en APIs GraphQL dentro de arquitecturas de microservicios.
### Objetivos específicos
- Caracterizar los principales mecanismos de autenticación y autorización utilizados en APIs GraphQL.
- Diseñar un entorno experimental de microservicios con GraphQL para evaluar la eficacia de los mecanismos de seguridad de autenticación y autorización en APIs GraphQL.
- Analizar los resultados de la ejecución del entorno experimental de microservicios con GraphQL.
# CAPÍTULO II
Este capítulo desarrolla el fundamento conceptual, técnico y referencial que sustenta la presente investigación. En primera instancia, se exponen los antecedentes internacionales y nacionales, analizando de manera crítica los estudios previos para evidenciar la brecha existente en la evaluación cuantitativa de la seguridad en entornos GraphQL. Posteriormente, se estructuran las bases teóricas que rigen el proyecto, conceptualizando las arquitecturas distribuidas, los estándares de gestión de identidad (como JWT, API Keys y OAuth 2.0) y los modelos de control de acceso (RBAC y ABAC). Finalmente, se analizan los vectores de ataque más críticos según el estándar de seguridad OWASP, sentando así los cimientos tecnológicos necesarios para el posterior diseño, implementación y evaluación del entorno experimental.
## ANTECEDENTES
### Antecedentes internacionales
La revisión de la literatura internacional revela una convergencia hacia la necesidad de reevaluar las estrategias de seguridad en arquitecturas modernas, partiendo desde la identificación del problema hasta la propuesta de soluciones arquitectónicas.
En primer lugar, respecto a la madurez y los riesgos de las nuevas tecnologías de consulta, (Quiña-Mera et al., 2023) [7] llevaron a cabo un estudio de mapeo sistemático con el objetivo de caracterizar el estado del arte y las tendencias de investigación en torno a GraphQL. Al aplicar una metodología de revisión sistemática de literatura, filtrando y categorizando publicaciones académicas de alto impacto para identificar lagunas en el conocimiento actual. El hallazgo más relevante fue la identificación de la seguridad, y en particular la autorización, como una de las áreas menos exploradas y con mayor necesidad de investigación primaria. La principal limitación de este trabajo reside en su naturaleza teórica documental; al ser un estudio secundario, no ofrece una implementación técnica ni una validación experimental de mecanismos de seguridad.
Esta necesidad de investigación empírica se fundamenta con la complejidad operativa que introduce GraphQL en el servidor, al respecto, (Brito et al., 2020) [8] realizaron un experimento controlado para comparar el rendimiento y el esfuerzo de implementación entre APIs REST y GraphQL. Desarrollaron aplicaciones equivalentes en ambas tecnologías y sometieron los sistemas a cargas de trabajo medidas. Concluyeron que GraphQL reduce significativamente el tráfico de red, pero traslada la complejidad computacional al servidor. Aunque metodológicamente es un referente para mi OE2, este estudio se limitó a comparar las tecnologías de transporte de datos, sin profundizar en cómo esta complejidad del servidor afecta la implementación y eficacia de los mecanismos de seguridad.
En conjunto ambas investigaciones [7], [8] justifican que GraphQL es difícil de proteger y está poco explorado en materia de seguridad porque la tecnología concentra toda la carga y lógica de resolución en un solo punto, lo que vuelve obsoletos los controles perimetrales tradicionales y requiere nuevos enfoques.
Para dar respuesta a esta necesidad en sistemas distribuidos diversos autores han propuesto delegar la seguridad a la capa de infraestructura. En el ámbito de autorización, (Nehme et al., 2019) [9] propusieron un modelo de control de acceso de grano fino para microservicios basado en atributos (ABAC), con el fin de superar las limitaciones de rigidez de los modelos tradicionales. La solución se implementó utilizando un motor de políticas externo integrado en el API Gateway, desacoplando la lógica de seguridad de la lógica de negocio de los servicios individuales. Los resultados validaron que este enfoque permite gestionar políticas complejas de manera centralizada y eficiente en sistemas distribuidos. No obstante, el trabajo se validó principalmente en arquitecturas REST estándar y no abordó los vectores de ataque específicos de profundidad y selección de campos propios de GraphQL (como BOLA o DoS), ni ofreció métricas comparativas cuantitativas de seguridad frente a modelos RBAC en dicho entorno específico.
Esta línea fue fortalecida por (Sänger et al., 2023) [10] quienes propusieron una arquitectura de referencia para la autorización de usuarios en aplicaciones basadas en microservicios. Su metodología consistió en desacoplar la lógica de autorización de los servicios individuales, centralizándola mediante políticas ABAC. Los resultados demostraron que este enfoque mejora la mantenibilidad y la coherencia de la seguridad en sistemas distribuidos. No obstante, el trabajo es una propuesta de diseño arquitectónico y no incluyó un "benchmark" o comparación experimental de rendimiento bajo estrés o ataque, métricas cuantitativas que mi tesis generará para validar la viabilidad de dicha arquitectura en el mundo real.
Por otro lado, en el ámbito de la seguridad (Gbenle et al., 2022) [11] realizaron una revisión de casos sobre la aplicación de los protocolos OAuth2 y JWT para asegurar API Gateways en sistemas distribuidos. Utilizando una metodología descriptiva basada en mejores prácticas de la industria, analizaron cómo estos estándares gestionan la identidad federada. El estudio concluyó que la combinación de OAuth2 para delegación y JWT para tokens stateless ofrece la robustez necesaria para proteger servicios desacoplados. Sin embargo, el alcance fue teórica y generalista para APIs distribuidas, sin evaluar experimentalmente cómo se comportan estos mecanismos ante los riesgos de introspección y exposición de esquema propios de GraphQL.
Estos tres autores [9], [10], [11] establecen un consenso arquitectónico claro: para proteger sistemas distribuidos modernos, es imperativo utilizar JWT para la identidad y un modelo dinámico como ABAC para los permisos, evaluándolos centralizadamente. Sin embargo, los tres trabajos comparten una limitación crítica: admiten que sus propuestas fueron teóricas o validadas en REST estándar, sin someterlas a pruebas experimentales contra ataques complejos y de profundidad en un entorno GraphQL.
Finalmente, la urgencia de cubrir esta brecha experimental se evidencia en la literatura de seguridad ofensiva (Vaadata, 2023) [12] documentó un estudio de caso técnico sobre la explotación de vulnerabilidades de control de acceso roto (Broken Access Control) en entornos GraphQL. A través de una metodología de pruebas de penetración ofensiva (pentesting), lograron demostrar cómo la falta de validación en los resolvers anidados permite la exfiltración masiva de datos sensibles mediante la iteración de IDs. El resultado principal confirmó que los controles perimetrales tradicionales son insuficientes para detener ataques BOLA en grafos de datos. La limitación de este reporte es que se centra exclusivamente en la ofensiva (el ataque), sin evaluar ni comparar cuantitativamente la efectividad de los mecanismos de defensa (RBAC vs ABAC) para prevenir dichos riesgos, análisis que constituye el núcleo del tercer objetivo de este proyecto.
Vaadata demuestra en la práctica lo que Quiña-Mera [13] advirtió en teoría: si se aplica controles tradicionales de REST a GraphQL, fallarán, además muestra cómo los atacantes usan la profundidad de GraphQL para hacer ataques BOLA en los resolvers.
### Antecedentes nacionales
En el contexto ecuatoriano, la adopción de arquitecturas distribuidas y nuevas tecnologías de consulta ha motivado investigaciones recientes en las principales instituciones académicas del país, evidenciando un interés creciente por optimizar y asegurar estos sistemas.
En el ámbito de la implementación arquitectónica (Cedeño Vera, 2025) [14] desarrolló el backend de un sistema de reconocimiento facial usando microservicios como base arquitectónica, buscando que el sistema pudiera crecer y dividirse en componentes manejables. Trabajó con metodología ágil de prototipado, creando servicios separados: uno para manejar usuarios y otro para procesar datos biométricos, conectados mediante un API Gateway. Lo que logró fue demostrar que los microservicios si funcionan en la práctica para este tipo de aplicaciones complejas aquí en el país. Ahora bien, su enfoque estuvo principalmente en hacer que el sistema operara correctamente y en lograr que los microservicios se comunicaran bien entre sí. No profundizó en evaluar qué tan seguros eran los mecanismos de protección que usó, ni los puso a prueba con ataques simulados.
Siguiendo esta línea de diseño seguro en microservicios (Flores Peñaherrera, 2025) [15] diseñó e implementó una arquitectura de microservicios orientada específicamente a la autenticación y gestión de usuarios para transacciones financieras en la Escuela Politécnica Nacional (EPN). Metodológicamente, el sistema se construyó integrando múltiples capas de seguridad y estableciendo un API Gateway como punto de entrada unificado para centralizar el control de accesos. Los resultados obtenidos evidenciaron que este patrón de diseño descentralizado logra una alta cohesión y bajo acoplamiento, validando la protección de la arquitectura; no obstante, su aplicación se limitó a servicios financieros REST tradicionales, lo que deja una brecha respecto a la protección de esquemas flexibles como GraphQL.
Para abordar directamente esta brecha tecnológica en el país, (Guerrero Durán, 2025) [16] propuso la integración del modelo de seguridad "Zero Trust" (Confianza Cero) en el diseño de APIs GraphQL en la Universidad Politécnica Salesiana (UPS). El estudio se ejecutó examinando primero amenazas críticas como ataques de Denegación de Servicio (DoS), exposición excesiva de datos (overfetching) e inyecciones, para luego implementar una prueba de concepto enfocada en mitigar dichas vulnerabilidades. Los resultados demostraron que la aplicación de autenticación y autorización rigurosa en cada solicitud reduce drásticamente los riesgos operativos en GraphQL. Si bien es el antecedente nacional más cercano a la problemática, el autor propuso un modelo general sin llegar a comparar cuantitativamente la eficacia de esquemas de autorización específicos (como RBAC frente a ABAC) ante ataques BOLA, métrica que constituye el núcleo diferenciador de esta tesis.
## MARCO TEÓRICO
### FUNDAMENTOS DE ARQUITECTURAS DISTRIBUIDAS 
#### Arquitectura de Microservicios
La arquitectura de microservicios es un estilo de diseño de software en el cual una aplicación distribuida se estructura como una colección de módulos pequeños, autónomos y débilmente acoplados. Estos sistemas surgieron como una alternativa tecnológica a las arquitecturas monolíticas tradicionales, las cuales presentan una inherente falta de modularidad donde cualquier modificación en el código puede afectar la estabilidad de toda la aplicación [13]. En contraposición, en un entorno de microservicios, cada componente opera de manera independiente y se comunica con el resto del ecosistema a través de un sistema de mensajería ligero o interfaces de red [17]. 
A diferencia de las aplicaciones monolíticas que exigen un empaquetado y redespliegue total ante cualquier cambio, los microservicios permiten el despliegue independiente y la escalabilidad granular [18]. Esto significa que solo los servicios con alta demanda necesitan escalar, optimizando el consumo de recursos. Como se ilustra en la Figura 1, esta separación estructural elimina el acoplamiento fuerte y divide las responsabilidades.
Sin embargo, esta descentralización trae consigo nuevos desafíos operativos. Una arquitectura de microservicios bien implementada traslada la complejidad desde el código interno hacia la red, requiriendo prácticas avanzadas de integración, despliegue continuo y, de manera crítica para esta investigación, mecanismos de seguridad y pruebas robustas para proteger la comunicación constante entre los múltiples nodos independientes.
#### Microservicios
Los microservicios son un paradigma que se caracterizan por la descomposición de aplicaciones monolíticas en tradicionales en conjunto de pequeños servicios independientes, los cuales se enfocan en realizar una función específica de negocio. La comunicación entre componentes se hace a través de APIs definidas y contratos bien establecidos.[13].
Seguridad en entornos digitales
La seguridad en los entornos digitales se usa para confirmar que ciertas personas en específico con los permisos correctos sean capaces de acceder a los recursos de una organización siendo así una parte primordial en la ciberseguridad ya que no se desea un acceso no autorizado a los sistemas [19].
Uno de los desafíos más críticos que enfrentan las organizaciones es implementar la autenticación y autorización adecuados para cada solicitud de servicio, ya que sin estos controles los atacantes pueden explotar estas vulnerabilidades para obtener acceso no autorizado. Por ello la autenticación y autorización de los usuarios en tiempo real es fundamental [11]
### TECNOLOGÍAS DE INTERCAMBIO DE DATOS: GRAPHQL
#### GraphQL
GraphQL surgió en 2012 desarrollada internamente por Facebook, posteriormente en 2015 decidieron exponer GraphQL a la comunidad [20]. En la actualidad, el lenguaje de consultar GraphQL impulsa aplicaciones debido a su eficiencia, capacidad y flexibilidad para obtener datos precisos, motivo por el cual el rendimiento se ve favorecido en diferentes plataformas[21]. Pero todas estas ventajas llevan consigo riesgos de seguridad que muchos desarrolladores los obvian como fallos de autorización, ataques de denegación de servicio, exposición de datos sensibles mediante introspección y una carencia de una limitación adecuada de la tasa [22].
GraphQL se define como un lenguaje de consultas para APIs y un tiempo de ejecución para cumplir dichas consultas con datos existentes [23]. GraphQL adopta una arquitectura basada en grafos, donde el cliente debe especificar exactamente la estructura de los datos que requiere evitando así problemas de over-fetching y under-fetching [24].
#### Arquitectura y Componentes de GraphQL.
Sistema de Esquema y Tipos: Proporciona una serie de tipos básicos y personalizados que ayudan a definir la estructura de la información. Entre estos tipos se encuentran los escalares, los objetos, listas y las interfaces. También define la relación entre los tipos que permite modelar datos de manera clara y organizada, facilitando su consulta y manipulación [13].
En GraphQL, las operaciones son los elementos principales de las definiciones ejecutables que permiten a los clientes interactuar con la API para acceder o alterar la información. El esquema de un servicio GraphQL define las capacidades de estas operaciones, las cuales se dividen en tres tipos principales[7]:
- Queries (Consultas): Son operaciones de solo lectura utilizadas para la obtención o recuperación de datos[7]. Su principal ventaja es que permiten a los clientes especificar de forma declarativa exactamente qué datos necesitan y en qué formato, lo que optimiza el uso de los recursos y evita la transferencia de información innecesaria (over-fetching) [25].
- Mutations (Mutaciones): Son operaciones fundamentales de escritura y modificación que alteran el estado de los datos en el servidor [25]. A través de las mutaciones se ejecutan acciones equivalentes al registro (inserción), actualización o eliminación de información y, tras realizar la modificación, tienen la capacidad de recuperar y devolver los datos actualizados en esa misma petición [7], [25].
- Subscriptions (Suscripciones): Son operaciones orientadas a la gestión de eventos en tiempo real [25]. Funcionan como solicitudes de larga duración que permiten a los clientes suscribirse a fuentes reactivas de datos en el servidor; de este modo, en lugar de realizar consultas repetitivas, el cliente recibe actualizaciones automáticas e instantáneas cada vez que ocurre un cambio en la información [7], [25].
### Introspección y Exposición de Metadatos
La introspección es una característica nativa de GraphQL que permite a los usuarios consultar el esquema para obtener información sobre los campos, tipos, mutaciones y consultas existentes en tiempo real [23]. Esta información se logra consultar mediante el campo reservado “__schema”, el cual expone la estructura del grafo.
Esta funcionalidad facilita el desarrollo al permitir el uso de herramientas como GraphQL, representa un riesgo de seguridad en entornos de producción debido a que la introspección habilitada expone meta data que conlleva a riesgos de seguridad [26].
#### Validación en GraphQL
Es un proceso fundamental que garantiza que una solicitud sea correcta antes de su ejecución, verifica que la consulta este bien formada, respetando sintaxis y reglas del esquema GraphQL y esta se ejecuta antes realizar la solicitud [13].
Resolvers en GraphQL
Los resolvers son funciones que están detrás de cada campo en un esquema GraphQL. Cuando llega una consulta al servidor, este activa los resolvers necesarios para traer exactamente la información que solicitó el cliente, empleando ya sea código personalizado o comportamientos que vienen por defecto. Como son el puente entre lo que dice el esquema y los datos reales, es importante que estén bien optimizados para que no se conviertan en un problema de rendimiento..
### MECANISMOS DE AUTENTICACIÓN 
En el ámbito del desarrollo web y los sistemas distribuidos existen diversos mecanismos de autenticación que han evolucionado desde métodos tradicionales como la Autenticación Básica, el uso de formularios y las sesiones gestionadas en el servidor, hasta enfoques más avanzados como SAML, la autenticación multifactor (MFA), la biometría y el Single Sign-On (SSO) [27]. Sin embargo, las API Keys, OAuth 2.0 y JWT (JSON Web Tokens) se consolidan como los mecanismos más representativos y prioritarios en las arquitecturas modernas. Las API Keys son ampliamente utilizadas por su simplicidad y eficacia para controlar el acceso a recursos limitados, permitiendo que un servidor identifique rápidamente al cliente que transmite la clave en cada una de sus solicitudes. Por otro lado, OAuth 2.0 es un marco de autorización indispensable porque permite a aplicaciones de terceros acceder a recursos de forma segura sin exponer las contraseñas o credenciales sensibles del usuario, ofreciendo una gran flexibilidad para integrarse en sistemas escalables y basados en la nube [11], [27]. Finalmente, JWT destaca como el estándar preferido por ser un formato ligero, compacto y autocontenido que transmite información de identidad firmada criptográficamente [11], [27]. La mayor fortaleza de JWT radica en su naturaleza "sin estado" (stateless), la cual elimina la necesidad de almacenar sesiones centralizadas en el servidor, lo que reduce drásticamente la sobrecarga y facilita la escalabilidad masiva en aplicaciones web, plataformas móviles y ecosistemas de microservicios [11], [27]. En conjunto, la integración de estos protocolos, en especial la poderosa combinación de la autorización de OAuth2 con la portabilidad de JWT, proporciona un marco de seguridad sumamente robusto y eficiente que protege las comunicaciones sin comprometer el rendimiento del sistema [11].
#### API Keys
##### Definición y propósito
Las Claves de API (API Keys) constituyen uno de los mecanismos más primitivos y extendidos para controlar el acceso a servicios web. Técnicamente, se definen como cadenas alfanuméricas únicas generadas por el servidor y entregadas al desarrollador de una aplicación cliente. Estas credenciales deben transmitirse en cada petición HTTP, generalmente incrustadas en el encabezado (header) o como parámetro de consulta (query parameter)[28].
Su función principal en arquitecturas modernas no es la seguridad del usuario, sino la identificación del proyecto o aplicación que realiza la llamada. Esto permite al servidor rastrear el origen del tráfico, aplicar políticas de cuotas de uso (rate limiting) y realizar auditorías de consumo por cliente [28].
##### Funcionamiento
El proceso de autenticación mediante API Keys se basa en un flujo transaccional directo. Inicialmente, el cliente o desarrollador solicita una credencial a través del proveedor del servicio, el cual genera una cadena alfanumérica única que actúa como identificador estático. Esta clave debe ser almacenada de forma segura del lado del cliente e incluirse de manera obligatoria en cada solicitud dirigida a la interfaz.
Como se ilustra en la Figura 3, una vez que la petición alcanza el servidor, este intercepta la comunicación, extrae la clave y valida su existencia y estado activo contra una base de datos o almacén de credenciales. Solo si la validación es exitosa, la petición es enrutada hacia el microservicio o recurso correspondiente para procesarla; de lo contrario, se deniega el acceso (típicamente con un error HTTP 401).
Para llevar a cabo esta comunicación, la industria reconoce tres métodos estandarizados para la transmisión de la clave desde el cliente hacia el servidor:
- A través de las cabeceras HTTP (Headers): Es el enfoque más común y seguro. Se envía la credencial utilizando cabeceras personalizadas como X-API-KEY o mediante el estándar Authorization: ApiKey <token>.
- Como parámetro de consulta (Query String): La clave se anexa directamente en la URL (ej. ?api_key=xyz). Aunque es fácil de implementar, es una práctica altamente desaconsejada en entornos de producción, ya que expone la credencial en el historial del navegador y en los registros (logs) de red del servidor.
- En el cuerpo de la petición (Body): La clave se envía encapsulada dentro de la carga útil (payload) de la solicitud, siendo aplicable únicamente para operaciones que soportan cuerpo de mensaje, como los métodos POST o PUT.

##### Casos de uso apropiados
A pesar de las limitaciones que tienen las API Keys tienen varios usos donde son suficientes como:
- APIs públicas de solo lectura como las APIs de clima, mapas o datos donde no hay información sensible del usuario.
- En las plataformas que necesitan limitar el número de llamadas por cliente para evitar el abuso del enpoint.
- Integraciones de servidores cuando están bajo control administrativo de pruebas
- Entornos de desarrollo y pruebas en fases tempranas donde es aceptable una seguridad simple.
##### Limitaciones de Seguridad frente a tokens
Es crucial establecer una distinción conceptual para este estudio: las API Keys están diseñadas para la autenticación de la máquina (cliente), no del usuario final. Desde la perspectiva de la seguridad en microservicios, este mecanismo presenta vulnerabilidades estructurales significativas:
- Naturaleza Estática: A diferencia de los tokens modernos como JWT que poseen un ciclo de vida corto, las API Keys son credenciales de larga duración. Fett et al. [29] , estas claves no se vencen por si solas; si alguien consigue una (por ejemplo, porque quedó expuesta en un repositorio de código), esa persona tiene acceso total hasta que un administrador se dé cuenta y la revoque manualmente. Además, cuando se genera una nueva clave para reemplazar la comprometida, puede terminar rompiendo la aplicación que la estaba usando legítimamente.
- Falta de Contexto: Como las API Keys no traen información sobre quién es el usuario lo que se llama "claims", no puedes implementar controles de acceso detallados como RBAC o ABAC a menos que se agregue mecanismos ajenos a este.
- Imposibilidad de granularidad: Una API Key por lo general otorga acceso completo a todos los recursos del sistema o servicio y es imposible limitar endpoints en específico o que datos pueden ver, a menos que se implementes lógicas adicionales para la validación de acuerdo a una clave específica
#### JSON Web Tokens (JWT)
##### Definición y Estándar
JSON Web Token (JWT) es un estándar abierto definido en la RFC 7519 que establece una forma compacta y autónoma (self-contained) para transmitir información segura entre partes como un objeto JSON[30]. El propósito fundamental de JWT es facilitar la transmisión segura de declaraciones (claims) en entornos restringidos, como las cabeceras de autorización HTTP (Authorization Headers) o parámetros de URL, garantizando la integridad de los datos mediante firmas digitales.
###### Estructura del Token
Un token JWT se compone de tres partes codificadas en el formato Base64Url y separadas por puntos (.), siguiendo la estructura estandarizada Header.Payload.Signature. Como se ilustra en la Figura X, cada uno de estos componentes cumple una función específica dentro del ciclo de autenticación:
1. Encabezado (Header): Define los metadatos operativos del token. Típicamente consta de dos campos principales:
- typ: El tipo de token, que por convención siempre es "JWT".
- alg: El algoritmo de firma criptográfica utilizado para asegurar el token, tales como HS256 (HMAC con SHA-256), RS256 (RSA con SHA-256) o ES256 (ECDSA con SHA-256).
2. Carga Útil (Payload): Contiene las declaraciones (claims) o la información de la entidad (generalmente el usuario autenticado) junto con datos adicionales como roles, permisos y la fecha de expiración. A diferencia de las sesiones opacas centralizadas, en este modelo los datos viajan directamente dentro del token. Los claims se dividen en tres categorías principales:
- Claims registrados (Registered): Conjunto predefinido de declaraciones recomendadas por el estándar para proporcionar interoperabilidad (aunque son opcionales). Incluyen:

- Claims públicos (Public): Son atributos personalizados definidos por quienes utilizan JWT. Para evitar colisiones de nombres, deben registrarse en el IANA JWT Registry o utilizar URIs como espacios de nombres.
- Claims privados (Private): Constituyen la información personalizada acordada de forma privada entre el cliente y el servidor (partes involucradas), tales como roles específicos del sistema, permisos o metadatos internos del usuario.
3. Firma (Signature): Se genera concatenando el encabezado codificado y la carga útil codificada (separados por un punto), aplicando posteriormente el algoritmo especificado en el header junto con una clave secreta (simétrica) o una clave privada (asimétrica). Esta firma es el mecanismo criptográfico que permite al servidor receptor confirmar la autenticidad del emisor y garantizar que el mensaje no fue modificado durante su transmisión en la red [30].
 

Flujo de autenticación con JWT
El proceso de autenticación más común usando JWT en una arquitectura de microservicios sigue estos pasos:
1.	Login inicial: El usuario envía sus credenciales (usuario/contraseña) al servicio de autenticación
2.	Validación: El servicio verifica las credenciales contra la base de datos de usuarios
3.	Generación del token: Si las credenciales son válidas, el servidor crea un JWT con los claims del usuario (id, roles, permisos) y lo firma
4.	Entrega al cliente: El token se devuelve al cliente, típicamente en el cuerpo de la respuesta
5.	Almacenamiento: El cliente guarda el token comúnmente en localStorage, sessionStorage, o cookies httpOnly
6.	Peticiones posteriores: En cada solicitud subsecuente, el cliente incluye el token en el header Authorization: Bearer <token>
7.	Validación distribuida: Cada microservicio que recibe la petición valida el token de forma independiente verificando su firma y expiración
8.	Autorización: Basándose en los claims del token (roles, permisos), el servicio decide si permite o deniega el acceso al recurso solicitado.
 

##### Ventaja de la Arquitectura Stateless
En el contexto de arquitecturas de microservicios, JWT se ha convertido en el estándar para la propagación de identidad debido a su naturaleza apátrida (stateless).
La diferencia con las sesiones tradicionales es clara: en el modelo antiguo (stateful), cada vez que llega una petición el servidor tiene que consultar una base de datos o caché para verificar que el ID de sesión sea válido. Con JWT, en cambio, cada servicio puede confirmar por sí mismo quién es el usuario sin depender de nadie más. Como explica. Gowda [31], esto funciona porque el token ya trae toda la información necesaria en su contenido y está firmado digitalmente, lo que significa que no hace falta mantener sincronizado el estado de las sesiones entre los diferentes microservicios. El resultado es un sistema que escala mejor y responde más rápido.
Esta característica es especialmente valiosa en arquitecturas de microservicios por las siguientes razones:
- Escalabilidad horizontal ya que permite agregar más instancias de servicios sin preocuparte por compartir el estado de sesión.
- Independencia de servicios para validar la identidad
- Reducción de latencia en los servidores ya que no se hace validaciones adicionales a la base de datos.
- Tolerancia a fallos debido a que si un servicio de autenticación falla los tokens existentes siguen funcionando hasta que expiren.
##### Gestión del ciclo de vida del token
Un aspecto crítico e importante en la implementación de JWT es el manejo del tiempo de vida del token:
Los JWT deben tener un tiempo de vida limitado para minimizar el riesgo si son comprometidos. Entre las prácticas más comunes se incluyen:
- Tokens de acceso cortos de 15 minutos hasta una hora.
- Tokens de refresco largos de días o semanas para tokens de renovación
- Para sesiones críticas como operaciones sensibles o financieras son de minutos.
El flujo funciona de la siguiente manera
- El cliente usa el token de acceso para las peticiones normales
- Cuando el token de acceso expira, el cliente usa el token de refresco para solicitar uno nuevo.
- El servidor de autenticación valida el token de refresco y emite un nuevo token de acceso.
- Si el token de refresco también está expirado o revocado, el usuario debe autenticarse nuevamente.

Esta estrategia ofrece un balance óptimo entre seguridad y experiencia de usuario al no solicitarle autenticarse de manera constante.
##### Revocación de tokens
Una limitación de JWT es la dificultad que enfrenta para revocar tokens antes de su expiración. Entre las principales estrategias tenemos:
- Tiempos de vida cortos para los tokens de acceso que expiran en minutos, combinados con los tokens de refresco que si se pueden revocar.
- Versionado de claves para incluir la versión del token, al incrementarla se invalidan todos los tokens seguros.
#### OAuth 2.0
##### Definición y propósito
OAuth 2.0 es el marco de autorización estándar de la industria, definido formalmente en la RFC 6749 [32]. Este protocolo permite que una aplicación (cliente) obtenga acceso limitado a un servicio HTTP en nombre de un propietario de los recursos, orquestando una interacción de aprobación sin necesidad de compartir las credenciales del usuario (usuario y contraseña) directamente con la aplicación [11].
##### Delegación vs Autenticación
Es fundamental establecer una distinción conceptual crítica para esta investigación: OAuth 2.0 es un protocolo de delegación de acceso, no de autenticación.
Loque busca OAuth 2.0 no es confirmar quién eres ("¿Quién eres?"), sino definir qué puedes hacer ("¿Qué se te permite hacer?"). Como señala Gbenle et al. [11], OAuth 2.0 separa la autorización de la lógica principal del servidor usando Access Tokens. Estos tokens básicamente representan el permiso que dio el usuario para realizar ciertas acciones específicas. Gracias a esto, los microservicios pueden verificar qué está permitido sin tener que manejar directamente las contraseñas de los usuarios, lo que hace que haya menos riesgo si alguna contraseña se ve comprometida.
##### Roles en OAuth 2.0
Para orquestar este flujo de delegación, el protocolo define cuatro roles principales que interactúan entre sí dentro del ecosistema, tal como se ilustra en la Figura 6:
1.	Propietario del recurso (Resource Owner): El usuario final que posee los datos y le otorga los accesos.
2.	Servidor de Recursos (Resource Server): El servidor el cuál aloja los recursos protegidos y valida los tokens de acceso.
3.	Cliente (Client): La aplicación que solicita acceso a los recursos protegidos.
4.	Servidor de Autorización (Authorization Server): Emite los tokens de acceso después de autenticar al usuario y obtener su autorización.
 

##### Flujos de autorización
Para adaptarse a diferentes arquitecturas y niveles de seguridad, OAuth 2.0 define múltiples flujos de autorización, conocidos como Grants, para la obtención del token de acceso:
- Authorization Code Grant: Es el flujo estándar y más seguro, diseñado para aplicaciones web con backend. Su característica principal es que el Access Token nunca transita por el navegador del usuario. Como se ilustra en la Figura Z, el proceso consiste en redirigir al usuario para que se autentique, obtener un código temporal (Authorization Code) y posteriormente intercambiar dicho código por el token mediante una comunicación segura de servidor a servidor.
- Authorization Code con PKCE: Una extensión de seguridad creada originalmente para clientes públicos (como aplicaciones móviles o Single Page Applications). Añade una capa de protección contra la intercepción del código mediante validación criptográfica dinámica. Actualmente, es la recomendación estándar para cualquier cliente que no pueda mantener un Client Secret de forma segura.
- Client Credentials Grant: Diseñado exclusivamente para la comunicación máquina a máquina (M2M), donde no existe interacción con un usuario final. El microservicio o aplicación cliente utiliza sus propias credenciales para obtener un token. Es el flujo ideal para integraciones de backend y comunicación interna entre microservicios.
- Resource Owner Password Credentials: En este flujo, el usuario proporciona sus credenciales directamente a la aplicación cliente, la cual las reenvía al servidor de autorización. Se recomienda utilizarlo únicamente cuando existe una confianza absoluta (aplicaciones first-party) o para la migración de sistemas heredados, ya que contradice el principio fundamental de OAuth de no compartir contraseñas.
 



#### VULNERABILIDADES Y AMENAZAS EN EL DESARROLLO DE APIS
##### Estándar OWASP API Security Top 10 (2025)
El Open Worldwide Application Security Project (OWASP) mantiene el estándar de facto para la clasificación de riesgos de seguridad en aplicaciones. En su edición 2023 para seguridad en APIs [33], el proyecto identifica las diez vulnerabilidades más críticas que amenazan a las interfaces de programación modernas.
Para este estudio, se decidió evaluar de manera diferente los mecanismos de autenticación y autorización:
1.	Cómo se evaluará la Autenticación: Como uno de los puntos centrales de esta investigación es el manejo de identidad, la evaluación se enfocará obligatoriamente en el siguiente riesgo:
- API2: Broken Authentication: Este vector cubre los fallos en la gestión de identidad y será el indicador principal para medir qué tan efectivos son los mecanismos que implementamos (API Keys, JWT y OAuth2). Se probará qué tan bien resiste el sistema ante ataques de suplantación, validaciones incorrectas de firmas de tokens y mal manejo de la expiración de credenciales.

2.	Vectores de Evaluación Selectiva para Autorización: Para el análisis comparativo de los modelos de autorización (RBAC vs ABAC), se seleccionará un subconjunto de pruebas basado en los siguientes vectores críticos, priorizando aquellos que resulten más pertinentes según la lógica de negocio final del prototipo experimental:
- API1:2023 Broken Object Level Authorization (BOLA): Clasificado como el riesgo número uno, ocurre cuando un usuario manipula el ID de un objeto solicitado para acceder a datos ajenos. Es el escenario ideal para probar si las políticas granulares de ABAC superan a RBAC.
- API3:2023 Broken Object Property Level Authorization (BOPLA): Junta dos problemas: cuando se exponen demasiados datos y cuando se permite asignación masiva de propiedades. En GraphQL esto es especialmente importante porque hay que verificar si un usuario puede ver campos delicados (como email o salario) dentro de un objeto al que sí tiene permiso de acceder en general.
- API5:2023 Broken Function Level Authorization (BFLA): Se refiere a cuando fallan los controles de roles, permitiendo que un usuario común logre ejecutar acciones de administrador (como Mutations sensibles) porque la validación de permisos en el controlador o resolver no es suficiente.

### MECANISMOS DE AUTORIZACIÓN
Existen diversos mecanismos de autorización que han evolucionado desde enfoques tradicionales hasta métodos más avanzados para gestionar de forma segura el control de acceso, entre los cuales se encuentran el Control de Acceso Discrecional (DAC), el Control de Acceso Obligatorio (MAC), el Control de Acceso Basado en Políticas (PBAC) y el Control de Acceso Basado en Relaciones (ReBAC) [34], [35] . Sin embargo, los modelos más representativos y comúnmente adoptados en la industria son el Control de Acceso Basado en Roles (RBAC) y el Control de Acceso Basado en Atributos (ABAC) [35]. RBAC se mantiene como uno de los mecanismos más adoptados debido a su simplicidad, transparencia y facilidad para alinearse con las jerarquías organizacionales; este modelo centraliza la gestión al asignar permisos a roles laborales predefinidos en lugar de a identidades individuales, lo que facilita la administración a gran escala y garantiza el principio de menor privilegio [34], [35]. Por otro lado, ABAC es fundamental para las arquitecturas de seguridad modernas que exigen adaptabilidad, ya que supera la rigidez de los roles estáticos al evaluar dinámicamente múltiples variables en tiempo real, tales como los atributos del usuario, la sensibilidad del recurso y el contexto ambiental (como la hora o la ubicación IP), brindando un control de acceso mucho más flexible y finamente granulado [34], [35]. La gran relevancia de ambos mecanismos radica en que su integración es la base de las tendencias actuales de ciberseguridad, las cuales apuntan a modelos híbridos que combinan la base organizativa y estructural de RBAC con la flexibilidad y el análisis de contexto de ABAC para proteger arquitecturas dinámicas, distribuidas y basadas en la Confianza Cero (Zero Trust).
#### Control de Acceso Basado en Roles (RBAC)
##### Definición y Estructura
El control de acceso basado en roles se refiere a la idea de asignar permisos a los usuarios según su rol dentro de una organización. Al usar RBAC para la gestión de roles, se analiza la necesidad de los usuarios y se agrupan en roles de acuerdo a las responsabilidades más comunes [36], este modelo se fundamenta en la premisa de agrupar usuarios con necesidades idénticas, simplificando la administración de privilegios a gran escala.
En términos de estructura, RBAC funciona poniendo una capa intermedia entre el usuario y el recurso, creando esta relación Usuario ↔ Rol ↔ Permiso. Así, cuando alguien cambia de puesto o deja la empresa, el administrador del sistema tiene que ajustar el rol de las personas sin tener que estar quitando permisos uno por uno en cada recurso.
##### Limitaciones en Arquitecturas Modernas
Si bien RBAC es eficaz para estructuras organizativas jerárquicas y estáticas, presenta desafíos en entornos dinámicos de microservicios. La principal desventaja es el fenómeno conocido como "explosión de roles". A medida que los requisitos de autorización se vuelven más granulares (ej. "acceso solo a mis propios datos" o "acceso solo en horario laboral"), el modelo obliga a la creación de múltiples roles específicos para cubrir cada variación, volviendo el sistema difícil de mantener y escalar [36].
##### Componentes del modelo RBAC
Para materializar esta estructura, como se ilustra en la Figura 8, el modelo RBAC consta de cuatro elementos fundamentales:
1.	Usuarios (users): Son los sujetos que interactúan con el sistema los cuales pueden tener asignado uno o varios roles.
2.	Roles (roles): Son las agrupaciones lógicas que representan las responsabilidades dentro de un sistema como, por ejemplo: “admin”, “manager”, “developer”, “viewer” y a estos se les define un conjunto de roles asociados.
3.	Permisos (permissions): son las autorizaciones específicas para realizar acciones sobre los recursos del sistema y se pueden definir de la siguiente manera: “read:users”, “delete:users”, “view:users” y estos permisos se asignan a los roles no se los asigna directamente a los usuarios.
4.	 Sesiones (sessions): Cuando un usuario inicia sesión, activa uno o más de sus roles.
 

##### Niveles de RBAC según NIST
El estándar de NIST establece cuatro niveles de implementación
1.	Nivel 1: RBAC Plano (Flat RBAC): Es la implementación básica de usuarios, roles y permisos donde no existe la jerarquía de roles y es suficiente para organizaciones con estructuras simples
2.	Nivel 2: RBAC Jerarquico (ierarchical RBAC): Introduce la herencia de roles y un rol puede heredar los permisos de otro rol lo cual ayuda a reducir la redundancia en la definición de permisos.
3.	Nivel 3: RBAC con Restricciones (Constrained RBAC): Agrega la separación de deberes, restricciones estáticas las cuales no permite tener 2 roles conflictivos simultáneamente y restricciones dinámicas que no permiten que dos roles conflictivos se activen en la misma sesión.
4.	Nivel 4: RBAC Simétrico (Symmetric RBAC): Agrega revisión de permisos lo que permite consultar que usuarios tiene que roles lo cual es necesario para análisis de seguridad y auditorias.
#### Control de Acceso Basado en Atributos (ABAC)
##### Definición y Modelo
Representa una evolución hacia un modelo de seguridad más dinámico y contextual. El Instituto Nacional de Estándares y Tecnología (NIST) define ABAC en su publicación especial 800-162 como una metodología donde los derechos de acceso se otorgan a través del uso de políticas que combinan atributos del usuario, del recurso y del entorno [37].

A diferencia de RBAC que se basa en roles fijos, ABAC evalúa reglas en el momento exacto en que ocurre la solicitud. Según el estándar NIST [37], este modelo trabaja con cuatro tipos de atributos:
- Sujeto (Subject): Características de la persona que pide acceso (por ejemplo: edad, puesto que ocupa, nivel de autorización que tiene).
- Objeto (Object): Características del recurso al que se quiere acceder (por ejemplo: qué tipo de archivo es, quién lo creó, qué tan confidencial es).
- Acción (Action): Lo que se quiere hacer (por ejemplo: ver, modificar, eliminar).
- Entorno (Environment): El contexto en el que ocurre (por ejemplo: a qué hora es, desde qué dirección IP, desde dónde geográficamente).
##### Componentes principales de la arquitectura:
Para procesar esta evaluación dinámica, el modelo ABAC se estructura en cuatro componentes lógicos interactivos, tal como se ilustra en la Figura 9:
1.	Policy Enforcement Point (PEP): Es el punto donde se interceptan las solicitudes de acceso, generalmente es implementado como middleware y envía la solicitud al PDP para evaluación.
2.	Policy Decision Point (PDP): Es el motor de políticas que evalúa las reglas, recibe atributos del sujeto, objeto, acción y entorno y toma la decisión de permitir o negar.
3.	Policy Information Point (PIP): Es el repositorio de atributos que provee información adicional necesaria para la evaluación y puede consultar bases de datos, servicios externos, APIs.
4.	Policy Administration Point (PAP): Es la interfaz para crear y gestionar políticas, define las reglas de autorización y permite actualizar políticas sin cambiar código.
 
##### Ventajas en Microservicios y GraphQL
Cuando hablamos de microservicios, Sänger et al. [10] lantean que ABAC tiene una ventaja clave sobre otros modelos: permite control muy detallado.
Mientras que RBAC se complica al intentar controlar el acceso a datos específicos (terminas creando demasiados roles), ABAC te deja crear una sola política general que se ajusta automáticamente a cada solicitud que llega. Esto es especialmente importante para proteger APIs GraphQL, donde los usuarios pueden pedir campos muy específicos y sensibles en una sola petición HTTP. Con políticas basadas en atributos puedes verificar el acceso campo por campo (field-level) y objeto por objeto (object-level) sin mezclar esta lógica con el código de la aplicación.
### EXPERIMENTACIÓN EN LA INGENIERÍA DE SOFTWARE
La experimentación en ingeniería de software es un enfoque sistemático para evaluar de manera objetiva las diferentes tecnologías, métodos y herramientas mediante estudios empíricos controlados. A diferencia de simplemente construir software, este tipo de investigación busca generar evidencia medible sobre que funciona mejor y bajo que circunstancias. Para llevar a cabo este tipo de estudios de forma rigurosa, existe una guía metodológica reconocida internacionalmente que describe paso a paso como diseñar, ejecutar y analizar experimentos en el contexto del desarrollo del software.
#### Definición y propósito
La guía que presenta Claes Wohlin y sus colaboradores "Experimentation in Software Engineering" [38] se ha convertido en la referencia metodológica para hacer investigación empírica del software. A diferencia de metodologías como Scrum o XP las cuales se enfocan en como construir un producto de software, la guía de Wholin esta diseñada para evaluar de forma rigurosa las tecnologías, métodos o herramientas y determinar cuál funciona mejor en un entorno controlado.
En este estudio, este marco nos da la estructura que necesitamos para comparar de manera objetiva los mecanismos de seguridad y medir como afectan a la mitigación de vulnerabilidades, evitando que opiniones subjetivas influyan en los resultados.
#### Fases del Proceso Experimental
Según Wohlin [38], un experimento formal se estructura en cinco actividades fundamentales que garantizan la validez interna y externa de los resultados:
1.	Definición (Scoping): Se establece el alcance del experimento, definiendo el objetivo (analizar mecanismos de seguridad), el propósito (evaluar eficacia), la perspectiva (desde el punto de vista del desarrollador/atacante) y el contexto (arquitectura de microservicios GraphQL).
2.	Planificación (Planning): Esta es la fase más crítica donde se diseñan las hipótesis (nula y alternativa), se eligen las variables, se determinan qué elementos se van a experimentar (los microservicios) y se define cómo se van a recolectar los datos.
3.	Operación (Operation): Aquí es donde se ejecuta el experimento. En este proyecto significa preparar el ambiente de pruebas (testbed), ejecutar los ataques simulados y recoger las métricas de bloqueo y logs.
4.	Análisis e Interpretación (Analysis & Interpretation): Se procesan los datos numéricos recolectados usando estadística descriptiva o pruebas de hipótesis para decidir si se aceptan o rechazan las suposiciones iniciales sobre qué tan efectivos son RBAC y ABAC.
5.	Presentación (Presentation): Se documenta y empaqueta todo para que los resultados puedan difundirse en el ámbito académico y otros puedan replicar el estudio.
# CAPITULO III
El presente capítulo desarrolla el diseño del experimento controlado que constituye el núcleo metodológico de esta investigación. Partiendo de los objetivos específicos planteados en el Capítulo I y del fundamento teórico construido en el Capítulo II, este apartado indica cómo se llevará a cabo la comparación de los mecanismos de autenticación y autorización en una arquitectura de microservicios con GraphQL.
La estructura metodológica sigue el proceso de cinco fases propuesto por Wohlin [39] en Experimentation in Software Engineering: Definición (Scoping), Planificación (Planning), Operación (Operation), Análisis (Analysis & Interpretation) y Presentación (Presentation). Este capítulo desarrolla en detalle las tres primeras fases, que comprenden desde la delimitación del objetivo hasta el diseño del entorno experimental y el procedimiento de recolección de datos.
El experimento está diseñado para generar evidencia cuantitativa sobre la eficacia de seis tratamientos de mecanismos de seguridad frente a los vectores de ataque OWASP API1:2023 (Broken Object Level Authorization — BOLA) y API2:2023 (Broken Authentication), considerados los más críticos y prevalentes para arquitecturas GraphQL según la revisión de literatura del Capítulo II. El entorno experimental emplea datos reales del dataset Brazilian E-Commerce Public Dataset de Olist, expuestos mediante una API GraphQL, lo que proporciona una representación auténtica de las condiciones de un sistema de comercio electrónico distribuido.
## Definición del Experimento
### Objetivo del Experimento
Siguiendo la plantilla de definición de objetivos GQM (Goal-Question-Metric) propuesta por Basili [40] e integrada en el marco de Wohlin, el objetivo del experimento se formula de la siguiente manera:
Analizar los mecanismos de autenticación (API Keys, JWT, OAuth 2.0) y de autorización (RBAC, ABAC) con el propósito de comparar su eficacia en la mitigación de vulnerabilidades de seguridad con respecto a la tasa de bloqueo de ataques BOLA y Broken Authentication desde el punto de vista del investigador en el contexto de una arquitectura de microservicios con API GraphQL sobre datos reales de comercio electrónico.
### Preguntas del experimento
A partir del objetivo anterior, se derivan las siguientes preguntas de investigación que guiarán el análisis de resultados:
- PI1: ¿Cuál mecanismo de autenticación (API Keys, JWT u OAuth 2.0) presenta la mayor tasa de bloqueo frente a ataques de Broken Authentication (OWASP API2:2023) en una API GraphQL sobre microservicios?
- PI2: ¿Cuál modelo de autorización (RBAC o ABAC) presenta la mayor tasa de bloqueo frente a ataques de Broken Object Level Authorization (OWASP API1:2023) en una API GraphQL sobre microservicios?
- PI3: ¿Qué combinación de mecanismo de autenticación y modelo de autorización (tratamiento T1–T6) ofrece la mayor eficacia de seguridad global?
### Contexto del Experimento
El experimento se enmarca en un contexto controlado con las siguientes características:
Cuadro  1: Detalles del contexto del experimento

| Dimensión | Descripción |
|---|---|
| Tipo de experimento | Experimento controlado con sujetos y objetos definidos |
| Entorno | Laboratorio local |
| Sujetos | Tratamiento de seguridad (T1-T6) |
| Objetos | Solicitudes HTTP dirigidas a APIs GraphQL |
| Datos | Dataset Brazilian E-Commerce de Olist [41] |
|Perspectiva | Del investigador actuando como atacante controlado
|Escala | 30 ejecuciones por tratamiento

### Especificidad del Contexto GraphQL: Diferencias con REST
Una pregunta metodológica legítima para cualquier experimento de seguridad en APIs es si los resultados son transferibles entre paradigmas de diseño. Esta sección justifica por qué el presente experimento es específico del paradigma GraphQL y por qué sus resultados no pueden extrapolarse directamente a APIs REST, ni sus conclusiones sustituirse con estudios previos realizados sobre arquitecturas REST.
### El problema el endpoint único 
La diferencia arquitectónica más relevante para la seguridad es que una API REST expone múltiples endpoints, cada uno mapeado a un recurso específico, mientras que una API GraphQL expone un único endpoint para la totalidad de las operaciones del sistema.

| Aspecto | API REST | API GraphQL (este experimento) |
|---|---|---|
| Número de endpoints | Múltiples (GET /orders/{id}, POST /orders, GET /customers/{id}, …) | Uno solo: POST /graphql |
| Ubicación del identificador del recurso | En la URL (/orders/136cce7f…) | Dentro del body de la request, embebido en el texto de la query |
| Control de acceso por ruta | Posible: el middleware evalúa el path de la URL | Imposible: todas las operaciones comparten el mismo path /graphql |
| Autorización por URL | Un API Gateway puede aplicar RBAC por patrón de URL | Solo ve POST /graphql; no puede distinguir operaciones sin parsear el body |
| Parsing requerido por el middleware | No necesario: el recurso se identifica por la URL | Obligatorio: el middleware debe parsear el string GraphQL para extraer el tipo de operación y el ID del recurso |

Esta diferencia tiene consecuencias directas para los mecanismos de seguridad: en REST, una política RBAC de "solo los clientes pueden acceder a /orders/{id}" es suficiente para controlar el tipo de recurso. En GraphQL, esa misma política no puede implementarse a nivel de URL porque todas las queries legítimas y maliciosas llegan al mismo endpoint. La autorización debe ocurrir en la capa del resolver, lo que modifica sustancialmente el diseño del mecanismo de seguridad y su superficie de fallo.
### El desafío de la autorización a nivel de campo
REST autoriza a nivel de endpoint: el servidor decide si el usuario puede acceder a /orders/{id} como un todo. GraphQL introduce la necesidad de autorización a nivel de campo: un usuario podría tener permiso de leer order_status pero no payments.payment_value del mismo objeto Order. Esta granularidad no existe en REST de forma nativa.
Los tratamientos RBAC (T1, T3, T5) del experimento son especialmente sensibles a este problema: al verificar únicamente el rol, el guard RBAC concede acceso a la operación getOrder completa, incluyendo todos sus campos anidados. Un modelo ABAC (T2, T4, T6) puede impedir el acceso al objeto completo cuando el solicitante no es el propietario, pero la autorización a nivel de campo individual sigue siendo un área de investigación activa en el ecosistema GraphQL.
## Planificación del Experimento – Planning
### Hipótesis
1. Hipótesis para Autenticación (PI1 Vector API2: Broken Authentication)
    - H0_auth: No existe diferencia estadísticamente significativa en la tasa de bloqueo de ataques de Broken Authentication entre los mecanismos API Keys, JWT y OAuth 2.0 cuando se aplican en una API GraphQL sobre microservicios.
    - H1_auth: Al menos uno de los mecanismos de autenticación (API Keys, JWT u OAuth 2.0) presenta una tasa de bloqueo de ataques de Broken Authentication estadísticamente significativa superior a los demás.
2. Hipótesis para autorización (PI2 Vector API1:BOLA)
    - H0_authz: No existe diferencia estadísticamente significativa en la tasa de bloqueo de ataques BOLA entre los modelos RBAC y ABAC cuando se aplican en una API GraphQL sobre microservicios.
    - H1_authz: El modelo ABAC presenta una tasa de bloqueo de ataques BOLA estadísticamente significativa superior al modelo RBAC en una API GraphQL sobre microservicios.
### Variables del experimento
#### Variables Independientes

|Factor |	Niveles |	Descripción|
| -- | --| -- |
|Autenticación | APIE Keys, JWT, OAUTH 2.0 | Mecanismo utilizado para verificar la identidad del cliente en cada solicitud.| 
|Autorización | RBAC, ABAC | Modelo utilizado para decidir si el cliente autenticado tiene permiso para acceder a un recurso solicitado.|

#### Variables Dependientes

|Variable	|Indicador	|Unidad de medida|
| -- | --| -- |
|Seguridad	|Tasa de bloqueo de ataques	Porcentaje| (%)|

#### Variables de control
Son aquellas que permanecen constantes durante todo el experimento para garantizar que las diferencias observadas en la variable dependiente sean atribuibles exclusivamente a los tratamientos:
| Variable de control | Valor fijo |
|---|---|
| Dataset de datos | Brazilian E-Commerce [41] |
| Esquema GraphQL | Tipos orders, customers, products, selles |
| Operaciones GraphQL | 1 Query (getOrder) y 1 Mutation (createOrder) |
| Infraestructura | Red interna aislada |
| Número de ejecuciones | 30 tratamientos por vectores de ataque |
| Herramientas de pruebas | Misma herramienta cliente para todos los tratamientos |
| Roles definidos | admin, seller, customer |

### Diseño Factorial 3x2
El diseño del experimento es de tipo factorial completo con dos factores: autenticación (3 niveles) y autorización (2 niveles). Esta combinación produce 6 tratamientos únicos, cada uno de los cuales representa una configuración de seguridad completa e independiente para la API GraphQL.

| Autenticación / Autorización | B1. RBAC | B2. ABAC |
|:---:|:---:|:---:|
| A1. API Keys | A1 - B1 | A1 - B2 |
| A2. JWT | A2 - B1 | A2 - B2 |
| A3. OAuth 2.0 | A3 - B1 | A3 - B2 |

El diseño factorial completo garantiza que se evalúen todas las combinaciones posibles de los dos factores, lo que permite detectar no solo los efectos individuales de cada mecanismo, sino también posibles efectos de interacción entre autenticación y autorización.

Escenario | Descripción de la configuracio |
|:---:|:---:|
ESC-01: valida	|ESC-01: C01 accede a su orden
|ESC-02: valida	|ESC-02: El cliente registra un nuevo pedido en la plataforma
ESC-03:BOLA	|ESC-03: Un cliente intenta ver el pedido de otro cliente (BOLA)
ESC-04:BrokenAuth	|ESC-04: Un atacante intenta operar con una sesión caducada
ESC-05:BrokenAuth	|ESC-05: Un atacante presenta un token con firma inválida
ESC-06:BrokenAuth	|ESC-06: Revocación de credencial base para la emisión de JWT.



### Métricas e indicadores

Las métricas utilizadas para medir la variable dependiente se fundamentan en el estándar ISO/IEC 25023 (Systems and software engineering — Systems and software Quality Requirements and Evaluation — Measurement of system and software product quality) [42], específicamente en las subcaracterísticas de seguridad, y se mapean con precisión a los vectores de ataque OWASP API Security Top 10 (2023) seleccionados para este estudio.

| # | Vector OWASP | Métrica ISO/IEC 25023 | Código | Fórmula de medición | Unidad |
|---:|---|---|:---:|---|:---:|
| 1 | API1:2023 — BOLA | Controlabilidad de acceso (Access controllability) | SCo-1-G | (Solicitudes no autorizadas bloqueadas / Total de solicitudes no autorizadas enviadas) × 100 | % |
| 2 | API1:2023 — BOLA | Integridad de datos (Data corruption prevention) | SIn-1-G | (Registros no modificados de forma no autorizada / Total de registros objetivo) × 100 | % |
| 3 | API2:2023 — Broken Auth | Suficiencia del mecanismo de autenticación (Authentication mechanism sufficiency) | SAu-1-G | (Credenciales inválidas, expiradas o falsificadas rechazadas / Total de credenciales inválidas enviadas) × 100 | % |

#### Definición operacional de cada métrica:

SCo-1-G — Tasa de Control de Acceso (TCA): Mide la proporción de intentos no autorizados de acceder al objeto de otro usuario (ataque BOLA) que el sistema detecta y bloquea antes de retornar datos. Un valor de 100% indica que ninguna solicitud BOLA obtuvo acceso a datos ajenos.
- TCA="Ataques BOLA bloqueados" /"Total ataques BOLA ejecutados" ×100

SIn-1-G — Tasa de Integridad de Datos (TID): Mide si los ataques BOLA lograron modificar datos que no le correspondían al atacante. Complementa SCo-1-G al verificar que el control de acceso no solo impide la lectura sino también la escritura no autorizada.

- TID="Registros no alterados no autorizadamente" /"Total registros objetivo" ×100

SAu-1-G — Tasa de Rechazo de Credenciales Inválidas (TRCI): Mide la proporción de intentos de autenticación con credenciales inválidas (tokens expirados, firmas incorrectas, claves revocadas, tokens de otro usuario) que el sistema rechaza correctamente con código HTTP 401.

- TRCI=("Credenciales inv" "a"  ˊ"lidas rechazadas" )/("Total credenciales inv" "a"  ˊ"lidas enviadas" )×100

#### Cantidad de ejecuciones y plan de medición
El número de 30 ejecuciones por tratamiento es adecuado para este experimento controlado. Dado que la variable dependiente es binaria (bloqueo = 1, fallo = 0), con 15 observaciones por celda se puede calcular con precisión la tasa de éxito del mecanismo y aplicar las pruebas no paramétricas correspondientes: la prueba de Kruskal-Wallis (para comparación entre los 3 mecanismos de autenticación) y la prueba U de Mann-Whitney (para comparación entre los 2 modelos de autorización), siguiendo las recomendaciones de Wohlin [39] donde el efecto esperado entre RBAC puro y ABAC ante ataques BOLA es de magnitud absoluta (0% vs. 100% de bloqueo), lo que hace que la diferencia sea detectable incluso con muestras pequeñas.

### Escenarios experimentales
Los escenarios experimentales son la unidad operativa del experimento: cada escenario describe una tarea realista que el investigador, actuando en el rol indicado, ejecutará de forma repetida y controlada bajo cada uno de los seis tratamientos (T1–T6). A diferencia de los casos de uso UML que modelan el comportamiento esperado del sistema, los escenarios experimentales se centran en qué hace el participante, en qué contexto realista lo hace y qué resultado medible se espera observar. Este enfoque es coherente con la metodología de Wohlin [39] para experimentos controlados en ingeniería de software, donde los escenarios garantizan que las condiciones de ejecución sean uniformes y comparables entre tratamientos.
Se definen seis escenarios: dos de flujo legítimo (que establecen la línea base de funcionamiento) y cuatro de ataque (que generan los datos de la variable dependiente). Todos los escenarios operan sobre la plataforma de comercio electrónico construida con el dataset de Olist y las operaciones GraphQL getOrder y createOrder.

ESC-01 — El cliente consulta el estado de su propio pedido
Contexto: Un cliente registrado en la plataforma Olist desea verificar si su pedido fue entregado. Ingresa a la plataforma con sus credenciales y consulta el detalle de una orden que él mismo realizó: el estado de entrega (order_status), los artículos que compró (items) y el monto total que pagó (payments.payment_value). Esta es la operación de consulta más frecuente en cualquier plataforma de e-commerce.
Rol del participante: Investigador simulando a customer_01 — cliente autenticado con credenciales válidas.
Precondiciones:
- El entorno del tratamiento activo (T1–T6) está inicializado y operativo.
- customer_01 tiene una credencial válida y vigente (API Key, JWT o Access Token según el tratamiento).
- Existe en la base de datos al menos una orden cuyo customer_id corresponde a customer_01.
Tarea experimental:
1.	Obtener la credencial válida de customer_01 para el tratamiento activo.
2.	Seleccionar aleatoriamente un order_id del conjunto de órdenes pertenecientes a customer_01.
3.	Enviar la query getOrder(order_id: <seleccionado>) al MS-Data incluyendo la credencial en la cabecera HTTP.
4.	Registrar el código de respuesta HTTP y el contenido devuelto por el sistema.
Variable observable: Código HTTP de respuesta (200 = acceso concedido correctamente).
Contribución a la investigación: Establece la línea base de funcionamiento correcto. Si un tratamiento falla este escenario, sus resultados de ataque no son válidos.

ESC-02 — El cliente registra un nuevo pedido en la plataforma
Contexto: Un cliente autenticado en la plataforma selecciona productos de un vendedor y confirma la compra generando una nueva orden. Esta operación de escritura es el segundo flujo legítimo más importante del sistema: si el mecanismo de seguridad de un tratamiento bloquea incorrectamente esta operación válida, el tratamiento presenta un falso positivo y sus mediciones de ataque son cuestionables.
Rol del participante: Investigador simulando a customer_01 cliente autenticado realizando una compra legítima.
Precondiciones:
- customer_01 tiene credencial válida y vigente.
- Existen en la base de datos al menos un product_id y un seller_id válidos.
Tarea experimental:
1.	Obtener la credencial válida de customer_01 para el tratamiento activo.
2.	Seleccionar aleatoriamente un product_id y el seller_id correspondiente del dataset de Olist.
3.	Enviar la mutation createOrder(customer_id, product_ids, seller_id) al MS-Data con la credencial.
4.	Registrar el código de respuesta HTTP y el order_id retornado.
Variable observable: Código HTTP de respuesta (200 = orden creada correctamente).
Contribución a la investigación: Establece la línea base de escritura. Valida que el tratamiento no genera falsos positivos en operaciones legítimas de creación.
ESC-03 — Un cliente intenta ver el pedido de otro cliente (BOLA)
Contexto: Un cliente de la plataforma obtiene o adivina el identificador de una orden que no le pertenece y, usando sus propias credenciales completamente válidas y vigentes, intenta consultar su detalle: el historial de compras, los montos pagados y el método de pago de otro cliente. Este es el ataque de Broken Object Level Authorization (BOLA, API1:2023): la credencial es auténtica, pero el recurso solicitado pertenece a otro usuario.
Justificación de diseño RBAC puro (T1, T3, T5): U n requisito metodológico crítico del experimento es que los tratamientos RBAC y ABAC exhiban comportamientos mediblemente distintos ante el ataque BOLA. Para garantizar esta diferenciación, los tratamientos T1, T3 y T5 implementan RBAC en su forma pura: el guard de autorización evalúa únicamente el rol del usuario (customer, seller, admin) y decide si ese rol tiene permiso para el tipo de operación y recurso solicitados. El guard RBAC no consulta ni compara el identificador del dueño del objeto (customer_id de la orden) con el identificador del usuario autenticado. Esta comparación de atributos del objeto es, por definición, una política ABAC, y su inclusión en el guard RBAC eliminaría la variable independiente del experimento al hacer que ambos modelos se comporten idénticamente.
Rol del participante: Investigador simulando a customer_01 - cliente autenticado realizando un acceso no autorizado sobre datos de customer_02.
Precondiciones:
- customer_01 tiene credencial válida y vigente para el tratamiento activo.
- Existe en la base de datos al menos una orden cuyo customer_id pertenece a customer_02.
- El investigador conoce el order_id objetivo (seleccionado aleatoriamente del pool de órdenes de customer_02).
Tarea experimental:
1.	Obtener la credencial válida de customer_01 para el tratamiento activo.
2.	Seleccionar aleatoriamente un order_id del pool de órdenes pertenecientes a customer_02.
3.	Enviar getOrder (order_id: <orden_de_customer_02>) al MS-Data con la credencial de customer_01.
4.	Registrar el código HTTP y, si la respuesta es 200, registrar si los campos customer_unique_id, payments.payment_value y payments.payment_type de customer_02 fueron expuestos.
Variable observable: Código HTTP (200 = ataque exitoso, fallo de seguridad; 403 = ataque bloqueado).
Contribución a la investigación: Es el escenario central del experimento. Responde PI2 y alimenta las métricas SCo-1-G (Tasa de Control de Acceso) y SIn-1-G (Integridad de Datos). Genera las 90 ejecuciones BOLA del plan (15 por tratamiento × 6 tratamientos).
ESC-04 — Un atacante intenta operar con una sesión caducada
Contexto: Tras una sesión de compra anterior, el token o clave de acceso de un usuario caducó. Un atacante externo o el mismo usuario intenta usar esa credencial vencida para crear una nueva orden en el sistema sin volver a autenticarse. En producción, este escenario ocurre con frecuencia cuando los tokens no se renuevan y se reutilizan por error o de forma maliciosa.
Rol del participante: Investigador simulando a un atacante con credencial expirada (escenario BA-01).
Precondiciones:
- Se dispone de una credencial que fue válida en el pasado: JWT con claim exp configurado 30 minutos en el pasado / Access Token expirado / API Key con campo expires_at anterior al momento de ejecución.
- La credencial es estructuralmente correcta (no fue adulterada); simplemente ha superado su tiempo de vida.
Tarea experimental:
1.	Preparar la credencial expirada correspondiente al tratamiento activo.
2.	Enviar createOrder(customer_id, product_ids, seller_id) al MS-Data con la credencial expirada.
3.	Registrar el código HTTP de respuesta.
Variable observable: Código HTTP (401 = ataque bloqueado correctamente; 200 = fallo de seguridad grave).
Contribución a la investigación: Responde PI1 y alimenta la métrica SAu-1-G (Tasa de Rechazo de Credenciales Inválidas). Representa 8 ejecuciones por tratamiento (48 en total).
ESC-05 — Un atacante presenta un token con firma inválida
Contexto: Un atacante interceptó un token de otro usuario y trató de modificar su contenido para obtener más privilegios (cambió el campo role de customer a admin). Sin embargo, no posee la clave secreta del servidor para recalcular la firma criptográfica. El sistema debe detectar que la firma no corresponde al contenido y rechazar la solicitud. Este ataque es una forma real de token tampering, documentada en la guía de pruebas de la OWASP.
Rol del participante: Investigador simulando a un atacante que adulteró un token (escenario BA-02).
Precondiciones:
- Se dispone de un token bien formado (estructuralmente válido) cuyo segmento Payload fue modificado: el claim role fue cambiado de customer a admin, pero la firma permanece igual a la del token original.
- Para API Keys: la clave fue modificada en uno de sus caracteres para simular un intento de adivinanza.
Tarea experimental:
1.	Preparar el token adulterado (o la API Key modificada) para el tratamiento activo.
2.	Enviar createOrder(...) al MS-Data usando este token adulterado.
3.	Registrar el código HTTP de respuesta.
Variable observable: Código HTTP (401 = adulteración detectada; 200 = fallo de seguridad crítico).
Contribución a la investigación: Alimenta la métrica SAu-1-G (Tasa de Rechazo de Credenciales Inválidas). Representa 8 ejecuciones por tratamiento (48 en total).
 ESC-06 — Revocación de credencial base para la emisión de JWT.
Contexto: Tras detectar una brecha de seguridad, el equipo de operaciones revocó una API Key comprometida y cerró la sesión de todos los tokens activos. Un atacante que ya poseía esas credenciales intenta seguir usándolas para crear órdenes fraudulentas. El sistema debe rechazar estas credenciales, aunque sean criptográficamente correctas, porque fueron explícitamente invalidadas.
Rol del participante: Investigador simulando a un atacante con credencial revocada (escenario BA-03).
Precondiciones:
- Se dispone de una credencial que fue revocada antes del inicio de la ejecución: API Key con status='revoked' en la BD / JWT cuyo JWT ID está en la lista negra del MS-Auth / Access Token revocado mediante el endpoint /oauth/revoke del AS propio.
- La credencial es criptográficamente válida (no fue adulterada).
Tarea experimental:
1.	Preparar la credencial revocada correspondiente al tratamiento activo.
2.	Enviar createOrder(...) al MS-Data usando esa credencial.
3.	Registrar el código HTTP de respuesta.
Variable observable: Código HTTP (401 = revocación respetada; 200 = fallo de seguridad grave).
Contribución a la investigación: Alimenta la métrica SAu-1-G y evalúa la robustez del mecanismo de revocación de cada tratamiento. Representa 7 ejecuciones por tratamiento (42 en total).
## Arquitectura del Entorno Experimental
### MS-Data: Microservicio de Datos
El MS-Data es el microservicio que expone los datos del Brazilian E-Commerce Public Dataset [41] a través de una API GraphQL. Este microservicio actúa como el recurso protegido del experimento: es el objeto sobre el cual los ataques BOLA intentan acceder de forma no autorizada, y al cual los ataques de Broken Authentication intentan acceder con credenciales inválidas.

Datos del dataset: El dataset de Olist contiene registros reales anonimizados de un marketplace de comercio electrónico brasileño, con más de 100.000 órdenes realizadas entre 2016 y 2018. Para el experimento se utilizan cuatro tablas del dataset:

| Tabla Olist | Entidad GraphQL | Campos disponibles | Datos sensibles para pruebas |
|---|---|---|---|
| `olist_orders_dataset.csv` | `Order` | `order_id`, `customer_id`, `order_status`, `order_purchase_timestamp`, `order_delivered_customer_date` | `order_status`, `customer_id` |
| `olist_customers_dataset.csv` | `Customer` | `customer_id`, `customer_unique_id`, `customer_zip_code_prefix`, `customer_city`, `customer_state` | `customer_unique_id`, `customer_zip_code_prefix` |
| `olist_products_dataset.csv` | `Product` | `product_id`, `product_category_name`, `product_name_lenght`, `product_description_lenght`, `product_photos_qty`, `product_weight_g` | `product_category_name` |
| `olist_sellers_dataset.csv` | `Seller` | `seller_id`, `seller_zip_code_prefix`, `seller_city`, `seller_state` | `seller_id`, `seller_city` |
| `olist_order_items_dataset.csv` | `OrderItem` | `order_id`, `order_item_id`, `product_id`, `seller_id`, `price`, `freight_value` | `price`, `freight_value` |
| `olist_order_payments_dataset.csv` | `OrderPayment` | `order_id`, `payment_sequential`, `payment_type`, `payment_installments`, `payment_value` | `payment_value`, `payment_type` |



Rol en el experimento: El MS-Data NO implementa lógica de autenticación ni autorización propia. Recibe solicitudes GraphQL que ya han sido validadas y enriquecidas por el MS-Auth. Esta separación de responsabilidades es consistente con los principios de arquitectura de microservicios descritos en el Capítulo II.
#### MS-Auth: Microservicio de Autenticación y Autorización\
El MS-Auth es el microservicio responsable de gestionar la identidad y los permisos de acceso. Su configuración varía según el tratamiento activo (T1–T6), siendo el componente central del experimento.


##### Usuarios del sistema (sujetos de prueba)

Para garantizar la coherencia entre todos los tratamientos, se definen tres perfiles de usuario fijos que son reconocidos en los tres mecanismos de autenticación:

| Rol | Permisos en RBAC | Atributos en ABAC |
|---|---|---|
| admin | Acceso total a todos los recursos | `role=admin`, `department=management` |
| seller | Acceso a sus propios productos y órdenes recibidas | `role=seller`, `seller_id` |
| customer | Acceso únicamente a sus propias órdenes | `role=customer`, `customer_id` |

##### Configuración del MS-Auth según el tratamiento

| Tratamiento | Autenticación | Implementación | Autorización | Implementación |
|---|---|---|---|---|
| T1 | API Keys | Clave única por usuario almacenada en base de datos interna | RBAC | Tabla de permisos por rol |
| T2 | API Keys | Clave única por usuario almacenada en base de datos interna | ABAC | Motor de políticas con atributos del usuario y del recurso |
| T3 | JWT | Tokens firmados con HS256, claims con `role` y `user_id`, TTL de 15 min | RBAC | Validación del claim `role` en el JWT |
| T4 | JWT | Tokens firmados con HS256, claims con `role` y `user_id`, TTL de 15 min | ABAC | Motor de políticas evaluado con claims del JWT y atributos del recurso |
| T5 | OAuth 2.0 | Authorization Code Flow gestionado| RBAC | Roles asignados y validados por el MS-Auth |
| T6 | OAuth 2.0 | Authorization Code Flow gestionado | ABAC | Políticas ABAC evaluadas con los atributos del token|

##### Políticas RBAC definidas

| Rol | Recurso | Operación permitida | Condición |
|---|---|---|---|
| admin | `Order`, `Customer`, `Product`, `Seller` | `read`, `write` | Sin restricciones |
| seller | `Product` | `read`, `write` | Solo sus propios productos (`seller_id` del token) |
| seller | `Order` | `read` | Solo órdenes que contienen sus productos |
| customer | `Order` | `read` | Solo sus propias órdenes (`customer_id` del token) |
| customer | `Product`, `Seller` | `read` | Sin restricciones |
| customer | `Customer` | Denegado | Ninguna |

##### Políticas ABAC definidas

| Política | Condición de acceso |
|---|---|
| `P1_orders_read` | `subject.role == 'admin' OR (subject.role == 'customer' AND subject.customer_id == resource.customer_id)` |
| `P2_orders_write` | `subject.role == 'admin'` |
| `P3_products_read` | `subject.role IN ['admin', 'seller', 'customer']` |
| `P4_products_write` | `subject.role == 'admin' OR (subject.role == 'seller' AND subject.seller_id == resource.seller_id)` |
| `P5_customers_read` | `subject.role == 'admin' OR (subject.role == 'customer' AND subject.customer_id == resource.customer_id)` |
| `P6_sellers_read` | `subject.role IN ['admin', 'seller', 'customer']` |

La diferencia fundamental entre RBAC y ABAC en este experimento es que RBAC valida únicamente el rol del usuario, sin considerar si el objeto solicitado le pertenece; ABAC, en cambio, evalúa adicionalmente que el atributo customer_id del sujeto coincida con el customer_id del recurso solicitado, lo que le permite detectar y bloquear ataques BOLA de forma más precisa.

##### Diseño del Esquema GraphQL

```graphql
# Tipo Customer — datos geográficos del cliente
# NOTA: El dataset de Olist no contiene nombre ni correo del cliente.
# El identificador de privacidad es customer_unique_id, que permite
# rastrear el historial de compras del mismo cliente entre órdenes.

type Customer {
  customer_id: ID!                  # Hash MD5, clave foránea en Order
  customer_unique_id: String!       # SENSIBLE: permite rastrear historial de compras
  customer_zip_code_prefix: String! # SENSIBLE: ubicación geográfica aproximada
  customer_city: String!
  customer_state: String!
}

# Tipo Seller — información del vendedor

type Seller {
  seller_id: ID!             # Hash MD5
  seller_zip_code_prefix: String!
  seller_city: String!
  seller_state: String!
}

# Tipo Product — catálogo de productos

type Product {
  product_id: ID!                  # Hash MD5
  product_category_name: String!
  product_name_lenght: Int         # longitud del nombre (campo original del dataset)
  product_description_lenght: Int  # longitud de la descripción (campo original)
  product_photos_qty: Int
  product_weight_g: Float
}

# Tipo OrderItem — ítem individual dentro de una orden
# Contiene los datos financieros de cada producto comprado

type OrderItem {
  order_item_id: Int!
  product_id: ID!
  seller_id: ID!
  price: Float!          # SENSIBLE: precio pagado por el ítem
  freight_value: Float!  # SENSIBLE: costo de envío del ítem
  product: Product
  seller: Seller
}

# Tipo OrderPayment — información de pago de una orden

type OrderPayment {
  payment_sequential: Int!
  payment_type: String!       # SENSIBLE: método de pago (tarjeta, boleto, etc.)
  payment_installments: Int!
  payment_value: Float!       # SENSIBLE: monto total pagado
}

# Tipo Order — orden de compra con relaciones anidadas
# Es el recurso central del ataque BOLA

type Order {
  order_id: ID!                       # Hash MD5
  customer_id: ID!                    # SENSIBLE: hash MD5 del propietario de la orden
  order_status: String!               # SENSIBLE: estado de la orden ajena
  order_purchase_timestamp: String!
  order_delivered_customer_date: String
  customer: Customer                  # SENSIBLE: datos geográficos del propietario
  items: [OrderItem]                  # SENSIBLE: productos y precios comprados
  payments: [OrderPayment]            # SENSIBLE: método y monto de pago
}
```


### Operaciones GraphQL

Se definen **dos operaciones** que servirán como endpoints de prueba del experimento: una consulta (*Query*) para probar el acceso de lectura y una mutación (*Mutation*) para probar el acceso de escritura.

#### Operación 1: Query `getOrder` (Equivalente a GET)

Esta consulta recupera una orden específica por su identificador, incluyendo los datos anidados del cliente, los productos y el vendedor. Es la operación central para las pruebas de BOLA: un cliente autenticado solicita una orden cuyo `customer_id` no le pertenece.

```graphql
# Cabecera HTTP:
# Authorization: Bearer <token_valido_customer_01>

query {
  getOrder(order_id: "e481f51cbdc54678b7cc49136f2d6af7") {
    order_id
    order_status
    order_purchase_timestamp
    customer {
      customer_unique_id
      customer_zip_code_prefix
      customer_city
    }
    items {
      price
      freight_value
      product {
        product_category_name
      }
    }
    payments {
      payment_type
      payment_value
    }
  }
}
```

#### Operación 2: Mutation `createOrder` (Equivalente a POST)

Esta mutación crea una nueva orden en el sistema. Es la operación utilizada para las pruebas de **Broken Authentication** en escritura: un atacante intenta crear órdenes sin credenciales válidas, con credenciales expiradas o con credenciales falsificadas.

```graphql
# Cabecera HTTP:
# Authorization: Bearer <token_valido_customer_01>

mutation {
  createOrder(
    customer_id: "06b8999e2fba1a1fbc88172c00ba8bc7",
    product_ids: [
      "1e9e8ef04dbcff4541ed26657ea517e5",
      "7a5f4e2b3c1d9f8e6b2a0c4d5e7f1a3b"
    ],
    seller_id: "84732c79bc461ab3d2e72b74f6c53b7a"
  ) {
    order_id
    order_status
    order_purchase_timestamp
  }
}
```
Formato para cada tratamiento
Cada tratamiento tiene 5 pruebas de cada escenario

| Repetición | Autenticación | Autorización | Tratamiento | Escenario | Descripción | VECTOR OWASP | HTTP OBTENIDO | HTTP ESPERADO | Response Size (B) | Request Size (B) | Latencia (ms) | Controlabilidad (SCo-1-G) | Integridad (SIn-1-G) | Suficiencia (SAu-1-G) |
|---|---|---|---|---|---|---|---|---|---:|---:|---:|---|---|---|