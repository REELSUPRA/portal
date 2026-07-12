# Plan — V3: Portal Vivo

Estado: **Prioridad 1 (Responsive completo) implementada y verificada
(2026-07-12).** Prioridades 2 y 3 pendientes, con corrección de alcance
del 2026-07-12 incorporada abajo (todavía sin implementar).

Corrección explícita de objetivo (2026-07-12): esto no es una
implementación "funcional nomás" — el estándar es que el portal se
sienta como un producto SaaS premium. Aplica a las tres prioridades,
no solo a la visual.

Objetivo del pedido: que el portal deje de sentirse como una página de
información estática y pase a sentirse como una aplicación viva, en
cualquier dispositivo. Cuatro frentes, en el orden de prioridad dado:
responsive completo, Centro de Actividad, Hero Inteligente (carrusel),
y la arquitectura que sostiene a los tres.

---

## Prioridad 4 primero (es la que ordena a las otras tres)

### Qué ya existe que se puede reutilizar tal cual

| Necesidad | Ya existe | Nota |
|---|---|---|
| Derivar datos sin duplicarlos | `roadmapSummary()`, `projectActivity()` (`js/render.js`) | Mismo patrón exacto que necesita el Centro de Actividad — se extiende, no se rehace |
| Esquema declarativo + editor genérico de listas | `LIST_SCHEMAS` + `openListEditor()` (`js/admin.js`) | Es literalmente lo que pide la Prioridad 3 para el Hero: una lista más, cero motor nuevo de edición |
| Registro de bloques de solo lectura | `BLOCK_DEFS` | El Centro de Actividad y el Hero no son "contenido editable ítem por ítem visible como card", así que no entran ahí — van como secciones fijas, mismo criterio ya usado para `smart-header` (ver `ARQUITECTURA.md`) |
| Modal de imagen reutilizable | `openImageModal()` | Cada slide del Hero necesita imagen — mismo componente, una instancia más |
| Guardado unificado, `markDirty()` | `js/store.js` + `admin.js` | No cambia nada — todo lo nuevo pasa por lo mismo |

### Qué es genuinamente nuevo

- **Un "audit" responsive sistemático** de cada componente visual — no
  hay ningún motor que reutilizar acá, es trabajo de CSS deliberado.
- **Un registro de reglas de derivación de eventos** para el Centro de
  Actividad (no existe hoy un mecanismo para combinar 5 fuentes de
  datos en una sola línea de tiempo priorizada).
- **Un componente de carrusel** (autoplay, controles, dots) — no existe
  ningún carrusel en el proyecto hoy.

### Principio de arquitectura para las tres prioridades

Mismo criterio que viene guiando todo el proyecto: **separar "forma de
los datos" (declarativa, reutiliza lo que ya existe) de "cómo se
dibuja" (nuevo, pero una sola vez, genérico dentro de su propio
dominio).** Ninguna de las tres prioridades necesita tocar el editor
genérico de listas ni el motor de bloques — se apoyan en ellos.

---

## Prioridad 1 — Responsive completo

### Diagnóstico del estado actual

Hoy hay 7 `@media` sueltos, cada uno resolviendo un componente aislado
apenas fue construido (`project-grid` en 760px, `detail-grid` en
860px, `save-bar`/`content-grid`/`cal-grid` en 640px, `admin-mode-badge`
en 700px). Esto es exactamente el patrón que pediste evitar: parches
puntuales, sin una visión conjunta, con breakpoints distintos para
problemas parecidos. Ningún componente construido en las fases V2
(Theme Builder, editor de listas, Header Inteligente) tiene todavía
ningún ajuste responsive — son 100% nuevos para este frente.

Puntos de riesgo concretos que encontré:

- **Objetivos táctiles chicos**: `logo-edit-btn` (22px), botones de
  `list-editor-item__edit/delete` (con solo 4px de padding),
  `block-visibility-toggle`, flechas de reordenar — todos por debajo de
  los ~40-44px recomendados para dedo.
- **Grids fijos sin adaptar**: `content-list-buttons` (`1fr 1fr` fijo,
  sin importar el ancho), `content-grid` (8 columnas, ya tiene ajuste a
  4 en mobile pero no hay paso intermedio para tablet).
- **El Header Inteligente (Fase 3, recién construido) no tiene ningún
  ajuste responsive**: `quicklinks-row`, `smart-header__stats`,
  `smart-header__activity` fueron diseñados y verificados solo en
  desktop.
- **Modales**: `admin-panel` ya es full-width en mobile por diseño
  (`min(420px, 100vw)`) — está bien. `list-editor-modal` y
  `theme-preview` no fueron probados en mobile todavía.
- **Calendario**: es el único componente que ya tiene una adaptación
  mobile pensada (puntos en vez de texto en los eventos) — es el
  patrón de calidad a igualar en el resto, no a repetir literal.

### Estrategia propuesta

En vez de seguir agregando `@media` puntuales cerca de cada componente
(lo que ya generó el problema actual), propongo:

1. **Estandarizar 2 quiebres únicos para todo el proyecto**: `1024px`
   (tablet) y `640px` (mobile) — hoy hay 640/700/760/860 mezclados sin
   motivo real. Consolido todo bajo esos dos.
2. **Auditoría completa por componente**, no por archivo: recorro cada
   superficie que listaste (Dashboard, Header de proyecto, Accesos
   rápidos, Timeline/Bitácora, Calendario, Panel admin, Editor de
   listas, Theme Builder) y decido para cada una qué cambia en cada
   quiebre — layout (columnas → stack), tamaño de texto, tamaño de
   objetivos táctiles, espaciado. Esto se escribe en bloques agrupados
   y comentados al final de cada sección del CSS (no un archivo mobile
   aparte, que sería duplicar la hoja de estilos).
3. **Objetivos táctiles**: subir a mínimo ~40px todo elemento
   interactivo dentro de vistas de admin (editor de listas, panel,
   Theme Builder) — es el único cambio que toca tamaños en desktop
   también, pero de forma imperceptible (son botones de ícono).
4. **Verificación**: script de Playwright que recorre las 5 páginas ya
   cubiertas por la regresión existente, en 3 viewports fijos —
   375×812 (mobile), 768×1024 (tablet), 1440×900 (desktop) — con
   captura de pantalla de cada combinación página×viewport antes y
   después, más una pasada específica abriendo cada modal (editor de
   listas, Theme Builder, imagen) en viewport mobile para confirmar que
   se puede operar con el modal ocupando la pantalla sin overflow
   horizontal.

No hay ninguna decisión de arquitectura pendiente en este frente — es
ejecución. Lo empiezo primero, como pediste, porque además es la base
sobre la que se van a dibujar el Centro de Actividad y el carrusel del
Hero (evita construirlos dos veces).

### Resultado (2026-07-12) — ✅ implementado

- Los 7 `@media` sueltos se consolidaron en 2 bloques únicos (Tablet
  `<=1024px`, Mobile `<=640px`) al final de `css/styles.css`, auditados
  componente por componente (los 15 listados arriba, sin excepción).
- **Se encontraron y corrigieron dos bugs reales**, no solo estética
  — coincidían con lo que reportaste ("logos/portada no aparecen o se
  rompen"): imágenes subidas sin comprimir podían superar la cuota de
  `localStorage` (foto de celular sin redimensionar = varios MB en
  base64) y el guardado fallaba en silencio; y un guardado fallido se
  marcaba como exitoso en la UI (se perdía el cambio sin aviso real).
  Detalle completo en [BUGS.md](BUGS.md) y [CHANGELOG.md](CHANGELOG.md).
- **Ningún dato del cliente se oculta por CSS** — verificado
  explícitamente: logos, portada, accesos rápidos, colores y fuentes
  se probaron con datos reales inyectados en los 5 dispositivos
  pedidos y siempre están presentes, solo cambia tamaño/posición.
- Objetivos táctiles ~40px en todo el modo admin (medido, no solo
  visual — ver métodos de verificación abajo).
- Hero con prioridad visual en mobile: portada sangra a los bordes de
  la pantalla en vez de quedar encajonada.
- **Verificación:** Chromium headless vía Playwright en Desktop
  (1440×900), iPhone SE, iPhone 13, Pixel 7 e iPad. Para cada uno:
  `index.html`, `project.html` (público y admin), panel admin, editor
  genérico de listas, Theme Builder — capturas de cada combinación,
  medición de `scrollWidth` vs `clientWidth` (0 casos de overflow
  horizontal), 0 errores de consola, 0 requests fallidos, medición de
  bounding box de los controles táctiles (40×40px reales). Flujo de
  subida de imagen probado de punta a punta con una foto sintética de
  3.9MB → quedó en ~192KB sin pérdida visual perceptible. Fallo de
  guardado simulado (forzando una excepción en `localStorage.setItem`)
  para confirmar que la barra de guardado permanece abierta.

---

## Prioridad 2 — Centro de Actividad (corrección de alcance, 2026-07-12)

Corrección explícita: no es una lista cronológica — es un feed
priorizado. Cada tarjeta necesita más que ícono+texto: prioridad, tipo,
ícono, color, título, descripción, fecha, origen y CTA opcional. Máximo
5 eventos, ordenados por prioridad (no por fecha). Se mantiene 100%
derivado de Bitácora/Roadmap/Calendario/Material pendiente/Mejoras
disponibles — sin campos nuevos que mantener a mano.

Esto no cambia la arquitectura propuesta abajo (el registro declarativo
`ACTIVITY_RULES` sigue siendo la pieza central) — cambia la **forma**
de lo que cada regla devuelve y **el criterio de orden**:

```js
const ACTIVITY_RULES = [
  // priority: número — más alto se muestra primero. origin: de dónde
  // se leyó (para trazabilidad, no se muestra necesariamente en la UI).
  { id: "pending-material", type: "action-required", icon: "upload",   color: "warning", priority: 90, origin: "pendingMaterial", detect },
  { id: "next-meeting",     type: "meeting",         icon: "calendar", color: "info",    priority: 80, origin: "calendar",        detect },
  { id: "new-content",      type: "content-ready",   icon: "film",     color: "success", priority: 70, origin: "bitacora",         detect },
  { id: "milestone",        type: "milestone",        icon: "check-circle", color: "success", priority: 60, origin: "bitacora",    detect },
  { id: "new-upsell",       type: "upsell",          icon: "rocket",   color: "info",    priority: 40, origin: "upsells",          detect },
  { id: "last-update",      type: "update",          icon: "sparkles", color: "neutral", priority: 20, origin: "bitacora",         detect },
];

// cada detect(project) devuelve null o:
// { title, description, date, ctaLabel?, ctaUrl? }
```

El motor (`deriveActivityEvents(project)`) corre las reglas, descarta
las que no aplican, ordena por `priority` (empate → más reciente
primero) y corta en 5 — sin lógica de negocio fuera de las reglas.

Mapeos de contenido que sigo proponiendo por criterio propio (ver nota
completa en la versión anterior de este documento, sin cambios): "✅
Objetivo alcanzado" = último hito (`type:"milestone"`) de la Bitácora;
"⚠ Acción pendiente" reutiliza la señal de Material pendiente en vez de
un campo booleano nuevo. Corregime si alguno debería tener su propio
origen de datos.

### (Contexto original, sin cambios de fondo — sigue aplicando)

### Qué cambia respecto a lo que ya existe

El Header Inteligente (Fase 3) ya calcula 3 señales fijas (última
actualización, última entrega, próxima reunión) y las muestra como 3
líneas fijas dentro de `.smart-header__activity`. El Centro de
Actividad generaliza esa misma idea — de "3 campos fijos" a "una lista
priorizada de eventos, la cantidad que corresponda según haya o no
datos para cada uno" — y le da el protagonismo visual que pediste
("el corazón del portal", visible apenas se entra al proyecto).
Reemplaza y absorbe `.smart-header__activity`; el resumen numérico
(progreso, etapas, material pendiente) se mantiene como está, aparte.

**Agregar una señal nueva en el futuro = una entrada en
`ACTIVITY_RULES`** (ver forma actualizada del esquema más arriba). No
se toca el componente visual ni el motor que ordena/corta — mismo
criterio que ya usamos en las tres fases anteriores.

### Presentación visual (corregida — tarjetas, no chips)

Sección fija arriba del detalle del proyecto (mismo lugar de jerarquía
que hoy ocupa `.smart-header`, de hecho probablemente se integra ahí
mismo, arriba de accesos rápidos/progreso) — no es un bloque
reordenable/ocultable como Roadmap o Recursos, por el mismo motivo que
`smart-header` tampoco lo es: es información de sistema, no contenido
que el admin redacta. Cada evento es ahora una **tarjeta** (no un chip
de una línea): ícono + color según `type`, título, descripción, fecha
relativa, y botón de CTA si la regla lo trae — un componente nuevo
(`.activity-card`) pero uno solo, reutilizado por las hasta 5 tarjetas,
con una variante más prominente para la primera (la de mayor
prioridad).

---

## Prioridad 3 — Hero Inteligente (carrusel reutilizable, corrección de alcance 2026-07-12)

Corrección explícita a mi decisión anterior: el Hero **no es del
cliente** — es un componente reutilizable que debe poder existir a
nivel cliente (`index.html`) y, si en el futuro hace falta, a nivel de
cualquier proyecto individual también, sin escribir una segunda
implementación. Se retira mi decisión previa de "un solo carrusel a
nivel cliente" — queda reemplazada por lo siguiente.

### Arquitectura: el Hero como esquema + componente registrado, no un dato del cliente

La forma de resolver "reutilizable a nivel cliente O proyecto" sin
duplicar nada es la misma que ya usa el resto del sistema: separar la
**forma del dato** (un esquema declarativo, uno solo) de **quién es el
dueño de los datos** (el `client` o un `project` — ambos son, para el
editor, simplemente "una entidad con una lista"):

```js
// Esquema único — no le importa quién lo posee.
LIST_SCHEMAS.heroSlides = {
  fields: [
    { key: "imageUrl", label: "Imagen", type: "image" },
    { key: "title", label: "Título", type: "text" },
    { key: "description", label: "Descripción", type: "textarea" },
    { key: "ctaLabel", label: "Texto del botón", type: "text" },
    { key: "ctaUrl", label: "Link", type: "text" },
    { key: "expiresAt", label: "Expira el (opcional)", type: "date" },
  ],
  newItem: () => ({ imageUrl: "", title: "", description: "", ctaLabel: "", ctaUrl: "", expiresAt: "" }),
  itemLabel: (item) => item.title || "Nuevo slide",
};
```

- **`client.heroSlides`** (siempre existe, `index.html`) y
  **`project.heroSlides`** (opcional, por proyecto, solo si algún día
  hace falta un Hero propio en `project.html`) usan el **mismo**
  `LIST_SCHEMAS.heroSlides` y el **mismo** componente de render — nunca
  dos copias del esquema.
- **Requiere una generalización chica del editor genérico**, no un
  motor nuevo: hoy `openListEditor(project, listKey)` asume que el
  dueño de la lista es siempre un `project`. Para que el mismo botón
  funcione sobre `client`, la firma pasa a `openListEditor(entity,
  listKey)` — un cambio de una palabra en la forma de invocarlo, cero
  cambios en la lógica interna (list/formulario/reordenar/CRUD no le
  importa qué objeto es `entity`, solo que tenga `entity[listKey]`).
  Esto es exactamente lo que permite, después, "registrar" el Hero a
  nivel proyecto con una línea (un botón más en
  `buildContentListButtons(project)`) el día que haga falta — no una
  reimplementación.
- **Botón de acceso**: a nivel cliente, uno en el grupo "Cliente" del
  panel (siempre visible). A nivel proyecto: no se agrega todavía (no
  hay pedido concreto de un Hero por proyecto hoy) — pero queda
  documentado que agregarlo después es una línea, no una fase nueva.
- **Slides expirados** se filtran en el render (`expiresAt < hoy`), sin
  acción manual — mismo principio de "todo derivado cuando se puede"
  del Centro de Actividad.

### Lo único genuinamente nuevo: el componente visual del carrusel

No hay ningún carrusel hoy en el proyecto. Un solo componente
`renderHeroCarousel(slides, containerEl)` — recibe la lista de slides
y dónde dibujarse, no sabe ni le importa si vinieron de `client` o de
un `project`: autoplay con pausa al pasar el mouse/foco, controles
prev/next, dots de posición, swipe en mobile (gesto táctil nativo, sin
librería), degrada a una sola imagen estática sin controles si hay 0 o
1 slide visible. En `index.html` reemplaza a `.hero__cover` cuando
`client.heroSlides` tiene al menos un slide visible y no expirado; si
no, cae al comportamiento actual (imagen única o placeholder) — sin
romper nada para el estado actual de los datos.

---

## Orden de implementación

1. ~~**Responsive completo** (Prioridad 1)~~ — ✅ hecho (2026-07-12).
2. **Centro de Actividad** (Prioridad 2) — siguiente. Reutiliza el
   patrón de derivación ya construido en la Fase 3, riesgo bajo, alto
   impacto de percepción ("portal vivo").
3. **Hero Inteligente / carrusel reutilizable** (Prioridad 3) — depende
   del editor genérico (ya existe, con la generalización chica
   descripta arriba) y se beneficia de que el responsive ya esté
   resuelto antes de agregar gestos táctiles.

## Verificación obligatoria (aplica a las Prioridades 2 y 3 también, no solo a la 1)

Antes de dar por cerrada cualquier fase de esta V3: regresión con
Playwright en Desktop, iPhone SE, iPhone 13, Pixel 7 e iPad — sin
errores de consola, sin requests fallidos, sin overflow horizontal;
capturas de las vistas relevantes; y verificación explícita de que
logos/portada/colores/fuentes/accesos rápidos siguen presentes (no
solo "no rompe", sino "se ve bien") en cada dispositivo. Mismo
estándar ya aplicado en la Prioridad 1 — no es nuevo, se mantiene.

Cada fase, además: análisis de archivos afectados (ya hecho arriba para
las 3), reutilizo lo existente, actualizo `DOCUMENTACION/`
(`ARQUITECTURA.md`, este plan, `CHANGELOG.md`, `VERSIONES.md`) y hago
commit al terminar — mismo flujo que las fases anteriores. Si durante
la implementación aparece una arquitectura mejor que la descripta
acá, prioridad a la opción más escalable/mantenible a largo plazo,
documentando el cambio de rumbo en este mismo archivo.

**Siguiente paso: Centro de Actividad (Prioridad 2).**
