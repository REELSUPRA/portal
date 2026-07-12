# Decisiones de arquitectura

Registro simplificado de decisiones relevantes: qué se decidió, por qué,
y qué queda abierto. Se agrega una entrada por decisión importante, no
por cada cambio (eso va en [CHANGELOG.md](CHANGELOG.md)).

---

## 2026-07-11 — Consolidación de estructura del proyecto

**Contexto:** existían dos copias del proyecto (`PORTALCLIENTE` plano en
la raíz, sin `index.html` ni `_redirects`, y `PORTALCLIENTE V2` con la
estructura completa dentro de un zip). Verificado por hash que el
contenido compartido era idéntico — no había divergencia de código.

**Decisión:** usar V2 como base, mover su contenido a la raíz, eliminar
los archivos sueltos redundantes.

**Por qué:** V2 tenía la estructura completa y coincidía con lo
documentado en el README original; la raíz estaba incompleta (le
faltaba `index.html` y `_redirects`, sin los cuales el sitio no
funciona como se describe).

---

## 2026-07-11 — Inicialización de control de versiones

**Contexto:** no había ningún control de versiones; la confusión entre
"ACTUAL" y "V2" hizo evidente el riesgo de perder trabajo sin
historial.

**Decisión:** `git init` local, commit baseline con la estructura
consolidada.

**Por qué:** es la salvaguarda mínima antes de seguir modificando
código. Sin remoto todavía — no se decidió dónde alojarlo.

---

## 2026-07-11 — Bloques nuevos vía el registro existente, no un subsistema nuevo

**Contexto:** el alcance de la V1 pide dos módulos nuevos en el Portal
del Cliente: Bitácora y Mejoras disponibles (Upsells).

**Decisión:** implementarlos como dos entradas más en `BLOCK_DEFS`
(`js/render.js`) + dos campos nuevos en el modelo de datos
(`bitacora`, `upsells`), reutilizando los patrones visuales existentes
(`upcoming-list` para bitácora, `link-list`/`btn` para upsells).

**Por qué:** el sistema de bloques ya resuelve orden, visibilidad y
layout de forma genérica. Construir algo aparte para estos dos módulos
hubiera duplicado esa lógica — va en contra de la filosofía
"centralizar sin duplicar" aplicada también al propio código, no solo
al producto.

---

## 2026-07-11 — Resuelto: un cliente por deployment

**Contexto:** el alcance de la V1 pide que el Panel Administrador
gestione "Clientes" (plural). La arquitectura actual es un deployment
por cliente (ver [ARQUITECTURA.md](ARQUITECTURA.md)) — no existía un
selector de cliente ni un modelo de datos que contemplara más de un
cliente por instancia. Se presentaron dos opciones (mantener el modelo
actual vs. rediseñar a multi-cliente en un solo deployment).

**Decisión:** mantener **un cliente por deployment**. "Gestión de
clientes" en el Panel Administrador significa editar los datos del
cliente de ese sitio (nombre, mensaje de bienvenida, aviso superior) —
funcionalidad que ya existía en el panel lateral (`js/admin.js`,
sección "Cliente"). No se rediseña el modelo de datos.

**Por qué:** la V1 es para un solo cliente (Juan Guzmán); un modelo
multi-cliente es trabajo y riesgo de arquitectura innecesarios para ese
objetivo, y contradice "no funcionalidades complejas". Si ReelSupra
suma clientes, cada uno tiene su propio deployment (ya documentado en
el README original como forma de reutilización).

**Consecuencia:** se agregó al panel el único control que faltaba para
que la sección "Cliente" fuera completa: un switch para activar/
desactivar el aviso superior (antes solo se podía editar el texto, no
mostrarlo/ocultarlo sin tocar `data.js`).

**Si en el futuro se necesita multi-cliente real:** queda documentada
la opción B descartada acá — rediseñar `CLIENT_DATA` como lista de
clientes, agregar ruteo (`?client=X&project=Y`) y un listado/selector en
el admin. No se construye hasta que haya una razón concreta.

---

## 2026-07-11 — Gate de contraseña para el admin (no autenticación real)

**Contexto:** el plan de UX Premium pedía separar admin/cliente. Full
login con credenciales por rol es multi-tenant real — fuera de alcance
de esta V1 (ver arriba). Se necesitaba algo intermedio para "evitar que
un cliente entre por accidente".

**Decisión:** un gate liviano — `agency.adminPassphrase` en
`data.js`, verificado con `window.prompt()` antes de activar
`RS_ADMIN_MODE`, una vez por sesión de navegador
(`sessionStorage.rsAdminAuthed`).

**Por qué:** cero infraestructura nueva, cero dependencias. Resuelve el
problema real planteado (acceso accidental) sin simular una seguridad
que no existe — la contraseña vive en un archivo JS servido a
cualquiera, así que **no protege contra un acceso intencional**. Esto
se documenta explícitamente en el código y se comunica al cliente para
no generar una falsa sensación de seguridad.

**Pendiente si se necesita seguridad real:** login con backend/
identidad real — eso sí es un cambio de arquitectura, no se hace en la
V1.

---

## 2026-07-11 — Persistencia del orden de bloques: localStorage (confirmado)

**Contexto:** el orden/visibilidad de módulos por proyecto solo vivía
en memoria — se perdía al recargar.

**Decisión:** confirmado usar `localStorage` (por navegador, sin
backend). No se introduce backend/base de datos para esto en la V1.

**Implementado (2026-07-11):** no solo el orden de bloques — se
generalizó a **todo** lo editable en modo admin. `js/store.js`
(`RSStore`) es la única pieza que toca `localStorage`; `admin.js`
detecta cualquier modificación (`markDirty()`), muestra una barra
inferior con un único botón "Guardar cambios", y avisa con
`beforeunload` si hay cambios sin guardar. Al guardar,
`RSStore.save(CLIENT_DATA)` persiste una foto completa; al volver a
entrar, `RSStore.hydrate()` la reemplaza antes de cualquier render.

**Trade-off aceptado:** es un reemplazo completo, no un merge. Si
`data.js` cambia después de que alguien guardó localmente en su
navegador, la foto guardada gana ahí — no ve los cambios nuevos de
`data.js` hasta que se borre ese `localStorage` o se vuelva a guardar
desde el admin. Aceptable para la V1 (un admin, pocos dispositivos);
señalado para revisar si el uso crece.

**Diseño para el cambio de backend futuro (GitHub/Supabase/otro):**
`RSStore` expone `load()`/`save()`/`hydrate()` como `Promise`s desde
el día uno, aunque `localStorage` sea síncrono — el objetivo es que
cambiar el destino sea reescribir `js/store.js` únicamente, sin tocar
`admin.js` ni el resto de la interfaz.

**Actualización (2026-07-12):** ese cambio de backend llegó — ver la
entrada de abajo. Confirmado en la práctica: el reemplazo fue,
efectivamente, un `js/store.js` nuevo (`js/store.supabase.js`) con la
misma interfaz, sin tocar `admin.js` más que en los 2 puntos que sí
dependían del dato (gate de admin, subida de imágenes) — documentados
como excepción explícita en su momento.

---

## 2026-07-12 — Migración de persistencia a Supabase; se reabre "un cliente por deployment"

**Contexto:** el cliente reportó que sus cambios (logos, portada,
configuración) no se veían desde otro dispositivo — investigado y
confirmado: vivían solo en el `localStorage` de una PC, nunca en
`data.js`/el repo. Pedido explícito de migrar a una arquitectura real
(Supabase), "diseñando pensando en cientos de clientes".

**Decisión 1 — persistencia:** Supabase (Postgres + Auth + Storage)
reemplaza a `localStorage` como fuente de verdad. `localStorage` deja
de tener rol funcional (puede quedar como caché, nunca como origen).
`js/data.js` conserva un único rol: fallback si Supabase no responde
— no bootstrap editable ni fuente de verdad.

**Decisión 2 — forma de los datos:** cáscara relacional
(`clients`/`projects`, tablas reales) + contenido de cada lista como
`jsonb` con la misma forma que ya usa `CLIENT_DATA` hoy, en vez de una
tabla por lista. Razón: da el límite de fila real que necesita RLS
para "cientos de clientes" sin tocar el motor declarativo ya
construido (`LIST_SCHEMAS`/`BLOCK_DEFS`/Theme Builder) — ese motor
sigue leyendo/escribiendo objetos JS idénticos a los de siempre. Detalle
completo en [PLAN_MIGRACION_SUPABASE.md](PLAN_MIGRACION_SUPABASE.md).

**Decisión 3 — se reabre una decisión marcada como resuelta:** la
entrada de arriba en este mismo documento decía *"se decidió mantener
[un deployment por cliente] para la V1 y la V2"* — no pendiente,
resuelta. El pedido de "cientos de clientes" la contradice. No la
piso en silencio: el esquema de datos nuevo (Decisión 2) ya soporta
multi-cliente real en un solo deployment, pero la decisión de
**producto** (¿se vende un deployment por cliente, o un solo portal
para todos los clientes de la agencia?) sigue abierta — señalada, no
resuelta todavía.

**Decisión 4 — seguridad, cierre de una brecha real:** hoy el modo
admin se protege con una contraseña en texto plano dentro de un
archivo JS público, sin ninguna verificación del lado del servidor —
cualquiera con las herramientas de desarrollador podía saltear el
gate llamando directamente a las funciones de `admin.js`. Row Level
Security en Supabase hace cumplir "solo admin escribe" en el
servidor, sin depender de qué haga el navegador. La lectura pública
del portal (sin login) se mantiene igual que siempre — no es una
regresión, es el mismo modelo de seguridad de toda la vida del
proyecto (la URL es el límite, no una contraseña).

**Pendiente/diferido, ya con esquema preparado:** login real de
Cliente (`profiles.role = 'client'`, policies ya escritas pero
comentadas en `supabase/02_policies.sql`) — no bloquea esta fase por
pedido explícito ("no hace falta terminar todo el sistema de login").

**Cutover realizado (2026-07-12):** con el proyecto Supabase real
creado, el esquema corrido y verificado, y las credenciales
(publishable key) entregadas, se conectó `js/store.supabase.js` en
producción — `index.html`/`project.html` ya leen de Supabase, no de
`localStorage`. El gate de contraseña se reemplazó por el login real
descripto en la Decisión 4, en el mismo cambio (nunca uno sin el
otro, como se documentó desde el principio). Verificado contra el
proyecto real: lectura pública funciona, una escritura sin sesión
admin fue rechazada por RLS (prueba real, no solo inspección de
políticas), el portal carga los datos reales en desktop y mobile sin
errores. Detalle completo en
[PLAN_MIGRACION_SUPABASE.md](PLAN_MIGRACION_SUPABASE.md).
