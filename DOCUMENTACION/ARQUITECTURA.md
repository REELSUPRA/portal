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
js/render.js         Motor de renderizado — lee CLIENT_DATA y dibuja
js/admin.js          Modo administrador — estado de sesión, drag&drop,
                     modales de edición
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

## Modo administrador (`js/admin.js`)

- Se activa con `?admin=true`, ruta `/admin` (via `_redirects`), o
  `Ctrl/Cmd+Shift+A`.
- Estado en `window.RS_ADMIN_MODE`, persistido solo en
  `sessionStorage` (no hay backend, no hay usuarios, no hay login).
- Todo lo editable en modo admin vive **en memoria del navegador**
  durante la sesión. Para persistir cambios: "Exportar JSON" y
  reemplazar manualmente el objeto en `js/data.js`.
- Cubre hoy: reordenar/ocultar bloques (drag&drop), editar piezas de
  contenido (modal), cambiar logo (upload o URL), editar textos básicos
  (nombre cliente, mensaje de bienvenida, aviso, nombre/estado/objetivo
  de cada proyecto) desde un panel lateral.
- **No cubre** edición de listas (goals, roadmap, nextSteps,
  pendingMaterial, resources, documents, links, calendar, bitacora,
  upsells) desde la UI — esas se editan directamente en `data.js`. Es
  una decisión de simplicidad, no una limitación técnica: evita
  construir un editor de listas genérico antes de que haga falta.

## Modelo de despliegue: un cliente por sitio

La reutilización para un cliente nuevo es **duplicar la carpeta
completa** y reemplazar `client`/`projects` en `data.js` (documentado en
el `README.md` original del proyecto). No hay selector de cliente, no
hay login, no hay multi-tenancy: cada cliente tiene su propio deployment
de Netlify.

Esto es consistente con el alcance actual (una V1 para Juan Guzmán) pero
**entra en tensión** con el pedido de que el Panel Administrador
gestione "Clientes" en plural. Ver [DECISIONES.md](DECISIONES.md) —
esa tensión está señalada como decisión pendiente, no resuelta.

## Frontend: sin framework

HTML generado por template strings + `innerHTML`. Sin JSX, sin Vue,
sin build. `esc()` sanitiza todo texto insertado (usa
`textContent`→`innerHTML` del propio DOM, no una librería). Iconos via
Lucide (CDN, `data-lucide="nombre"` + `lucide.createIcons()`).
Tipografía Google Fonts (DM Sans / DM Mono) por CDN.

## Versionado

Git local (`git init` inicializado el 2026-07-11). Sin remoto configurado
todavía. Ver [VERSIONES.md](VERSIONES.md).
