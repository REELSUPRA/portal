# Changelog

Registro cronológico de cambios, más granular que
[VERSIONES.md](VERSIONES.md). Orden: más reciente arriba.

## 2026-07-14 (Bug real encontrado: sesión de cliente activaba el modo admin)

- Auditoría con logs reales (Edge Function) y consultas directas a
  `auth.users`/`profiles` (Management API, PAT temporal revocado al
  terminar) — no más suposiciones sobre SMTP. Causa real: una sesión
  de cliente (Juan, de una prueba anterior en el mismo navegador)
  quedó guardada y `detectAdminMode()` la aceptaba como si fuera de
  admin, porque solo comprobaba "hay sesión", no "es de un admin". El
  backend rechazaba todo con 403 correctamente; la UI no.
- Corregido: `RSStore.isCurrentUserAdmin()` (nuevo) verifica
  `profiles.role`; `detectAdminMode()` y el login del modal admin lo
  usan en vez de solo "hay sesión". Verificado sin regresiones (15
  combinaciones página/viewport).
- Reseteada la cuenta de prueba de Juan (borrada de `auth.users`,
  `clients` vuelto a `sin_invitar`) para una prueba de invitación
  limpia — autorizado explícitamente por el admin.
- Pendiente: el admin debe volver a loguearse como admin real (la
  sesión vieja de Juan quedó guardada en el navegador) antes de la
  prueba final.

## 2026-07-14 (Storage: buckets corridos y verificados)

- `03_storage.sql` (versión idempotente) corrido por el admin. Un
  primer intento había fallado a mitad de camino e hizo rollback de
  los buckets — con `drop policy if exists` agregado, la segunda
  corrida funcionó.
- Verificado contra el proyecto real: los 4 buckets existen, la
  lectura pública funciona sin apikey, y la escritura rechaza
  correctamente a usuarios no-admin. Detalle del método de
  verificación en [PLAN_REELSUPRA_OS.md](PLAN_REELSUPRA_OS.md) sección
  10. El upload de imágenes ya no debería caer al fallback de base64.

## 2026-07-14 (Cierre autónomo hacia v1.0: Storage + verificación e2e)

- Imágenes: implementado el upload a Supabase Storage
  (`RSStore.uploadImage()`) para logo de proyecto, portada, logo de
  cliente y favicon, con fallback automático a base64 si falla.
  **Hallazgo real:** los buckets de `03_storage.sql` nunca se crearon
  en producción — verificado con la API de Storage (`404 Bucket not
  found`), no una suposición. Sin efecto visible hasta correr ese SQL
  (mientras tanto sigue funcionando igual que siempre, en base64).
- Dashboard: mensaje de error claro para slug duplicado al crear
  cliente/proyecto (antes mostraba el error crudo de Postgres).
- Verificación end-to-end: `index.html`/`project.html`/`dashboard.html`
  en 5 viewports (Desktop, iPhone SE, iPhone 13, Pixel 7, iPad) — sin
  errores de consola ni requests fallidos. Caso nuevo probado
  específicamente: cliente recién creado sin proyectos (lo habilita el
  Dashboard) no rompe el render ni el panel admin.
- Revisado (sin encontrar bug) una vez más el flujo de invitación por
  email — la causa sigue siendo el correo compartido de Supabase, fix
  pendiente de una credencial de SMTP (Resend) que solo el admin puede
  dar. Ver [PLAN_REELSUPRA_OS.md](PLAN_REELSUPRA_OS.md) sección 9.

## 2026-07-14 (Dashboard ReelSupra + Acceso al Portal a 2 estados)

- Nuevo `dashboard.html` + `js/dashboard.js`: punto de entrada del
  admin — lista clientes/proyectos, "+ Nuevo cliente"/"+ Nuevo
  proyecto", "Entrar" a cada cliente (mismo editor de siempre, sin
  cambios). No es un editor de contenido nuevo, ver
  [PLAN_REELSUPRA_OS.md](PLAN_REELSUPRA_OS.md).
- "Acceso al Portal" simplificado a 2 estados puramente visuales: sin
  acceso → email vacío/editable + "Crear acceso"; con acceso → email
  bloqueado + "Editar email"/"Reenviar acceso"/"Revocar acceso". Sin
  texto de estado técnico. Se eliminó "Restablecer contraseña" como
  acción separada (absorbida por "Reenviar acceso") y el método
  `RSStore.resetPasswordForClient()`.
- `RSStore`: `listClients()` ahora trae también email/estado de
  acceso; nuevos `listProjectsLight()`, `createClient()`,
  `createProject()`.
- CSS: `.admin-group` con fondo propio por sección (mejor jerarquía
  visual); clases `.dashboard-*` nuevas reutilizando componentes
  existentes.
- Verificado con Playwright contra el proyecto real: sin errores de
  consola, ambos estados de acceso renderizando correctamente en el
  Dashboard y en el panel por-cliente.

## 2026-07-13 (Revisión general pre-cierre v1.0: gate diferido + panel simplificado)

- Decisión: el gate real de lectura por cliente
  (`06_client_access_gate.sql`) queda diferido a v1.1 — ver
  [DECISIONES.md](DECISIONES.md) y
  [PLAN_ACCESO_PORTAL.md](PLAN_ACCESO_PORTAL.md) sección 4.
- "Acceso al portal" simplificado: "Dar acceso" único botón (antes
  separado en "Dar acceso"/"Restaurar acceso"); "Cambiar email" y
  "Restablecer contraseña" ahora detrás de "Más opciones".
- Panel admin reorganizado en secciones colapsables
  (`collapsibleGroup()`, `<details>`/`<summary>`): "Acceso al portal"
  abierto por defecto, el resto colapsado.
- Limpieza: se quitó "Exportar JSON" (y `exportJSON()`); "Aplicar
  cambios" renombrado a "Previsualizar cambios" y bajado de jerarquía
  visual (ya no es `btn--primary`).
- Verificado con Playwright contra datos reales (localhost): sin
  errores de consola, acordeón y acciones contextuales correctas.

## 2026-07-12 ("Acceso al Portal" — cutover de infraestructura)

Columnas corridas, función desplegada y URL de autenticación
corregida — infraestructura de "Acceso al Portal" lista para probar:

- `05_client_access_columns.sql` corrido en el proyecto real.
- Edge Function `manage-client-access` desplegada vía CLI
  (`--project-ref`, autenticado con un Personal Access Token generado
  solo para esta tarea y revocado al terminar). Verificada `ACTIVE` y
  rechazando pedidos sin autenticación (401).
- `site_url` de Supabase Auth corregido de `http://localhost:3000`
  (valor por defecto, nunca configurado) a
  `https://portalreelsupra.netlify.app` — sin este cambio, los emails
  de invitación/restablecimiento de contraseña habrían llevado a
  localhost. Corregido vía Management API antes de mandar la primera
  invitación real.

Pendiente: probar el flujo completo (dar acceso, reenviar, cambiar
email, revocar, restaurar) desde el panel con un email propio — ver
[PLAN_ACCESO_PORTAL.md](PLAN_ACCESO_PORTAL.md).

## 2026-07-12 ("Acceso al Portal" — gestión de clientes sin el dashboard de Supabase)

Nueva sección "Acceso al portal" en el panel admin, más un selector de
clientes (pensado para "cientos de clientes", no solo el actual).
Objetivo: invitar/revocar/reenviar/restablecer contraseña/cambiar
email de un cliente sin entrar nunca al dashboard de Supabase.

- `supabase/05_client_access_columns.sql`: columnas `portal_email` /
  `portal_user_id` / `portal_access_status` en `clients` (aditivo, no
  toca RLS ni lectura pública).
- `supabase/functions/manage-client-access/index.ts`: Edge Function
  nueva — única pieza del proyecto con la `service_role key`. Verifica
  que quien llama es admin antes de usarla. Acciones: `invite`,
  `resend`, `grant`, `revoke`, `change_email`.
- `js/store.supabase.js`: `listClients()`, `manageAccess()`,
  `resetPasswordForClient()`.
- `js/admin.js`: selector de clientes + sección "Acceso al portal" en
  el panel.
- `supabase/06_client_access_gate.sql`: preparado, **sin correr
  todavía** — retira la lectura pública y la reemplaza por un gate real
  por cliente. Pendiente invitar primero a Juan Guzmán con este
  mecanismo y construir el estado "sin acceso" en el frontend. Ver
  [PLAN_ACCESO_PORTAL.md](PLAN_ACCESO_PORTAL.md).

Pendiente (del admin, no del código): correr `05_client_access_columns.sql`,
desplegar la Edge Function, y probar el flujo completo con un email
propio — instrucciones exactas en el plan.

## 2026-07-12 (Migración a Supabase — cierre, verificación end-to-end)

El propio admin corrió la prueba de punta a punta en producción
(`portalreelsupra.netlify.app`), con sus credenciales reales — el
único paso que no se podía verificar sin su contraseña:

1. Login real (email + contraseña) → panel "Modo administrador" abrió.
2. Editó el mensaje de bienvenida.
3. "Guardar cambios" → toast de éxito.
4. Recargó la página en modo cliente (sin `?admin=true`) → el cambio
   seguía ahí.
5. Abrió el portal desde el celular (nunca tuvo `localStorage` de este
   proyecto) → el cambio se veía igual.

**Los 5 pasos funcionaron sin ningún problema que corregir.** Con
esto, el objetivo original de la migración —que un cambio guardado se
vea desde cualquier dispositivo— queda confirmado en producción, no
solo en el código. Se da por **cerrada la migración a Supabase**. Lo
que queda (imágenes a Storage, sacar "Exportar JSON", la decisión de
producto sobre multi-cliente) son mejoras futuras, no parte de este
cierre — ver [PLAN_MIGRACION_SUPABASE.md](PLAN_MIGRACION_SUPABASE.md).

## 2026-07-12 (Migración a Supabase — cutover a producción)

Con el proyecto Supabase real creado por el cliente, el esquema
corrido (`01_schema.sql`–`04_seed_from_data_js.sql`) y verificado, y
las credenciales entregadas, se completó el cutover. Ver
[PLAN_MIGRACION_SUPABASE.md](PLAN_MIGRACION_SUPABASE.md).

- **`js/store.supabase.js` conectado** en `index.html`/`project.html`
  (reemplaza a `js/store.js`/localStorage). `js/store.js` y
  `js/data.js` se conservan sin borrar — `data.js` es ahora el
  fallback si Supabase no responde, `js/store.js` queda de referencia
  para rollback.
- **Login de admin real**: la contraseña plana (`agency.adminPassphrase`,
  ahora vestigial) se reemplazó por un modal de email + contraseña
  contra Supabase Auth (`RSStore.signIn/signOut/getSession`, nuevos en
  la interfaz de `RSStore`). Este cambio se hizo *junto* con el
  anterior a propósito — activar Supabase para lectura sin este login
  hubiera dejado el modo admin sin ninguna protección real (el objeto
  `agency` que devuelve Supabase no tiene contraseña).
- `detectAdminMode()`/`toggleAdminMode()`/`tryActivateAdmin()` pasaron
  de síncronos (`window.prompt()` bloqueante) a `Promise` — `boot()`
  en ambos HTML encadena el resultado antes de renderizar.
- **Verificado contra el proyecto real, no simulado:**
  - Lectura pública (`agency_settings`/`clients`/`projects`) vía la
    publishable key — funciona, devuelve los datos reales del seed.
  - Escritura sin sesión admin: un `PATCH` real fue aceptado con 204
    pero **no modificó nada** (RLS filtró la fila) — confirmado
    releyendo el dato después.
  - `profiles` devuelve vacío para una request sin sesión — RLS
    correcto.
  - Portal completo (desktop + iPhone 13) cargando los datos reales de
    Juan Guzmán y sus 2 proyectos, sin errores de consola ni requests
    fallidos, `window.RS_SUPABASE_OFFLINE` en `false`.
  - Login con credenciales incorrectas: rechazado, toast de error,
    `RS_ADMIN_MODE` se mantiene en `false`.
  - **No verificado** (requiere la contraseña real del admin, que no
    corresponde compartir): login exitoso y guardado end-to-end.
    Pendiente de que el admin lo confirme una vez.

## 2026-07-12 (Migración a Supabase — análisis, diseño e infraestructura)

Disparado por: el cliente reportó que sus cambios (logos, portada) no
se veían desde otro dispositivo — investigado y confirmado que vivían
solo en `localStorage` de una PC, nunca en el repo. Pedido explícito
de migrar a Supabase, diseñando para "cientos de clientes". Ver
[PLAN_MIGRACION_SUPABASE.md](PLAN_MIGRACION_SUPABASE.md) para el
análisis y diseño completos.

- **Sin cambios visibles en producción todavía** — este pase es
  infraestructura y diseño, no cutover. `js/store.js` (localStorage)
  sigue siendo el que corre en el sitio en vivo.
- **Agregado, en paralelo, sin conectar:** esquema SQL completo
  (`supabase/01_schema.sql`), políticas de Row Level Security
  (`02_policies.sql`), 4 buckets de Storage (`03_storage.sql`), seed
  con el contenido real actual de `data.js` (`04_seed_from_data_js.sql`),
  y `js/store.supabase.js` (misma interfaz `{load,save,clear,hydrate}`
  que `js/store.js`, contra Supabase, con fallback a `data.js` si
  Supabase no responde).
- **Decisión de arquitectura:** cáscara relacional (`clients`/
  `projects`) + contenido de cada lista como `jsonb` — da RLS real por
  cliente sin tocar el motor declarativo existente (`LIST_SCHEMAS`/
  `BLOCK_DEFS`/Theme Builder). Ver [DECISIONES.md](DECISIONES.md).
- **Se reabre** la decisión "un cliente por deployment" (estaba
  marcada como resuelta) — el pedido de "cientos de clientes" la
  contradice. Documentado como señalado, no resuelto.
- **Cierre de una brecha de seguridad real** (no solo prolijidad):
  hoy el gate de admin es una contraseña en un JS público sin
  verificación del servidor — cualquiera podía saltearlo desde la
  consola del navegador. RLS lo va a hacer cumplir server-side.
- Bloqueado en: credenciales de un proyecto Supabase real (no
  fabricadas ni simuladas) — ver "Bloqueado en" en el plan.

## 2026-07-12 (V3 Portal Vivo — Prioridad 1: Responsive completo)

Pedido explícito: antes de seguir con funcionalidades nuevas (Centro de
Actividad, Hero carrusel), el portal debía quedar 100% responsive —
mobile first, sin regresiones en desktop/tablet, y sin ocultar
contenido por CSS. Ver [PLAN_V3_PORTAL_VIVO.md](PLAN_V3_PORTAL_VIVO.md).

- **Consolidación de breakpoints:** los 7 `@media` sueltos que había
  (760/860/700/640px mezclados, cada uno resuelto cerca del componente
  apenas se construyó) se reemplazaron por 2 bloques únicos al final de
  `css/styles.css` — Tablet (`max-width:1024px`) y Mobile
  (`max-width:640px`) — auditados componente por componente, no
  parche por parche.
- **Dos bugs reales encontrados y corregidos** (no solo estética) — ver
  detalle en [BUGS.md](BUGS.md): imágenes subidas sin comprimir podían
  superar la cuota de `localStorage` y "desaparecer" tras recargar
  (fix: redimensionado a 1280px antes de guardar); un guardado fallido
  se marcaba como exitoso en la UI, perdiendo el cambio en silencio
  (fix: el estado "sin guardar" solo se limpia si `RSStore.save()`
  devuelve éxito).
- **Objetivos táctiles:** todos los botones de solo ícono en modo admin
  (cerrar modal, ocultar bloque, arrastrar, editar/eliminar ítem de
  lista, flechas de reorden, favicon del logo de proyecto, navegación
  del calendario) pasan a un área táctil real de ~40px, sin agrandar
  visualmente los íconos (relleno invisible vía `padding`/`margin`
  negativo). Inputs/selects del panel admin pasan a 16px (antes 14px):
  por debajo de eso, Safari en iOS hace zoom automático de toda la
  página al enfocar un campo.
- **Modales full-screen en mobile:** editor de imagen, editor de pieza
  de contenido y editor genérico de listas (los tres comparten
  `.piece-modal`) pasan a una sola hoja inferior a pantalla completa en
  mobile — un solo cambio de CSS cubre los tres, en vez de tres
  arreglos separados.
- **Hero con prioridad visual en mobile:** la portada del cliente
  (`.hero__cover`) sangra hasta el borde de la pantalla en mobile en
  vez de quedar encajonada dentro del padding del `.shell` — se siente
  inmediata, no "comprimida".
- **Meta-row (Sector/Idioma/Público/Plan) y stats del header** pasan de
  `flex-wrap` con gap grande (huecos irregulares) a una grilla de 2
  columnas prolija en mobile.
- **Nada se oculta por CSS:** ningún dato del cliente (logos, portada,
  accesos rápidos, colores, fuentes) desaparece en mobile — solo
  cambia tamaño/proporción/posición. La única regla `display:none` que
  existía en un media query (`.admin-mode-badge span`) resultó ser
  código muerto (nunca hubo un `<span>` ahí) — se eliminó al
  consolidar, sin cambio de comportamiento real.
- Verificado con Chromium headless + Playwright en 5 dispositivos:
  Desktop, iPhone SE, iPhone 13, Pixel 7, iPad. Sin errores de consola,
  sin requests fallidos, sin overflow horizontal en ningún viewport.
  Flujo de subida de imagen probado con una foto sintética de 3.9MB
  (quedó en ~192KB). Regresión completa (público + admin + editor de
  listas + Theme Builder) sin errores.

## 2026-07-11 (Portal Cliente V2 — Fase 3: Header Inteligente)

- **Feature:** accesos rápidos configurables integrados al encabezado
  del proyecto (antes eran un bloque al final de la página) — pills de
  color con 8 tipos preconfigurados (whatsapp/drive/instagram/youtube/
  facebook/tiktok/calendar/custom) vía `QUICKLINK_TYPES`, editable con
  el mismo motor genérico de la Fase 2.
- **Feature:** resumen de estado en el header — progreso (ya existía,
  consolidado en un solo bloque visual), etapas completadas del
  roadmap, material pendiente.
- **Feature:** indicadores de actividad — última actualización, última
  entrega y próxima reunión, **todos derivados** de Bitácora/Calendario
  (sin campos manuales nuevos que puedan desincronizarse).
- **Cambio de datos:** `links[].style`/`.icon` (Fase 4 UX Premium) →
  `links[].type` + `.icon`/`.color` opcionales. Migrado directo en
  `data.js` (sin datos de producción reales todavía).
- **Fix incidental:** una etiqueta HTML mal cerrada (`<\div>`) en el
  hero del proyecto, presente desde antes de esta sesión — corregida
  al reescribir esa sección.
- Ver detalle en [PLAN_V2_CMS.md](PLAN_V2_CMS.md).
- Verificado con Chromium headless: pills con color correcto, resumen y
  actividad con valores derivados correctos, bloque viejo de links
  ausente, edición en vivo sin recargar. Regresión completa sin
  errores.

## 2026-07-11 (Portal Cliente V2 — Fase 2: editor genérico de listas)

- **Feature:** `RS.LIST_SCHEMAS` declarativo — 8 listas (Roadmap,
  Bitácora, Calendario, Recursos, Documentos, Material pendiente,
  Próximos pasos, Mejoras disponibles) administrables por completo
  desde el panel: crear, editar, eliminar, reordenar.
- **Feature:** un solo motor de edición (`openListEditor` + vistas de
  lista/formulario en `js/admin.js`) reutilizado por las 8 — sin lógica
  específica por tipo de bloque. El formulario reutiliza
  `field()`/`selectField()` ya existentes.
- **Feature:** grilla de accesos por proyecto en el panel
  (`buildContentListButtons`), con conteo de elementos por lista.
- **Arquitectura:** agregar un bloque de lista nuevo en el futuro =
  una entrada en `LIST_SCHEMAS` + una en `BLOCK_DEFS` — objetivo
  explícito de esta fase, cumplido.
- Ver detalle en [PLAN_V2_CMS.md](PLAN_V2_CMS.md).
- Verificado con Chromium headless sobre 3 esquemas representativos +
  1 lista primitiva (string): CRUD completo, guardado y persistencia
  tras recargar sin admin. Regresión completa sin errores.

## 2026-07-11 (Portal Cliente V2 — Fase 1: Theme Builder)

- **Feature:** `THEME_SCHEMA` declarativo en `js/render.js` — 19
  variables de tema (11 colores + 8 tipografía). `applyTheme()`
  generalizado para leerlo, en vez de aplicar solo el color principal.
- **Feature:** panel admin genera los 19 controles automáticamente
  desde el esquema (`buildThemeBuilder()`/`renderThemeField()` +
  `selectField()`/`rangeField()` nuevos en `js/admin.js`) — agregar una
  variable de tema futura no requiere escribir UI nueva.
- **Feature:** selector de fuente (DM Sans/Inter/Poppins/Manrope) con
  vista previa en vivo dentro del propio panel.
- **Feature:** logo de cliente (topbar) y favicon dinámico — mismo
  modal de imagen genérico ya existente, dos usos más.
- **Consolidación:** `client.primaryColor` migrado a
  `client.theme.primaryColor` — una sola fuente de verdad de theming.
- **Fix/mejora:** color de error conectado a los toasts de error que ya
  existían (contraseña incorrecta, guardado fallido) en vez de ser un
  campo sin efecto visible.
- Congelado el alcance de la V2 en [ALCANCE.md](ALCANCE.md) — no
  reabre CRM/Facturación/Métricas/Automatizaciones/IA, es sobre cómo se
  administra el portal existente.
- Ver detalle en [PLAN_V2_CMS.md](PLAN_V2_CMS.md).
- Verificado con Chromium headless: 19 controles generados
  correctamente, cambios en vivo, persistencia tras guardar+recargar
  sin admin. Sin errores en la suite de regresión completa.

## 2026-07-11 (Guardado centralizado + persistencia)

- **Feature:** capa de persistencia desacoplada `js/store.js`
  (`RSStore.load/save/hydrate`), hoy sobre `localStorage`, con
  interfaz async (`Promise`) para poder cambiar de backend (GitHub,
  Supabase, etc.) más adelante sin tocar `admin.js`.
- **Feature:** tracking de cambios sin guardar (`markDirty()` en
  `js/admin.js`) en TODOS los puntos de edición del admin: campos de
  texto/color/checkbox del panel, editor de piezas de contenido,
  reordenar/ocultar bloques, subir logo/portada.
- **Feature:** barra inferior fija (`.save-bar`) que solo aparece con
  cambios pendientes, con un único botón "Guardar cambios" — centraliza
  el guardado que antes eran varias acciones sueltas ("Aplicar
  cambios" solo refrescaba la vista, no persistía nada).
- **Feature:** confirmación por toast al guardar + la barra se oculta;
  aviso nativo (`beforeunload`) si se intenta cerrar/navegar con
  cambios sin guardar.
- **Feature:** `RSStore.hydrate()` se llama al principio de `boot()`
  (`index.html`/`project.html`, antes de cualquier render) — los
  cambios guardados sobreviven a un reload, incluso sin volver a
  entrar en modo admin.
- Ver el trade-off aceptado (reemplazo completo, no merge) en
  [DECISIONES.md](DECISIONES.md).
- Verificado con Chromium headless: barra ausente sin admin, aparece
  al primer cambio, `beforeunload` bloquea el cierre mientras hay
  cambios sin guardar, se guarda y persiste tras recargar (confirmado
  leyendo el hero ya editado en una visita nueva sin admin). Sin
  errores en la suite de regresión completa.

## 2026-07-11 (UX Premium — Fase 4, cierre del plan)

- **Feature:** `blockLinks()` soporta 3 variantes por link
  (`style: "button" | "card" | "link"`) — botón (`.btn--primary`
  reutilizado), tarjeta (`.link-card`, nueva) o enlace simple
  (`.link-list`, el de siempre, default sin romper datos existentes).
- **Fix:** `.link-cards` usaba `grid-template-columns: repeat(auto-fill, ...)`
  — con una sola tarjeta quedaba angosta y el texto se cortaba.
  Cambiado a `auto-fit`. Encontrado y corregido en la propia
  verificación visual de esta fase.
- **Data:** `links[].style` + `links[].icon` en ambos proyectos de
  ejemplo, mostrando las 3 variantes.
- Con esta fase se completan las 4 fases del plan de UX Premium. Ver
  cierre en [PLAN_UX_PREMIUM.md](PLAN_UX_PREMIUM.md#plan-completo--cierre).
- Verificado con Chromium headless: sin errores.

## 2026-07-11 (UX Premium — Fase 3)

- **Feature:** Bitácora convertida en timeline visual — reutiliza el
  componente `.roadmap` existente en vez de la lista plana anterior.
  Cada entrada tiene un `type` (`milestone`/`delivery`/`material`/
  `note`) con ícono y color de punto propio.
- **CSS:** 4 modificadores nuevos de color de punto
  (`.roadmap__item--milestone/--delivery/--material/--note`), sin
  tocar los modificadores que usa el Roadmap real. `.roadmap__phase`
  pasa a flex para poder llevar ícono + texto.
- **Data:** `bitacora[].type` agregado en ambos proyectos de ejemplo.
- Ver detalle en [PLAN_UX_PREMIUM.md](PLAN_UX_PREMIUM.md#fase-3--experiencia-viva-2026-07-11--✅-implementada).
- Verificado con Chromium headless: sin errores; sin regresión visual
  en el Roadmap.

## 2026-07-11 (UX Premium — Fase 2)

- **Feature:** barra de progreso general del proyecto
  (`contentProgress` + `progressBar` en `js/render.js`) — en la
  tarjeta del índice y en el hero del detalle. Reutiliza el mismo
  cálculo que ya usaba el bloque "Piezas de contenido".
- **Feature:** dos estados nuevos (`planning` 🔵, `pending-approval`
  🟡) sumados al diccionario de estados existente — `pending-approval`
  reutiliza el color amber ya existente, `planning` es el único color
  nuevo agregado.
- **Fix de layout:** `.status-badge` ahora tiene `align-self:
  flex-start` para no estirarse al pasar a ser hijo directo de un
  contenedor flex en columna (necesario para apilar badge + barra de
  progreso en la tarjeta del índice).
- Ver detalle en [PLAN_UX_PREMIUM.md](PLAN_UX_PREMIUM.md#fase-2--dashboard-visual-2026-07-11--✅-implementada).
- Verificado con Chromium headless: sin errores en las 5 vistas de
  regresión, confirmado visualmente.

## 2026-07-11 (UX Premium — Fase 1)

- **Feature:** color de marca por cliente (`client.primaryColor`) vía
  `RS.applyTheme()` — pisa las variables CSS existentes en runtime, sin
  nuevo sistema de theming. Preview en vivo desde el panel admin.
- **Feature:** portada del cliente (`client.coverImage`) en el hero del
  índice, con placeholder de admin cuando no hay imagen.
- **Refactor:** modal de logo generalizado a `openImageModal(config)`
  reutilizable — ahora sirve tanto para el logo de proyecto como para
  la portada del cliente, sin duplicar código.
- **Feature:** gate simple de contraseña para el modo admin
  (`agency.adminPassphrase`, `verifyPassphrase`/`tryActivateAdmin` en
  `js/admin.js`) — evita el acceso accidental, no es seguridad real
  (documentado explícitamente).
- Ver detalle completo en
  [PLAN_UX_PREMIUM.md](PLAN_UX_PREMIUM.md#fase-1--personalización-premium-2026-07-11--✅-implementada).
- Verificado con Chromium headless (passphrase correcta/incorrecta,
  color en vivo, upload de portada, regresión de logo de proyecto):
  sin errores de consola.

## 2026-07-11 (deployment)

- Repo conectado a `https://github.com/REELSUPRA/portal` (rama `main`,
  push inicial de los 3 commits existentes).
- Netlify conectado al repo — deploy automático activo.
- **Sitio en producción: https://portalreelsupra.netlify.app/**
- Verificado con Chromium headless contra la URL real: portal, detalle
  de proyecto y redirect `/admin` — sin errores de consola, sin
  requests fallidos.

## 2026-07-11 (continuación)

- **Decisión de arquitectura resuelta:** "Clientes" en el Panel
  Administrador = un deployment por cliente (ver
  [DECISIONES.md](DECISIONES.md)). Portal del Cliente y Panel
  Administrador quedan al 100% del alcance V1 definido en
  [ALCANCE.md](ALCANCE.md).
- **Feature:** switch "Mostrar aviso al cliente" en el panel admin
  (`js/admin.js`: `checkboxField` + control sobre
  `data.announcement.active`; `css/styles.css`: `.admin-checkbox-field`).

## 2026-07-11

- **Docs:** creada la estructura completa de `DOCUMENTACION/` (VISION,
  ALCANCE, ARQUITECTURA, DECISIONES, ROADMAP, VERSIONES, CHANGELOG,
  IDEAS, BUGS).
- **Alcance:** congelado el alcance de la V1 — Portal del Cliente +
  Panel Administrador únicamente, filosofía "centralizar sin duplicar",
  CRM/Facturación/Métricas/Automatizaciones/IA explícitamente fuera de
  alcance por ahora.
- **Feature:** agregado módulo **Bitácora** al Portal del Cliente
  (`js/render.js`: `blockBitacora` + entrada en `BLOCK_DEFS`;
  `js/data.js`: campo `bitacora` por proyecto).
- **Feature:** agregado módulo **Mejoras disponibles (Upsells)** al
  Portal del Cliente (`js/render.js`: `blockUpsells` + entrada en
  `BLOCK_DEFS`; `js/data.js`: campo `upsells` por proyecto;
  `css/styles.css`: estilos `.upsell-*`).
- **Data:** actualizado `defaultBlockOrder()` en `js/data.js` para
  incluir los dos módulos nuevos; agregados datos de ejemplo en ambos
  proyectos (`jga-realtor`, `jga-closets`).
- Consolidación de `PORTALCLIENTE` (raíz) y `PORTALCLIENTE V2` en una
  sola estructura completa — ver [DECISIONES.md](DECISIONES.md).
- Verificación end-to-end del sitio con Chromium headless: sin errores
  de consola en portal, detalle de proyecto ni modo admin.
- `git init` + commit baseline (`7e49cc4`).
