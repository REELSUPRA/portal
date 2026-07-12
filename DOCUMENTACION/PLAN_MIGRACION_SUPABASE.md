# Plan — Migración a Supabase (V3, arquitectura de datos)

Estado: **análisis y diseño completos, infraestructura preparada
(SQL + código en paralelo). Cutover a producción bloqueado — falta un
proyecto Supabase real con credenciales.** Ver "Bloqueado en" al
final: es lo único que impide terminar esta fase hoy mismo.

## 0. Por qué este documento no termina en "listo, ya está en producción"

Se pidió explícitamente no improvisar y priorizar arquitectura limpia
sobre velocidad. Cumplir eso significa, en este caso concreto, **no**
activar código que dependa de un backend que todavía no existe:
`RSStore.hydrate()` es lo primero que corre en `boot()`, antes de
cualquier render — si esa llamada apunta a un proyecto Supabase que no
existe (o a credenciales vacías), **el portal completo queda en
blanco para Juan Guzmán**, el único cliente real hoy. Por eso el
trabajo de esta fase se separó en dos partes:

- **Todo lo que no depende de credenciales reales** → hecho, en el
  repo, ahora: esquema SQL, políticas de RLS, Storage, código de la
  nueva capa de persistencia. Ver "Qué se hizo" abajo.
- **Todo lo que sí depende de un proyecto Supabase real** (correr el
  SQL, conectar la URL/clave, probar que persiste, cambiar el login) →
  diseñado y documentado con precisión acá, listo para ejecutarse en
  una sola sesión corta apenas exista ese proyecto. Ver "Checklist de
  cutover" y "Bloqueado en".

## 1. Análisis de la arquitectura existente

### 1.1 Qué toca datos hoy, y cómo

```
js/data.js    → seed estático. window.CLIENT_DATA = {...} literal.
js/store.js   → ÚNICA pieza que toca localStorage. Interfaz:
                { load(), save(data), hydrate(), clear() } — las 4,
                Promises, aunque localStorage sea síncrono.
js/render.js  → lee window.CLIENT_DATA. Nunca llama a RSStore
                directamente. Expone BLOCK_DEFS/LIST_SCHEMAS/
                THEME_SCHEMA/QUICKLINK_TYPES a admin.js.
js/admin.js   → muta window.CLIENT_DATA en memoria (ej.
                currentProject().logoUrl = v), llama markDirty(), y
                SOLO al tocar "Guardar cambios" llama
                RSStore.save(window.CLIENT_DATA).
index.html /
project.html  → boot(): RSStore.hydrate().then(() => { render... }).
                hydrate() reemplaza CLIENT_DATA ANTES de cualquier
                render — es el único punto de entrada de datos.
```

**Esto es la buena noticia de esta migración**: `RSStore` se diseñó
desde el primer día (ver [DECISIONES.md](DECISIONES.md), 2026-07-11)
para que cambiar el destino de persistencia fuera "reescribir
`js/store.js` únicamente, sin tocar `admin.js` ni el resto de la
interfaz". Confirmado por lectura de código: ningún archivo fuera de
`store.js` llama a `localStorage` directamente. La migración a
Supabase, en el 90% de los casos, es exactamente eso: un
`js/store.js` nuevo con la misma interfaz.

### 1.2 Dependencias detectadas que SÍ requieren tocar otros archivos

No todo es `store.js`. Detecté 3 puntos de acoplamiento reales:

1. **El gate de admin vive en el dato, no en el código de admin.js.**
   `verifyPassphrase()` lee `window.CLIENT_DATA.agency.adminPassphrase`
   — un valor plano en un archivo público. Si `agency_settings` (la
   tabla nueva) no tiene esa columna, `expected` queda `undefined` y
   `verifyPassphrase()` hoy tiene esta línea: `if (!expected) return
   true;` — **dejaría pasar a cualquiera sin contraseña**, una
   regresión de seguridad real, no cosmética. Por eso el reemplazo de
   `js/store.js` y el reemplazo del gate de admin.js **tienen que
   pasar a producción juntos, en el mismo cutover** — nunca uno sin el
   otro. Ver sección "Autenticación".
2. **Las imágenes se suben como base64 dentro de `openImageModal()`**
   (`js/admin.js`) — con el fix de la sesión anterior ya se
   redimensionan a 1280px antes de guardar, pero siguen viajando
   adentro del JSON de `CLIENT_DATA`. Para que dejen de ser base64 de
   verdad (pedido explícito), ese modal tiene que subir el archivo a
   Supabase Storage y guardar la URL pública resultante — es un
   cambio real de lógica, no solo de destino de guardado.
3. **`exportJSON()`/"Exportar JSON" y el flujo de "reemplazar
   `data.js` a mano"** deja de tener sentido — pedido explícito ("no
   debe haber Export JSON, no debe haber copiar data.js"). Guardar
   pasa a significar guardar de verdad, en la fuente real.

### 1.3 Qué NO se toca (reutilización, no reinvención)

Confirmado por lectura de `js/render.js` y `js/admin.js`: **`BLOCK_DEFS`,
`LIST_SCHEMAS`, `THEME_SCHEMA`, `QUICKLINK_TYPES`, `openListEditor()`,
`buildThemeBuilder()`, todos los helpers de formulario
(`field()`/`selectField()`/`rangeField()`/`checkboxField()`), el editor
genérico de listas completo, el drag&drop de bloques, el motor de
render de cada bloque (`blockRoadmap`, `blockBitacora`, etc.)** — nada
de esto sabe ni le importa de dónde vino `CLIENT_DATA`. Mientras la
forma del objeto que devuelve `RSStore.load()` sea idéntica a la de
hoy (mismas claves camelCase, mismos arrays de objetos), **cero
cambios** en toda esta capa. Esta es la razón de la decisión de diseño
central de la sección 2 (cáscara relacional + contenido JSONB): logra
justamente eso.

### 1.4 Riesgos de regresión identificados

| Riesgo | Mitigación |
|---|---|
| `hydrate()` falla (Supabase caído/sin red) antes de cualquier render → portal en blanco | Fallback: si `load()` rechaza, no se pisa `window.CLIENT_DATA` — queda el seed de `js/data.js` que ya cargó ese `<script>` antes. Es el único rol que conserva `data.js`, tal como se pidió. |
| Reemplazar el gate de contraseña por Auth sin probarlo en vivo | No se activa hasta tener credenciales reales — ver sección 0. |
| Perder los datos reales que hoy están en el `localStorage` de la PC del admin (nunca llegaron a `data.js`, confirmado en la conversación anterior) | El seed (`04_seed_from_data_js.sql`) migra lo que hay en `data.js` hoy. Si el admin manda el "Exportar JSON" de su navegador, se incorpora al seed antes de correrlo — no se pierde nada. |
| Bucket de Storage público expone documentos sensibles | Mismo modelo de seguridad que ya existía (URL pública, sin login) — no es una regresión, es el mismo trade-off de siempre. Ver sección 4 para el razonamiento completo. |
| El primer usuario admin no puede auto-asignarse el rol (las políticas de `profiles` exigen ya ser admin para escribir en `profiles`) | Paso manual documentado, una sola vez, en `04_seed_from_data_js.sql` — no es un bug, es el bootstrap estándar de este patrón. |

## 2. Decisión de arquitectura: cáscara relacional + contenido JSONB

Evalué dos caminos:

- **(A) Todo relacional** — una tabla por lista (`roadmap_items`,
  `bitacora_entries`, `calendar_events`, etc.), cada una con su propia
  fila por ítem. Es "más correcto" en el sentido académico, pero
  significa escribir una capa de traducción fila↔objeto para cada una
  de las 8+ listas, y tocar `LIST_SCHEMAS` para que sepa de una tabla
  distinta por esquema — el motor genérico dejaría de ser genérico.
- **(B, elegida) Cáscara relacional + contenido JSONB** — `clients` y
  `projects` son tablas reales (ahí es donde importa tener un límite
  de fila para RLS: "¿este usuario puede ver esta fila?"), pero cada
  lista (`roadmap`, `bitacora`, `resources`, etc.) vive como una
  columna `jsonb` con la MISMA forma que ya usa `CLIENT_DATA` hoy.

Elegí (B) y la documento como la decisión "mejor que la obvia" que se
pidió señalar: da el límite de seguridad real que pide "diseñar
pensando en cientos de clientes" (RLS por fila de `clients`/`projects`)
sin sacrificar el motor declarativo ya construido (`LIST_SCHEMAS`,
`BLOCK_DEFS`) — que sigue funcionando exactamente igual porque el
"formulario genérico" nunca supo ni necesita saber que el array vino
de una columna jsonb en vez de un objeto en memoria. Es además el
patrón estándar en CMS reales (Contentful, Sanity, y el propio Postgres
de Supabase están pensados para esto) — no es un atajo, es la práctica
madura para este caso.

Esquema completo, comentado, en [`supabase/01_schema.sql`](../supabase/01_schema.sql).

## 3. Decisión de arquitectura: routing multi-cliente sin login todavía

Con múltiples clientes en un solo deployment, algo tiene que decidir
"¿el `CLIENT_DATA` de quién cargo?" — hoy no existe ese concepto (un
deployment = un cliente, resuelto explícitamente en
[DECISIONES.md](DECISIONES.md) para la V1/V2).

**Decisión:** `?client=<slug>` en la URL (mismo patrón que
`project.html?id=jga-realtor` ya usa para elegir proyecto dentro de un
cliente), con un `DEFAULT_CLIENT_SLUG` que hoy apunta a
`juan-guzman` — así el link actual
(`portalreelsupra.netlify.app/`, sin parámetros) sigue funcionando
exactamente igual para el único cliente real que existe, y el día que
haya un segundo cliente, cada uno recibe su propio link con
`?client=<su-slug>`. Esto **no** requiere terminar el login de Cliente
— es una decisión de routing, independiente de Auth.

## 4. Reconsideración explícita: "un cliente por deployment"

[DECISIONES.md](DECISIONES.md) tiene esto marcado como **resuelto, no
pendiente**: *"se decidió mantener este modelo (un deployment por
cliente) para la V1 y la V2."* El pedido de esta migración
("diseñar pensando en cientos de clientes") lo reabre explícitamente.
Lo dejo señalado en vez de pisar la entrada vieja en silencio — el
esquema de datos (sección 2) ya es multi-cliente real (tabla
`clients` con muchas filas, `projects.client_id`), pero **la decisión
de producto** (¿este deployment de Netlify va a servir a un cliente
por vez con su propio link, o se vende como un solo portal para todos
los clientes de la agencia?) sigue siendo tuya — el diseño de datos
sirve a cualquiera de las dos, así que no bloquea esta fase, pero
quiero que quede explícito que es un cambio de rumbo real, no un
detalle técnico.

## 5. Autenticación (Supabase Auth)

**Fase 1 (esta):** solo Admin, real. Reemplaza la contraseña plana en
JS por un login de verdad — este es el cambio de seguridad más
importante de toda la migración: hoy, cualquiera con las herramientas
de desarrollador del navegador puede llamar a las funciones de
`admin.js` sin pasar por `verifyPassphrase()` en absoluto (es solo un
`if` en el cliente, nada del lado del servidor lo hace cumplir). Con
Supabase Auth + RLS (`supabase/02_policies.sql`), **el servidor
rechaza cualquier escritura sin una sesión autenticada con rol
admin**, sin importar qué haga el navegador. Esto es un cierre de
brecha real, no solo prolijidad.

- Método **confirmado (2026-07-12): email + contraseña** (no magic
  link) — no depende de la entrega de emails de Supabase (rate-limitada
  en el plan gratuito) y es más simple de razonar para un solo usuario
  admin por ahora.
- Tabla `profiles` (`role`, `client_id`) ya existe en el esquema —
  lista para cuando se active login de Cliente.

**Diferido, ya preparado en el esquema (no bloquea esta fase):** login
de Cliente. Hoy el portal se sigue leyendo público, sin login, por
`?client=<slug>` (mismo modelo de "la URL es el límite" que ya existía
— no es una regresión, es explícitamente lo que se pidió no forzar
todavía: *"no hace falta terminar todo el sistema de login"*). El
día que se quiera, activar el login de Cliente es: descomentar 2
policies ya escritas y comentadas en `02_policies.sql`, más una
pantalla de login — no una migración de esquema nueva.

## 6. Imágenes: de base64 a Supabase Storage

4 buckets, exactamente los pedidos: `logos`, `covers`, `documents`,
`media` — públicos de lectura (mismo modelo que clients/projects),
escritura solo admin (`supabase/03_storage.sql`).

Cambio necesario en `openImageModal()` (`js/admin.js`), para el
cutover: en vez de `imageModalConfig.set(reader.result)` (el data-URL
base64 que se guarda hoy), subir el `Blob` ya redimensionado (el fix
de la fase anterior ya lo deja en ≤1280px) a
`client().storage.from(bucket).upload(path, blob)` y guardar
`getPublicUrl(path).data.publicUrl` en el campo correspondiente. El
bucket a usar depende de qué modal es (logo de cliente/proyecto →
`logos`; portada → `covers`; documentos → `documents`; el resto →
`media`) — mismo patrón `openImageModal(config)` ya genérico, solo se
agrega `config.bucket`.

## 7. Checklist de cutover (una sola sesión, apenas haya credenciales)

En este orden exacto — cada paso depende del anterior:

1. Correr `supabase/01_schema.sql`, `02_policies.sql`, `03_storage.sql`
   en el SQL Editor de Supabase (proyecto nuevo).
2. Correr `04_seed_from_data_js.sql` (opcionalmente con el
   "Exportar JSON" real de tu navegador incorporado, si lo mandás).
3. Crear el primer usuario admin en Authentication → Users, y
   asignarle `role='admin'` en `profiles` a mano (paso documentado en
   el propio seed).
4. Completar `SUPABASE_URL`/`SUPABASE_ANON_KEY` en
   `js/store.supabase.js`.
5. Reemplazar el gate de contraseña en `js/admin.js`
   (`verifyPassphrase`/`tryActivateAdmin`) por login real contra
   Supabase Auth — mismo lugar, misma UX de "modal simple", login real
   adentro.
6. Adaptar `openImageModal()` para subir a Storage (sección 6).
7. Quitar `exportJSON()`/el botón "Exportar JSON" del panel — guardar
   ya significa guardar de verdad.
8. Cambiar `<script src="js/store.js">` por
   `<script src="js/store.supabase.js">` en `index.html` y
   `project.html` (agregar antes el `<script>` de `supabase-js` desde
   CDN — verificado que
   `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js`
   responde 200 y expone `window.supabase.createClient`).
9. Verificación completa (sección 8) — recién ahí se hace push a
   `main` (Netlify redeploya solo).

## 8. Verificación obligatoria (antes de considerar esta fase cerrada)

- Desktop + iPhone SE + iPhone 13 + Pixel 7 + iPad (mismo estándar ya
  usado en la Prioridad 1 de responsive) — sin errores de consola, sin
  requests fallidos.
- **Multi-dispositivo real, no simulado:** guardar un cambio desde un
  navegador y confirmar que aparece en otro navegador/dispositivo sin
  tocar `localStorage` — es el requisito que dispara toda esta
  migración.
- Theme Builder, Header Inteligente, editor genérico (las 8 listas),
  Timeline/Bitácora, Roadmap, Calendario, accesos rápidos — cada uno
  probado end-to-end contra Supabase real (crear, editar, eliminar,
  reordenar, guardar, recargar).
- Subida de imagen real → confirmar que queda en el bucket de Storage
  correcto y la URL pública carga.
- Login de admin real (sin contraseña plana en el JS) + confirmar que
  un `INSERT`/`UPDATE` directo contra la API de Supabase sin sesión de
  admin es rechazado por RLS (prueba de seguridad, no solo de UI).

## 9. Qué se hizo ya (sin esperar credenciales)

- `supabase/01_schema.sql` — esquema completo (agency_settings,
  clients, projects, profiles), comentado.
- `supabase/02_policies.sql` — RLS completo, con el razonamiento de
  seguridad documentado en el propio archivo.
- `supabase/03_storage.sql` — 4 buckets + políticas.
- `supabase/04_seed_from_data_js.sql` — migra el contenido real de
  `data.js` de hoy, listo para correr.
- `js/store.supabase.js` — implementación completa de `RSStore` contra
  Supabase, misma interfaz que `js/store.js`, con fallback a `data.js`
  si Supabase no responde. **No conectado todavía** (ver sección 0).

## Decisiones ya confirmadas (2026-07-12)

- Login de admin: **email + contraseña** (sección 5).
- Seed inicial: **arranca con los mismos placeholders que hoy tiene
  `data.js`** (no se incorpora el `localStorage` de la PC) — el
  logo/portada reales se vuelven a subir una vez el panel ya esté
  guardando en Supabase, y ahí sí quedan persistidos de verdad, para
  cualquier dispositivo.

## Bloqueado en

Esto es lo único que falta para terminar y verificar esta fase:

1. **Un proyecto Supabase real** (plan gratuito alcanza para empezar)
   — crealo en supabase.com y pasame la **Project URL** y la
   **anon/public key** (Settings → API). Ambas son seguras de
   compartir/pegar en código de cliente por diseño — la seguridad real
   la da RLS, no el secreto de esa clave. **Nunca** la
   `service_role key` — esa sí es secreta, no se pega en el código ni
   se comparte por chat.

Con eso, el checklist de la sección 7 es una sola sesión de trabajo.
