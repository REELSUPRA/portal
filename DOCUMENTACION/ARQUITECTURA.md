# Arquitectura

Última actualización: 2026-07-11.

## Resumen

Sitio estático, sin backend ni base de datos. Pensado para desplegarse
en Netlify (arrastrar carpeta o conectar repo). Todo el "estado" vive en
un objeto JS (`CLIENT_DATA`) y en `sessionStorage` para el modo admin.
No hay build step: HTML/CSS/JS planos, sin transpilación ni bundler.

## Estructura de archivos

```
index.html          Bienvenida + selector de proyectos del cliente
project.html         Detalle de un proyecto (?id=slug-del-proyecto)
_redirects           Redirect de Netlify: /admin -> /index.html?admin=true
css/styles.css       Design system completo (variables, componentes)
js/data.js           Datos del cliente y sus proyectos — ÚNICO archivo
                     pensado para editar al reutilizar con otro cliente
js/store.js          Capa de persistencia (RSStore) — hoy localStorage
js/render.js         Motor de renderizado — lee CLIENT_DATA y dibuja
js/admin.js          Modo administrador — estado de sesión, drag&drop,
                     modales de edición, tracking de cambios sin guardar
DOCUMENTACION/       Esta carpeta
```

## Modelo de datos (`js/data.js`)

```
window.CLIENT_DATA = {
  agency:  { name, tagline },
  client:  { name, greetingEmoji, welcomeMessage },
  announcement: { active, text },
  projects: [
    {
      id, emoji, logoUrl, name, sector, language, audience,
      plan, planDetail, status, statusTone, objective,
      goals: [string],
      roadmap: [{ phase, status, detail }],
      contentPieces: [{ id, title, status, publishDate, videoUrl, note }],
      nextSteps: [string],
      pendingMaterial: [string],
      resources: [{ label, url }],
      documents: [{ label, url }],
      links: [{ label, url }],
      calendar: [{ date, label }],
      bitacora: [{ date, text }],
      upsells: [{ title, description, ctaLabel, ctaUrl }],
      blocks: [{ id, visible }],   // orden y visibilidad de módulos
    },
    ...
  ],
}
```

`client.coverImage` (portada del hero), `client.logoUrl` (logo en el
topbar) y `client.faviconUrl` siguen el mismo patrón: URL o base64
subido desde el admin. `client.theme` guarda todas las variables del
Theme Builder (ver sección propia abajo). `agency.adminPassphrase` es
el gate simple del modo admin (ver sección "Modo administrador" abajo).

Un proyecto = un objeto. Un cliente = varios proyectos. **Un deployment
sirve a un cliente** (ver sección "Modelo de despliegue" abajo).

## Motor de renderizado (`js/render.js`)

Módulo `RS` (IIFE, expuesto en `window.RS`). No tiene estado propio más
allá de `calendarState` (mes visible del calendario). Todo lo demás se
recalcula a partir de `CLIENT_DATA` en cada render.

Patrón central: **registro de bloques** (`BLOCK_DEFS`). Cada módulo del
detalle de proyecto (Objetivos, Roadmap, Calendario, Bitácora, etc.) es
una entrada `{ title, icon, render(project) }` en ese registro.
`renderBlocks()` itera `project.blocks` (orden + visibilidad definidos
por proyecto) y llama al `render()` correspondiente.

**Agregar un módulo nuevo al Portal del Cliente = agregar una entrada a
`BLOCK_DEFS` + una función `blockX(project)` + el campo de datos en
`data.js`.** No se toca el resto del motor. Este es el patrón a seguir
para cualquier futuro módulo del portal — evita duplicar lógica de
layout, drag&drop o visibilidad, que ya está resuelta a nivel genérico.

## Theme Builder (`THEME_SCHEMA` en `js/render.js`)

Patrón declarativo, el mismo espíritu que `BLOCK_DEFS` pero para
variables de tema en vez de módulos de contenido:

```
const THEME_SCHEMA = [
  { group, key, label, cssVar, type, default, options?, min?, max?, unit? },
  ...
];
```

- `applyTheme()` recorre el esquema una vez y pisa cada `cssVar` en
  `document.documentElement.style` con el valor guardado en
  `client.theme[key]` (o `default` si no fue personalizado). Agregar
  una variable de tema nueva = agregar una fila al esquema — no se
  toca `applyTheme()`.
- En `admin.js`, `buildThemeBuilder()` recorre el mismo esquema y
  genera el control según `type` (`color` → input color, `select`/
  `font` → `<select>`, `range` → slider) vía `renderThemeField()`,
  agrupado por `group` (hoy: "Colores", "Tipografía"). Ningún campo del
  Theme Builder tiene código de UI escrito a mano — todos salen del
  esquema.
- Incluye una tarjeta de vista previa en vivo (`.theme-preview`) dentro
  del propio panel — usa las mismas variables CSS reales, así que
  refleja los cambios al instante sin lógica extra (el panel no está
  atenuado por el overlay, a diferencia del resto de la página detrás).
- **Reutiliza variables existentes cuando ya existían** en vez de
  duplicar: "Color de texto secundario" y "Color de bordes" escriben
  directamente sobre `--rs-gray-500`/`--rs-gray-100`, que ya eran la
  fuente única usada en toda la hoja de estilos.

## Editor genérico de listas (`RS.LIST_SCHEMAS` en `js/render.js`)

Mismo espíritu que `BLOCK_DEFS`/`THEME_SCHEMA`: un esquema declarativo
por tipo de lista, un solo motor de edición en `admin.js` que lo lee.

```
const LIST_SCHEMAS = {
  roadmap: { fields: [...], newItem: () => ({...}), itemLabel: (item) => ... },
  bitacora: { ... },
  calendar: { ... },
  resources: { ... },
  documents: { ... },
  pendingMaterial: { primitive: true, fields: [...], ... },  // lista de strings, no objetos
  nextSteps: { primitive: true, ... },
  upsells: { ... },
};
```

- **Título e ícono no se duplican**: el editor los lee de
  `RS.BLOCK_DEFS[listKey]` (ya existente para el render de solo
  lectura) en vez de repetirlos en `LIST_SCHEMAS`.
- **Un solo modal** (`admin.js`: `openListEditor(project, listKey)`)
  sirve a las 8 listas. Tiene dos vistas internas: lista (reordenar con
  flechas ↑↓, editar, eliminar, agregar) y formulario (generado campo
  por campo desde `schema.fields`, reutilizando `field()`/
  `selectField()` — los mismos helpers del Theme Builder).
- **`primitive: true`** marca las listas que son arrays de strings
  (Material pendiente, Próximos pasos) en vez de arrays de objetos —
  el formulario les muestra un solo campo de texto y el commit
  reemplaza el string completo, sin necesidad de una rama de código
  aparte en el motor.
- **Botón de acceso por lista**: en el panel lateral, cada proyecto
  muestra una grilla de botones (uno por entrada de `LIST_SCHEMAS`,
  con conteo de elementos) que abre el editor para esa lista y ese
  proyecto — `buildContentListButtons()`.
- **Agregar un bloque de lista nuevo en el futuro:** una entrada en
  `LIST_SCHEMAS` (forma de los datos) + una en `BLOCK_DEFS` (render de
  solo lectura, ya existía como patrón). El editor, el modal, el botón
  del panel y el conteo salen solos — no se escribe UI nueva.
- **Qué no cubre esto:** piezas de contenido (tiene su propio editor
  más especializado, con estado delivered/pending) y el
  orden/visibilidad de bloques completos (ya resuelto por drag&drop en
  la página, sin relación con este motor).

## Header Inteligente (`project.links` + derivados, en `js/render.js`)

`links` dejó de ser un bloque más de la página — es la fuente de datos
de los **accesos rápidos** del encabezado del proyecto. Se sigue
editando con el mismo editor genérico de listas (`LIST_SCHEMAS.links`),
solo que ya no se dibuja como card al final de la página
(`BLOCK_DEFS.links` sigue existiendo únicamente para que el editor
tenga título/ícono — no está en `defaultBlockOrder()`, así que
`renderBlocks()` nunca lo pinta como card).

- **`QUICKLINK_TYPES`**: preset de ícono+color por `type`
  (whatsapp/drive/instagram/youtube/facebook/tiktok/calendar/custom).
  `item.icon`/`item.color` opcionales anulan al del tipo. Íconos
  elegidos entre los ya confirmados en este proyecto (no glifos de
  marca, que Lucide puede no incluir según versión del CDN).
- **Resumen y actividad — todo derivado, nada manual:**
  `roadmapSummary(project)` cuenta fases con `status: "done"` sobre
  `project.roadmap`; `projectActivity(project)` lee la bitácora más
  reciente (última actualización), la última con `type: "delivery"`
  (última entrega), y el próximo `project.calendar` con fecha futura
  (próxima reunión). Ninguno es un campo aparte que alguien tenga que
  mantener sincronizado — editar Bitácora/Calendario/Roadmap desde el
  editor genérico ya actualiza estos indicadores solo.
- Progreso general (`contentProgress`, ya existía) se movió del hero
  a este mismo bloque (`.smart-header`) para no duplicar la barra.

## Modo administrador (`js/admin.js`)

- Se activa con `?admin=true`, ruta `/admin` (via `_redirects`), o
  `Ctrl/Cmd+Shift+A` — pidiendo antes `agency.adminPassphrase` vía
  `window.prompt()` (una vez por sesión de navegador,
  `sessionStorage.rsAdminAuthed`). **No es autenticación real**: la
  contraseña vive en un archivo JS público: no protege contra un
  acceso intencional, solo evita el accidental. Ver
  [DECISIONES.md](DECISIONES.md).
- Estado en `window.RS_ADMIN_MODE`, persistido solo en
  `sessionStorage` (no hay backend, no hay usuarios, no hay login real).
- Todo lo editable en modo admin marca el estado como "sin guardar" —
  aparece una barra inferior con un único botón "Guardar cambios"
  (`markDirty()`/`saveChanges()` en `admin.js`). Al guardar, persiste
  vía `RSStore.save()` (`js/store.js` — hoy `localStorage`, por
  navegador) y avisa con `beforeunload` si se intenta cerrar la
  pestaña con cambios sin guardar. Al volver a entrar en ese mismo
  navegador, `RSStore.hydrate()` reemplaza `CLIENT_DATA` con lo
  guardado, antes de cualquier render (ver `boot()` en `index.html`/
  `project.html`).
- **`RSStore` es la única pieza que sabe dónde se guarda.** Cambiar el
  destino (GitHub, Supabase, un backend propio) es reescribir
  `js/store.js` — `admin.js` solo llama `load()`/`save()`/`hydrate()`,
  nunca `localStorage` directamente. La interfaz ya es async
  (`Promise`) aunque `localStorage` sea síncrono, para que ese cambio
  futuro no toque la UI del admin.
- **Limitación conocida:** `save()` guarda una foto completa de
  `CLIENT_DATA`; `hydrate()` la reemplaza entera, sin merge. Si
  `data.js` cambia después de un guardado local, la foto vieja gana en
  ese navegador. Ver [DECISIONES.md](DECISIONES.md).
- Para que un cambio local sea la nueva base para todos (otros
  dispositivos, nuevo cliente): "Exportar JSON" y reemplazar
  manualmente el objeto en `js/data.js`.
- Cubre hoy: reordenar/ocultar bloques (drag&drop), editar piezas de
  contenido (modal), cambiar logos/portada/favicon (modal de imagen
  genérico, `openImageModal`, upload o URL), Theme Builder completo
  (colores + tipografía, ver sección propia), editar textos básicos
  (nombre cliente, mensaje de bienvenida, aviso, nombre/estado/objetivo
  de cada proyecto) desde un panel lateral.
- **No cubre todavía** edición de listas (goals, roadmap, nextSteps,
  pendingMaterial, resources, documents, links, calendar, bitacora,
  upsells) desde la UI — esas se editan directamente en `data.js`. Es
  el objetivo de la Fase 2 de la V2 (editor genérico de listas, ver
  [PLAN_V2_CMS.md](PLAN_V2_CMS.md)) — no construido todavía.

## Modelo de despliegue: un cliente por sitio

La reutilización para un cliente nuevo es **duplicar la carpeta
completa** y reemplazar `client`/`projects` en `data.js` (documentado en
el `README.md` original del proyecto). No hay selector de cliente, no
hay login, no hay multi-tenancy: cada cliente tiene su propio deployment
de Netlify.

Esto ya fue evaluado explícitamente contra el pedido de que el Panel
Administrador gestione "Clientes" en plural: se decidió mantener este
modelo (un deployment por cliente) para la V1 y la V2. Ver
[DECISIONES.md](DECISIONES.md) — no es una tensión pendiente, está
resuelta.

## Frontend: sin framework

HTML generado por template strings + `innerHTML`. Sin JSX, sin Vue,
sin build. `esc()` sanitiza todo texto insertado (usa
`textContent`→`innerHTML` del propio DOM, no una librería). Iconos via
Lucide (CDN, `data-lucide="nombre"` + `lucide.createIcons()`).
Tipografía Google Fonts por CDN — DM Sans/DM Mono (defaults) + Inter,
Poppins y Manrope precargadas para el selector de fuente del Theme
Builder (así elegir una no requiere inyectar un `<link>` en runtime).

## Versionado y deployment

Git local (`git init` el 2026-07-11), remoto en
`https://github.com/REELSUPRA/portal` (rama `main`). Netlify conectado
al repo con deploy automático en cada push — sin build command, publish
directory = raíz. Producción: **https://portalreelsupra.netlify.app/**.
Ver [VERSIONES.md](VERSIONES.md).
