# Plan — Experiencia Premium del Portal del Cliente

Estado: **Fases 1 y 2 implementadas** (2026-07-11). Fases 3-4 pendientes. Este
documento responde al pedido
de mejora visual/UX profunda sin cambiar la arquitectura de base. Se
actualiza a "implementado" ítem por ítem en [CHANGELOG.md](CHANGELOG.md)
a medida que se construye, no acá.

Regla general aplicada en todo el análisis: **todo lo nuevo se resuelve
extendiendo patrones que ya existen** (registro de bloques, `field()`
genérico del admin, sistema de variables CSS, modales de edición) — no
se introduce ningún subsistema nuevo salvo que se indique explícitamente
como excepción.

---

## 1. Qué ya existe (reutilizable directo)

| Pedido | Ya existe hoy | Dónde |
|---|---|---|
| Logo/icono propio por proyecto (no depender de emoji genérico) | `project.logoUrl` con fallback a `emoji`, y modal de upload (archivo o URL) ya construido | `js/data.js`, `js/admin.js` (`ensureLogoModal`), `js/render.js` (`projectAvatar`) |
| Colores por variable, no hardcodeados en cada regla | Todo el color pasa por variables CSS (`--rs-red`, `--status-*`) — cambiar el acento es cambiar una variable | `css/styles.css` (`:root`) |
| Estados con diferenciación visual (color + texto) | Sistema `statusTone` → `STATUS_LABEL`/`STATUS_CLASS` con badge + punto de color | `js/render.js` |
| Visibilidad de módulos (mostrar/ocultar) | Ya implementado: toggle de ojo por bloque, con `visible: true/false` en `project.blocks` | `js/render.js` (`renderBlocks`), `js/admin.js` (`toggleBlockVisibility`) |
| Reordenar módulos por proyecto | Ya implementado: drag&drop guarda el orden en `project.blocks` | `js/admin.js` (`initBlockDragDrop`, `reorderBlocks`) |
| Notas por fecha/pieza | `contentPieces[].note` y `calendar[].label` ya existen; el editor de piezas (modal) ya permite editar nota, fecha y link | `js/admin.js` (`openPieceEditor`) |
| Bitácora como lista cronológica | Implementada la semana pasada (`blockBitacora`) — hoy es una lista simple, no timeline | `js/render.js` |
| Mejoras disponibles / Upsells | Implementado — lista con título, descripción y CTA | `js/render.js` (`blockUpsells`) |
| % de piezas entregadas (base para barra de progreso) | Ya se calcula: `delivered / pieces.length` dentro de `blockContentPieces` | `js/render.js` |
| Patrón de "timeline visual" (línea + punto + color por estado) | Ya construido para el Roadmap (`.roadmap`, borde izquierdo + dot) — es exactamente el look que se pide para la Bitácora | `css/styles.css` |
| Patrón de tarjeta premium reutilizable | `.project-card` / `.side-card` / `.btn--primary` ya dan look premium consistente | `css/styles.css` |
| Inputs genéricos en el admin (soportan cualquier `type` de `<input>`) | `field()` acepta un parámetro `type` — un selector de color es gratis: `field(label, value, onChange, false, "color")` | `js/admin.js` |

**Conclusión clave:** la base de diseño (variables de color, badges de
estado, tarjetas, modales de edición, registro de bloques) ya cubre el
80% de lo que hace falta para que esto se sienta premium. La mayoría del
trabajo es **extender datos + reutilizar componentes visuales que ya
existen en otro contexto**, no construir de cero.

---

## 2. Qué habría que modificar, por área

### Hero / bienvenida personalizable
- **Modificar:** `renderHero()` para admitir imagen de portada
  (`client.coverImage`) detrás o junto al saludo.
- **Agregar a datos:** `client.coverImage` (igual patrón que
  `logoUrl`: URL o base64 subido).
- **Agregar a admin:** un modal de upload idéntico al de logo de
  proyecto (`ensureLogoModal`), clonado para "portada del cliente".
- **No hace falta:** ningún sistema nuevo de imágenes — es el mismo
  patrón de subida que ya funciona para logos de proyecto.

### Color principal por cliente
- **Modificar:** en vez de que `--rs-red` sea fijo en `styles.css`, se
  setea en runtime desde JS al bootear la página, leyendo
  `client.primaryColor`.
- **Agregar a datos:** `client.primaryColor` (hex).
- **Agregar a admin:** un `field(..., type: "color")` — cero código
  nuevo de UI, el helper ya lo soporta.
- **Riesgo bajo:** es un `document.documentElement.style.setProperty(...)`
  en el `boot()` de `index.html`/`project.html`.

### Logos/iconos por proyecto sin depender de emoji
- **No es código, es dato:** la funcionalidad ya existe
  (`logoUrl`). Lo único que falta es que Juan suba los logos reales de
  JGA Realtor y JGA Closets desde el modal que ya está construido.

### Barra de progreso general
- **Agregar:** una función `progressPercent(project)` que reutiliza el
  mismo cálculo que ya existe en `blockContentPieces`
  (`delivered / total`), expuesta para usarse también en la tarjeta del
  índice y en el hero del detalle.
- **Modificar:** `renderProjectGrid()` (tarjetas del índice) y el hero
  de `renderProjectDetail()` para mostrar una barra (nuevo componente
  visual chico, `.progress-bar`, con el mismo lenguaje de color que los
  badges de estado).
- **Estados nuevos:** agregar tonos que faltan (`planning`,
  `pending-approval`) al diccionario `STATUS_LABEL`/`STATUS_CLASS` ya
  existente — no es una estructura nueva, son más entradas en el mismo
  diccionario.

### Persistencia real del orden de bloques
- **Problema actual:** el orden/visibilidad que se arrastra en modo
  admin vive en memoria + `sessionStorage` solo recuerda si el modo
  admin está prendido — no el orden. Al recargar, se pierde.
- **Modificar:** guardar `project.blocks` en `localStorage` (clave por
  proyecto) cada vez que se reordena/oculta, y leerlo al bootear si
  existe, antes de usar el de `data.js`.
- **Importante — esto no es multi-dispositivo:** `localStorage` persiste
  en el navegador donde se edite, no en un servidor. Si Juan entra desde
  otro dispositivo, ve el orden de `data.js`, no el guardado. Ver
  decisión pendiente en la sección 5.

### Separación admin / cliente
- **Hoy:** "seguridad por oscuridad" (URL/atajo de teclado, sin
  credenciales).
- **Para esta V1, sin cambiar arquitectura:** agregar un gate simple
  (passphrase única en `agency.adminPassphrase`, un `prompt()` o mini
  formulario) antes de activar `RS_ADMIN_MODE`. No es autenticación
  real, es un paso más que la URL mágica — y deja el nombre/estructura
  (`RSAdmin`, `RS_ADMIN_MODE`) ya lista para que el día que haya
  credenciales reales, se reemplace solo esa función de verificación.
- **Lo que NO se construye ahora:** login real, roles, cuentas por
  cliente — eso es multi-tenant, ya señalado como decisión pendiente en
  [DECISIONES.md](DECISIONES.md).

### Bitácora como timeline
- **Modificar:** en vez de reusar `.upcoming-list` (lista plana), la
  Bitácora pasa a reutilizar el CSS de `.roadmap` (línea vertical +
  punto), que ya es visualmente un timeline — solo que cada entrada
  ahora lleva un ícono/color según `type` (ej. `milestone`, `delivery`,
  `material`), igual que ya se hace con los eventos del calendario
  (`type: "reunion" | "publicacion"`).
- **Agregar a datos:** `bitacora[].type` (con un ícono/color mapeado,
  mismo patrón que `ROADMAP_TAG`/`cal-dot--*`).

### Calendario con notas y recomendaciones visibles
- **Hoy:** la nota (`note`) de un evento solo se ve en el `title`
  (tooltip al pasar el mouse) — invisible en mobile, fácil de no ver.
- **Modificar:** click en un día con eventos abre un panel/modal de
  detalle (reutilizando el patrón de modal ya construido para piezas de
  contenido) mostrando label + nota completa, en vez de solo tooltip.
- **Para reuniones (`calendar[]`), hoy sin editor de UI:** si se quiere
  que el admin las edite sin tocar `data.js`, hace falta un editor
  simple análogo a `openPieceEditor` — mismo patrón, nueva instancia.
- **No se necesita:** estructura de datos nueva. `note` ya es texto
  libre; ahí entran horario recomendado, CTA, objetivo, todo junto.

### Links importantes flexibles (botón / tarjeta / link simple)
- **Modificar:** `blockLinks()` para leer un campo `style` por link y
  renderizar 3 variantes, todas con clases que ya existen:
  - `style: "button"` → `.btn.btn--primary` (ya existe)
  - `style: "card"` → variante chica de `.side-card` (ya existe la
    base, se ajusta el padding)
  - `style: "link"` (default) → el `.link-list` actual
- **Agregar a datos:** `links[].style` (opcional, default `"link"` —
  no rompe los links existentes que no lo tengan).

### Material pendiente
- **Cambio mínimo:** re-etiquetar visualmente ("Necesitamos esto de
  vos") y cambiar el ícono de `clock` a algo tipo `pin`/`flag` en
  `blockPending()`. No hay cambio estructural.

### Mejoras disponibles (Upsells)
- **Cambio mínimo:** ajuste visual (borde o fondo sutil tipo
  "oportunidad", no alerta) sobre el componente que ya existe
  (`.upsell-item`). No hay cambio estructural.

---

## 3. Estructura recomendada

### Datos nuevos en `js/data.js` (todos opcionales, con fallback — no
rompen los proyectos existentes si no están):

```
client.coverImage        // igual patrón que project.logoUrl
client.primaryColor      // hex, ej. "#e02020"
agency.adminPassphrase   // string simple, gate liviano del admin

project.statusTone       // + "planning" | "pending-approval" al diccionario

bitacora[].type          // "milestone" | "delivery" | "material" | "note"

links[].style            // "button" | "card" | "link" (default)

calendar[]                // sin cambio de forma, pero pasa a mostrarse
                           // completo en un modal, no solo en tooltip
```

### Componentes visuales nuevos (chicos, todos apoyados en tokens ya
existentes — sin nuevo sistema de diseño):

- `.progress-bar` (barra + porcentaje) — nueva clase, tokens existentes.
- Bitácora migra de `.upcoming-list` a `.roadmap` (reuso, no clase
  nueva salvo el color/ícono por `type`).
- `.link-card` (variante chica de `.side-card`) para links tipo
  "tarjeta".
- Modal de detalle de día de calendario — clona el patrón de
  `piece-modal-overlay` ya existente.

### Infraestructura (una sola función nueva, transversal):

- `applyTheme()` en `render.js`, llamada una vez en cada `boot()`:
  setea `--rs-red` (o se renombra a `--rs-accent` si se quiere
  desacoplar del nombre "red") desde `client.primaryColor` si existe.

### Persistencia (extensión, no cambio de arquitectura):

- `localStorage` para `project.blocks` (orden/visibilidad), scopeado
  por `project.id`. Se sigue pudiendo "Exportar JSON" para pasar el
  estado a `data.js` cuando se quiera hacer permanente de verdad.

---

## 4. Qué haría primero

Orden pensado por **impacto visual inmediato / riesgo de romper algo**,
de menor a mayor riesgo:

1. **Color principal por cliente + `applyTheme()`.** Cambio mínimo,
   máximo impacto: todo el portal se siente "de marca" con una sola
   variable. Además valida el patrón antes de tocar cosas más
   visibles.
2. **Barra de progreso** (tarjetas del índice + hero de proyecto).
   Reutiliza un cálculo que ya existe; es el pedido más directo del
   "dashboard".
3. **Bitácora → timeline** (reusar `.roadmap`, agregar íconos por
   `type`). Alto impacto visual ("el proyecto se siente vivo"), bajo
   riesgo porque es CSS + un mapeo de íconos, no lógica nueva.
4. **Links importantes con 3 estilos.** Cambio contenido a un solo
   bloque, fácil de probar, no afecta el resto.
5. **Persistencia de orden en `localStorage`.** Resuelve una queja
   concreta ("no debe volver al orden original") con poco riesgo,
   pero toca el flujo de admin — se prueba con cuidado.
6. **Hero con imagen de portada.** Clona un patrón ya probado (logo),
   pero conviene hacerlo después de validar `applyTheme()` para que
   ambos convivan bien visualmente.
7. **Calendario con detalle en modal.** Es lo más grande de esta lista
   (nuevo modal + posible editor de reuniones) — última, y a
   evaluar si el editor de reuniones es necesario para la V1 o si
   alcanza con mostrar la nota completa sin editor nuevo.
8. **Gate liviano de admin (passphrase).** ÚltimO a propósito: es
   una mejora de percepción de seguridad, no bloquea nada del resto,
   y conviene decidir el mensaje/flujo con calma.

---

## 5. Decisiones a confirmar antes de programar

Dos puntos tocan supuestos de arquitectura — los señalo en vez de
decidir por mi cuenta, igual que la decisión de "Clientes" del admin:

1. **Persistencia del orden de bloques:** ¿`localStorage` (por
   navegador, sin backend, disponible ya) es suficiente para la V1, o
   se necesita que el orden se vea igual sin importar desde qué
   dispositivo entre el admin? Lo segundo requiere un backend/base de
   datos — cambio de arquitectura real, no se hace ahora salvo que lo
   pidas explícitamente.
2. **Gate de admin:** ¿alcanza una passphrase simple compartida (mejora
   de percepción, no seguridad real) para esta V1, o preferís dejar la
   separación admin/cliente completamente fuera de esta iteración y
   tratarla junto con el tema de multi-cliente más adelante?

Mi recomendación por defecto (si no me decís lo contrario, avanzo así):
`localStorage` para el punto 1, y sí implementar el gate simple del
punto 2 — es barato y mejora mucho la sensación de "esto es serio" sin
tocar arquitectura.

**Decisiones confirmadas (2026-07-11):** `localStorage` para el orden
de bloques (queda en Fase 5, no incluido en Fase 1), y sí — gate simple
de passphrase para el admin. Implementado en Fase 1.

---

## Registro de implementación

### Fase 1 — Personalización premium (2026-07-11) — ✅ implementada

- `client.coverImage` + `client.primaryColor` + `agency.adminPassphrase`
  agregados a `js/data.js`.
- `RS.applyTheme()` (`js/render.js`): pisa `--rs-red` y `--rs-red-dim`
  en runtime desde `client.primaryColor`. Llamado en el `boot()` de
  `index.html` y `project.html`, antes de cualquier render.
- `renderHero()` ahora dibuja `.hero__cover` (banner de portada, 200px,
  bordes redondeados) cuando hay `coverImage`; en modo admin sin
  imagen muestra un placeholder punteado con botón "Portada".
- Modal de logo (`ensureLogoModal`/`openLogoModal`) generalizado a un
  modal de imagen reutilizable (`openImageModal(config)`) — ahora lo
  usan tanto el logo de proyecto como la portada del cliente, mismo
  código, sin duplicación.
- Panel admin: nuevo campo de color (`type: "color"`) para
  `primaryColor`, con preview en vivo (aplica `RS.applyTheme()` al
  tipear, no hace falta "Aplicar cambios").
- **Gate de admin:** `verifyPassphrase()` + `tryActivateAdmin()` en
  `js/admin.js`. Se pide una sola vez por sesión de navegador
  (`sessionStorage.rsAdminAuthed`); si la contraseña es incorrecta o se
  cancela, el modo admin no se activa. Explícitamente documentado como
  disuasivo, no como seguridad real (la contraseña vive en un archivo
  JS público).
- Verificado con Chromium headless: contraseña incorrecta bloquea,
  correcta activa, color se aplica en vivo, portada se sube por URL,
  logo de proyecto (regresión) sigue funcionando. Sin errores de
  consola en ningún caso.
- Logos reales de los proyectos de Juan: **pendiente** — es un dato,
  no código; se sube desde el botón que ya existe sobre el logo/emoji
  de cada proyecto en modo admin.

### Fase 2 — Dashboard visual (2026-07-11) — ✅ implementada

- `contentProgress(project)` (`js/render.js`): cálculo único de
  entregado/total/porcentaje, reutilizado por el bloque "Piezas de
  contenido" (ya existía ahí) y por los dos lugares nuevos — no hay
  tres versiones del mismo número.
- `progressBar(percent, size)`: componente chico reutilizado tal cual
  en la tarjeta del índice (`renderProjectGrid`, tamaño `sm`) y en el
  hero del detalle (`renderProjectDetail`, tamaño `lg`, como
  "Progreso del proyecto"). Color de la barra = variable de acento
  (`--rs-red`), así que también cambia con el color de marca del
  cliente (Fase 1).
- Estados nuevos agregados al diccionario existente
  `STATUS_LABEL`/`STATUS_CLASS` (no una estructura nueva):
  `planning` (🔵 Planificación, color nuevo `--status-planning`) y
  `pending-approval` (🟡 Pendiente aprobación — reutiliza el color
  amber ya existente de `review`, cero CSS nueva para ese caso).
  `active` (🟢 En producción) y `done` (⚪ Finalizado) ya existían.
- Ajuste de layout: el badge de estado salió del footer de la tarjeta
  (antes compartía fila con el botón) para poder apilar
  badge → barra de progreso → botón; `.status-badge` ahora lleva
  `align-self: flex-start` para no estirarse en contenedores flex en
  columna.
- Verificado con Chromium headless en las 5 vistas de regresión: sin
  errores. Confirmado visualmente que el layout de tarjetas y el hero
  no se rompieron.
