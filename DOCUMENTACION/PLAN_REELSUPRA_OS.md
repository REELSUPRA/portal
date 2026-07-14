# Plan — Evolución a "ReelSupra OS" (Dashboard admin + Acceso al Portal simple)

Estado: **implementado (2026-07-14), verificado con Playwright contra
datos reales.** Ver "Qué se implementó" al final del documento.

## 0. Resumen ejecutivo

Hoy el "modo administrador" vive **adentro** de la página de un
cliente (`index.html?client=<slug>&admin=true`): para editar cualquier
cosa hay que estar parado en la URL de ESE cliente. Con 1-2 clientes
no se nota; con muchos, no hay forma de ver "todos mis clientes" de un
vistazo, ni de crear uno nuevo, sin pasar por SQL a mano.

La propuesta es agregar una **segunda superficie**, nueva:

- **Portal Cliente** (`index.html` / `project.html`) — sigue siendo lo
  que ya es: la vista de un cliente puntual, con su editor embebido.
  **No se reescribe.**
- **Dashboard ReelSupra** (nuevo, `dashboard.html`) — pantalla de
  aterrizaje del admin: lista todos los clientes y proyectos, permite
  crear clientes/proyectos nuevos, y gestionar accesos sin entrar a
  cada cliente uno por uno. Desde ahí, "entrar a un cliente" te manda
  al editor de siempre — no hay un editor de contenido nuevo, es el
  mismo.

Esto no es una migración de datos ni un cambio de arquitectura de
Supabase — es una **superficie de administración nueva sobre las
mismas tablas**, más una simplificación visual de lo que ya existe.

---

## 1. Arquitectura propuesta

```
Portal Cliente (sin cambios de fondo)
├── index.html / project.html      → vista del cliente (?client=<slug>)
│   └── modo admin embebido        → editor de ESE cliente (?admin=true)
│       ├── Theme Builder, editor de listas, bloques  → SIN TOCAR
│       └── Acceso al Portal        → simplificado (sección 3)

Dashboard ReelSupra (nuevo)
└── dashboard.html                 → login admin (reutiliza RSStore.signIn)
    ├── Lista de clientes           → RSStore.listClients() (extendido)
    │   ├── Acceso al Portal inline → mismo componente simplificado
    │   └── "Entrar" → index.html?client=<slug>&admin=true
    ├── Lista de proyectos          → RSStore.listProjectsLight() (nuevo)
    ├── "+ Nuevo cliente"           → RSStore.createClient() (nuevo)
    └── "+ Nuevo proyecto"          → RSStore.createProject() (nuevo)
```

**Principio central: el Dashboard es un mejor punto de entrada, no un
editor nuevo.** Todo lo que hoy sabe editar contenido de un cliente
(Theme Builder, bloques, listas, piezas de contenido) sigue viviendo
exactamente donde está. El Dashboard resuelve "¿a quién quiero
administrar?" — no "cómo se administra".

Login: el Dashboard usa el mismo mecanismo que ya existe
(`RSStore.signIn/getSession`, Supabase Auth) — se reutiliza el modal de
login (se extrae a una función compartida para no duplicarlo entre
`admin.js` y el nuevo `dashboard.js`).

---

## 2. Tablas necesarias

**Ninguna tabla nueva.** `clients`, `projects`, `profiles`,
`agency_settings` se mantienen tal cual — el Dashboard es una vista
nueva sobre datos existentes, no un modelo de datos nuevo.

**Verificado contra `supabase/02_policies.sql` (2026-07-13): ya
existen** `"clients: solo admin inserta"` y `"projects: solo admin
inserta"` (`with check (is_admin())`), de la migración original — no
hace falta ningún SQL nuevo para `createClient()`/`createProject()`.

---

## 3. "Acceso al Portal" — simplificación final

Se reemplaza el estado técnico (`sin_invitar`/`invitado`/`revocado`
como texto) por una señal puramente visual, igual en el Dashboard y
en el panel por-cliente (mismo componente, reutilizado en los dos
lugares):

| Estado interno | Se ve así |
|---|---|
| Sin acceso (`sin_invitar` o `revocado`) | Campo de email **vacío y editable** + botón **"Crear acceso"** |
| Con acceso (`invitado`) | Campo de email **bloqueado** (solo lectura) + **"Editar email"** + **"Reenviar acceso"** + **"Revocar acceso"** |

Sin badges de estado, sin IDs, sin distinguir "invitado" de
"restaurado" — es exactamente la misma distinción binaria de hoy
(`hasAccount` ya calculado en el código actual), solo que ahora **no
se le muestra al admin ningún texto técnico**, se lee del estado visual
del campo.

**Se elimina como botón separado: "Restablecer contraseña".** Hace lo
mismo que ya hace "Reenviar acceso" desde la perspectiva del cliente
(recibe un link nuevo para (re)establecer su contraseña) — tener las
dos es la clase de "acción innecesaria" que pediste sacar. El método
`RSStore.resetPasswordForClient()` se elimina del todo (no queda
código sin usar).

"Editar email": el campo pasa de bloqueado a editable al tocar el
botón (in-place), con un único botón de confirmar — no una fila
aparte con validaciones extra.

---

## 4. Cambios mínimos (para implementar, tras aprobar este plan)

1. **`js/store.supabase.js`**:
   - `listClients()`: agregar `portal_email`/`portal_access_status` al
     `select` (ya se leen en el detalle de un cliente; para la lista
     del Dashboard hace falta traerlos también acá).
   - Nuevo `listProjectsLight()` — `select("id, slug, name, client_id, status")`,
     **sin** las columnas `jsonb` pesadas (con cientos de clientes, traer
     todo el contenido de todos los proyectos para una lista sería
     desperdiciar ancho de banda sin necesidad).
   - Nuevo `createClient({ name, slug })` — inserta con defaults vacíos
     (`theme: {}`, `announcement: {active:false, text:''}`,
     `portal_access_status: 'sin_invitar'`).
   - Nuevo `createProject(clientId, { name, slug })` — inserta un
     proyecto vacío asociado a ese cliente.
2. **`js/admin.js`**: `buildPortalAccessSection()` rediseñada a la
   tabla de la sección 3 (mismo archivo, componente único reutilizado
   por `dashboard.js` — no se duplica lógica).
3. **Nuevo `dashboard.html` + `js/dashboard.js`**: página nueva,
   reutiliza CSS existente (`.admin-panel`, `.btn`, `.admin-field`,
   `.admin-group`) en vez de inventar un lenguaje visual aparte.
   Reutiliza el modal de login (extraído a función compartida).
4. ~~SQL de policies de insert~~ — ya existen, sin cambios.
5. **CSS**: pase de jerarquía visual sobre `.admin-group` — fondo sutil
   por sección (hoy es blanco sobre blanco con solo un borde),
   espaciado más ajustado, y diferenciar visualmente la acción primaria
   ("Crear acceso"/"Entrar") de las secundarias. Diseño concreto al
   implementar, no en este documento.
6. **`_redirects`** (opcional, baja prioridad): alias `/dashboard` →
   `dashboard.html`, igual que existe `/admin` hoy. Puede esperar.

---

## 5. Qué se mantiene (sin tocar)

- Supabase, Auth, RLS de lectura pública (el gate real sigue diferido
  a v1.1, decisión ya tomada — no se reabre acá).
- Esquema de tablas completo (`clients`, `projects`, `profiles`,
  `agency_settings`).
- Edge Function `manage-client-access` — mismas 5 acciones en el
  backend (`invite/resend/grant/revoke/change_email`); lo que cambia
  es solo cuáles se disparan desde la UI.
- Todo el motor declarativo de contenido: `BLOCK_DEFS`, `LIST_SCHEMAS`,
  `THEME_SCHEMA`, `QUICKLINK_TYPES`, editor genérico de listas, Theme
  Builder — el Dashboard no los toca, solo los hace más fáciles de
  encontrar.
- `js/store.js` / `js/data.js` como fallback/rollback.
- El panel por-cliente (`buildPanel()`) sigue siendo el editor de
  contenido — el Dashboard lo antecede, no lo reemplaza.

## 6. Qué se elimina

- El texto de estado técnico ("Estado: invitado/revocado/sin
  invitar") en Acceso al Portal.
- El botón "Restablecer contraseña" como acción visible separada
  (absorbido funcionalmente por "Reenviar acceso").

---

## 7. Decisiones confirmadas (2026-07-13) — plan aprobado

1. **Ruta del Dashboard**: `dashboard.html` alcanza por ahora. El
   alias `/dashboard` (paso 6 de la sección 4) queda pendiente, sin
   prioridad — se puede agregar después sin costo.
2. **Alcance de "asociar proyectos"**: solo **crear** un proyecto
   nuevo ya asociado a un cliente. Mover un proyecto existente entre
   clientes queda **fuera de alcance** de este bloque.
3. **Un solo admin**: confirmado, sin roles/permisos múltiples. No se
   agrega ningún modelo de permisos — `profiles.role='admin'` sigue
   plano.

Con esto, el plan queda **aprobado** — se pasa a implementación según
la sección 4.

## 8. Qué se implementó (2026-07-14)

Todo lo de la sección 4, sin desvíos del plan:

- `js/store.supabase.js`: `listClients()` ahora trae también
  `portal_email`/`portal_user_id`/`portal_access_status` (antes solo
  `id, slug, name`). Nuevos `listProjectsLight()`, `createClient({name,
  slug})`, `createProject(clientId, {name, slug})`.
- `js/admin.js`: `buildPortalAccessSection()` reescrita a los 2 estados
  visuales de la sección 3 (sin texto de estado, campo bloqueado/vacío
  según corresponda, sin "Restablecer contraseña" — `RSStore.resetPasswordForClient()`
  se eliminó del todo, ya no lo llama nadie). Expuesta en
  `window.RSAdmin` junto con `tryActivateAdmin` y `showToast` para que
  `dashboard.js` las reutilice sin duplicar lógica.
- **`dashboard.html` + `js/dashboard.js`** (nuevos): login (mismo modal
  de siempre), lista de clientes con "Acceso al Portal" inline (mismo
  componente que el panel por-cliente), "Entrar" a cada cliente
  (`index.html?client=<slug>&admin=true`, el editor de contenido no
  cambió), "+ Nuevo cliente" y "+ Nuevo proyecto" (via `window.prompt`,
  sin modal nuevo — consistente con el resto del panel, ej. los
  `confirm()` de borrado).
- CSS: `.admin-group` con fondo propio por sección (antes solo un
  borde) para mejorar la jerarquía visual; clases nuevas
  `.dashboard-*` reutilizando `.btn`/`.admin-field`/`.admin-link-btn`
  existentes, sin lenguaje visual aparte.
- Verificado con Playwright contra el proyecto real: `dashboard.html`
  sin errores de consola ni requests fallidos, gate de login correcto,
  `listClients()`/`listProjectsLight()` trayendo los datos reales (1
  cliente, 2 proyectos), ambos estados de "Acceso al Portal"
  (`sin_invitar` → "Crear acceso" único botón, campo vacío editable;
  `invitado` → campo bloqueado + 3 botones) renderizando correctamente
  tanto en el Dashboard como en el panel por-cliente.

**Pendiente, fuera de este bloque:** resolver el email de invitación
que llegaba rechazado (`otp_expired`, en diagnóstico — ver
[PLAN_ACCESO_PORTAL.md](PLAN_ACCESO_PORTAL.md)) antes de dar por
probado el flujo de "Crear acceso" de punta a punta con un cliente
real.

## 9. Cierre autónomo hacia v1.0 (2026-07-14, continuación)

Autorizado a trabajar sin confirmaciones intermedias hasta cerrar
Portal Cliente v1.0, deteniéndose solo por credenciales, pagos, o
riesgo de pérdida de datos.

- **Email de invitación:** sin nueva hipótesis — se revisó el código
  de la Edge Function y el flujo completo una vez más, sin encontrar
  ningún bug (confirma lo ya verificado antes). La causa sigue siendo
  el correo compartido de Supabase (sin SMTP propio). El fix real
  (SMTP con Resend) no se puede aplicar sin una credencial que solo el
  admin puede dar — queda como intervención pendiente, no como tarea
  abierta de código.
- **Imágenes a Storage — implementado con hallazgo real:** se
  verificó contra el proyecto real (no una suposición) que los 4
  buckets de `03_storage.sql` nunca se crearon (`404 Bucket not
  found`). Se implementó igual el código de subida
  (`RSStore.uploadImage()`, `resizeImageToBlob()` en `admin.js`,
  aplicado a los 4 modales de imagen: logo de proyecto, portada,
  logo de cliente, favicon) con un **fallback automático a base64**
  si la subida falla — probado con Playwright: sin buckets, sube,
  falla por RLS/bucket inexistente, y cae a base64 sin romper nada,
  mostrando "Imagen actualizada (respaldo local)". En cuanto se corra
  el SQL pendiente, empieza a subir a Storage sin tocar código de
  nuevo.
- **Dashboard — revisado para uso diario:** mensaje de error más claro
  cuando un slug ya existe ("Ese slug ya existe — probá con otro." en
  vez del error crudo de Postgres). Se probó específicamente el caso
  nuevo que el Dashboard habilita (crear un cliente vacío, sin
  proyectos) contra `index.html`/`project.html` y el panel admin — sin
  errores.
- **Verificación end-to-end:** barrido con Playwright de
  `index.html`/`project.html`/`dashboard.html` en Desktop, iPhone SE,
  iPhone 13, Pixel 7 e iPad (15 combinaciones) — sin errores de
  consola ni requests fallidos en ninguna. Panel admin verificado
  también en mobile (iPhone 13).
- **Bugs encontrados y corregidos en este bloque:** el mensaje de
  error genérico de Postgres al crear un cliente/proyecto con slug
  duplicado (único hallazgo real de esta ronda de pruebas).

## 10. Storage — corrido y verificado (2026-07-14)

El admin corrió `03_storage.sql` (versión idempotente). Verificado
contra el proyecto real, con una prueba más confiable que la anterior
(comparando el error real de un bucket inexistente contra los 4
reales, en vez de un endpoint de metadata que resultó no ser fiable
para anon):

- Los 4 buckets (`logos`, `covers`, `documents`, `media`) **existen**
  — confirmado porque una subida de prueba a cada uno da rechazo por
  RLS (`"new row violates row-level security policy"`), mientras que
  la misma subida a un bucket inventado da `"Bucket not found"` —
  son errores distintos y confirman la existencia real.
- La policy de **lectura pública** funciona: pedir un objeto sin
  ninguna `apikey` da `"Object not found"` (no un error de
  autorización), es decir, la lectura no requiere login.
- La policy de **escritura solo-admin** funciona: una subida sin
  sesión (anon) es rechazada.
- **No verificado por mí directamente:** una subida real como admin
  autenticado (necesitaría su contraseña, que no corresponde pedir).
  Confianza alta igual: `is_admin()` es la misma función que ya usan
  las políticas de `clients`/`projects`, y esas ya se probaron
  funcionando con la cuenta admin real en el cierre de la migración a
  Supabase. El código de `js/admin.js` ya no debería necesitar el
  fallback a base64 al subir una imagen nueva.
