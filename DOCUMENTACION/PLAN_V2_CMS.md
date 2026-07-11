# Plan — Portal Cliente V2: Panel de administración integral (CMS + Theme Builder)

Estado: **Fases 1 (Theme Builder), 2 (editor genérico de listas) y 3
(Header Inteligente, ampliada) implementadas** (2026-07-11). Fase 4
pendiente — ver registro de implementación al final del documento.
Este documento analiza el
pedido de convertir el modo admin en un panel tipo CMS/SaaS —
identidad visual completa, edición total de contenido sin tocar
`data.js`, accesos rápidos configurables, sistema de diseño por
variables, todo con arquitectura genérica y declarativa.

## Aviso — tensión con el alcance congelado

[ALCANCE.md](ALCANCE.md) dice explícitamente: *"no funcionalidades
complejas"* y frena CRM/Facturación/Métricas/Automatizaciones/IA hasta
nuevo aviso. Un CMS genérico con theme builder, editor de bloques
genérico y editor de listas genérico **es** una funcionalidad compleja
— no en el sentido de "innecesaria", sino en el sentido literal de
"mucha superficie nueva, mucho más código, más difícil de razonar que
el sistema actual". Vos mismo lo llamás "V2" en el título, así que
entiendo que es una evolución de fase consciente, no un pedido puntual
más. Voy a actualizar `ALCANCE.md`/`ROADMAP.md` para reflejar que la
V1 (simple, para Juan) está cerrada y esto abre una V2. Si la intención
era otra, avisame antes de que siga.

## 1. Qué ya existe (reutilizable)

| Pedido V2 | Ya existe hoy | Nota |
|---|---|---|
| Color principal configurable | `client.primaryColor` + `RS.applyTheme()` | Base del Theme Builder — se extiende, no se rehace |
| Todo el color pasa por variables CSS | `:root` en `styles.css` | Ya es "sin reglas CSS duplicadas" para color — falta extenderlo a tipografía/espaciado/radios |
| Editor de imagen reutilizable (logo/portada) | `openImageModal(config)` | Reutilizable para favicon, logo de cliente, logo por proyecto — mismo patrón, más instancias |
| Guardado unificado, detección de cambios, barra inferior, `beforeunload` | `markDirty()` / `.save-bar` / `RSStore` (implementado la sesión pasada) | **El punto 5 del pedido ya está resuelto.** Solo hay que asegurarse de que los editores nuevos llamen `markDirty()`, igual que los actuales. |
| Reordenar/ocultar módulos | `project.blocks` + drag&drop | Ya cubre "reordenar/mostrar-ocultar" a nivel de bloque completo — falta CRUD *dentro* de cada bloque (los items de una lista) |
| Persistencia desacoplada | `js/store.js` (`RSStore`) | No cambia — todo lo nuevo pasa por el mismo `save()`/`hydrate()` |
| Campo de color en el panel (`type: "color"`) | `field(..., "color")` | Reutilizable para los ~10 colores nuevos pedidos |

## 2. Qué es genuinamente nuevo (no hay para reutilizar)

- **Editor genérico de bloques/listas.** Hoy cada bloque tiene su
  propio `blockX(project)` de solo-lectura +, como mucho, un modal
  hecho a mano (piezas de contenido). No existe ningún concepto de
  "definí la forma de tus datos y el editor sale solo". Esto es
  literalmente lo que pide el punto 6 — es un motor nuevo, no una
  extensión.
- **Theme Builder de tipografía/espaciado/radios/sombras.** Hoy solo
  el color es variable en runtime. Fuente, tamaños, pesos, radios,
  sombras, ancho máximo no son variables hoy — hay que promoverlos a
  variables CSS y armar los controles para editarlos.
- **Variantes reales de estilo** (botón relleno/outline/minimal,
  claro/oscuro). Una variable de color no alcanza para esto — son
  reglas CSS alternativas que se activan según una clase/atributo en
  `<html>`, no solo un valor de variable.
- **Accesos rápidos en el header del proyecto.** Hoy los links viven
  en un bloque al final de la página. Moverlos al encabezado es un
  layout nuevo (aunque el dato — nombre/url/icono/color/tipo — es
  igual al que ya usa `blockLinks`).
- **Favicon dinámico.** No existe ningún mecanismo para cambiar
  `<link rel="icon">` en runtime — es chico pero es nuevo.

## 3. Arquitectura propuesta

La pieza central que resuelve el punto 6 ("agregar un bloque nuevo no
debería requerir un sistema nuevo") es un **esquema declarativo por
tipo de dato + dos motores genéricos que lo leen:**

```
// Un esquema describe los campos de UN item de una lista.
const SCHEMAS = {
  roadmapItem: [
    { key: "phase", label: "Fase", type: "text" },
    { key: "detail", label: "Detalle", type: "textarea" },
    { key: "status", label: "Estado", type: "select", options: [...] },
  ],
  bitacoraItem: [
    { key: "date", label: "Fecha", type: "date" },
    { key: "type", label: "Tipo", type: "select", options: [...] },
    { key: "text", label: "Texto", type: "text" },
  ],
  linkItem: [
    { key: "label", label: "Nombre", type: "text" },
    { key: "url", label: "URL", type: "text" },
    { key: "type", label: "Tipo", type: "select", options: [WhatsApp, Drive, ...] },
    { key: "icon", label: "Ícono", type: "icon-picker" },
    { key: "color", label: "Color", type: "color" },
    { key: "style", label: "Estilo", type: "select", options: [button, card, link] },
  ],
  // resources, documents, pendingMaterial (string simple), nextSteps, upsells, calendar...
};
```

Con eso, **un solo componente** `renderListEditor(project, listKey, schema)`
sabe:
- Listar los items actuales con drag para reordenar (reutiliza el
  mismo mecanismo de `initBlockDragDrop`, generalizado).
- Botón "Agregar" que abre un formulario generado desde el esquema
  (reutiliza `field()`/`checkboxField()` — el generador de formulario
  ES básicamente `field()` en loop sobre el esquema, no algo nuevo).
- Editar / eliminar por item, con confirmación simple para eliminar.
- Mostrar/ocultar por item si el tipo de dato lo admite.
- Llama `markDirty()` en cada cambio — automático, no hay que
  acordarse de agregarlo en cada bloque nuevo.

**Agregar un bloque nuevo en el futuro = agregar una entrada a
`SCHEMAS` + una entrada a `BLOCK_DEFS` con `render` de solo lectura.**
Cero UI nueva que programar — exactamente el objetivo del punto 6 y del
punto 2.

Para el Theme Builder, la misma idea aplica con un esquema de
variables:

```
const THEME_SCHEMA = [
  { key: "--rs-red", label: "Color principal", type: "color" },
  { key: "--rs-secondary", label: "Color secundario", type: "color" },
  { key: "--font-sans", label: "Fuente principal", type: "font-picker", options: ["DM Sans", "Inter", "Poppins", "Manrope"] },
  { key: "--text-size-title", label: "Tamaño de título", type: "range", min: 24, max: 56 },
  // ...
];
```
Un único `renderThemeBuilder(THEME_SCHEMA)` genera todos los controles
y aplica cada valor a `document.documentElement.style` — el mecanismo
que ya usa `applyTheme()`, generalizado a N variables en vez de 2.

## 4. Fases propuestas (cada una es un pase completo con verificación,
   docs y commit, como venimos trabajando)

**Fase 1 — Theme Builder de identidad visual**
Colores nuevos (secundario, fondo, tarjeta, botón, textos, bordes,
éxito/advertencia/error) + tipografía (fuente, tamaños, pesos, altura
de línea, espaciado) como variables CSS, con el panel generado desde
`THEME_SCHEMA`. Incluye favicon dinámico y logo de cliente (además del
de portada que ya existe). Riesgo bajo — extiende un patrón que ya
funciona.

**Fase 2 — Editor genérico de listas**
El motor central: `renderListEditor()` + esquemas para roadmap,
bitácora, calendario, material pendiente, próximos pasos, recursos,
documentos, mejoras disponibles. Esta es la fase de mayor riesgo e
impacto — recomiendo hacerla con UN esquema primero (ej. Recursos, el
más simple), validar el patrón end-to-end, y recién ahí replicarlo al
resto en la misma fase.

**Fase 3 — Accesos rápidos en el header**
Reutiliza el editor genérico de la Fase 2 con el esquema `linkItem`
(nombre/url/icono/color/tipo con presets WhatsApp/Drive/Instagram/
YouTube/Facebook/TikTok/Calendario/Personalizado). Reemplaza el bloque
inferior de links por accesos junto a la barra de progreso.

**Fase 4 — Sistema de diseño**
Radios, sombras, separación entre tarjetas, ancho máximo, intensidad de
color: variables nuevas, mismo mecanismo del Theme Builder (Fase 1).
Estilo de botón (relleno/outline/minimal), estilo de tarjeta/header y
claro/oscuro: esto sí son variantes CSS reales, no solo variables —
más trabajo y más superficie para probar. Sugiero dejar claro/oscuro
para el final de esta fase o para una fase propia si el resto ya es
mucho.

**Fase 5 — Guardado unificado**
Ya implementada. Solo verificar que los editores nuevos de las Fases
1-4 disparen `markDirty()` (lo hacen por construcción, si se apoyan en
`field()`/`checkboxField()`/el editor genérico).

## 5. Qué decisión te pido antes de arrancar

No es una duda técnica menor — son dos decisiones reales:

1. **¿Arrancamos por la Fase 1 (Theme Builder, impacto visual
   inmediato) o por la Fase 2 (editor genérico de listas, la pieza más
   importante de arquitectura pero menos "vistosa")?** Fase 2 es la
   que hace que todo lo demás sea más fácil después, pero Fase 1 da
   resultado visible más rápido.
2. **Claro/oscuro (dentro de la Fase 4): ¿es un "debería tener" para
   esta V2, o lo dejamos señalado en IDEAS.md para más adelante?** Es
   la pieza más cara de todo el pedido (duplica efectivamente la hoja
   de estilos) y no la mencionaste como prioridad explícita en el
   texto — la incluiste en la lista de ejemplos de "sistema de
   diseño".

Mi default si no me corregís: empezar por Fase 1 (ROI visual rápido y
bajo riesgo, valida el patrón de esquema antes de construir el motor
más grande de Fase 2), y dejar claro/oscuro señalado para después,
fuera de esta ronda de fases.

**Decisión confirmada (2026-07-11):** arrancar por Fase 1.

---

## Registro de implementación

### Fase 1 — Theme Builder (2026-07-11) — ✅ implementada

- **`THEME_SCHEMA`** (`js/render.js`): 19 variables declarativas
  (11 colores + 8 de tipografía), cada una con `{ group, key, label,
  cssVar, type, default, options?/min?/max? }`. `applyTheme()` las
  recorre una vez y pisa la variable CSS correspondiente — agregar una
  variable de tema nueva no toca esta función.
- **Generador de formulario genérico** (`js/admin.js`:
  `buildThemeBuilder()` + `renderThemeField()`): un dispatcher por
  `type` (`color`/`select`/`font`/`range`) sobre 2 helpers nuevos
  (`selectField()`, `rangeField()`) que siguen el mismo patrón que
  `field()`/`checkboxField()` ya existentes. Cero UI escrita a mano por
  campo — los 19 controles salen del esquema.
- **Reutilización de variables existentes:** "Color de texto
  secundario" y "Color de bordes" no crean variables nuevas — escriben
  directamente sobre `--rs-gray-500`/`--rs-gray-100`, que ya eran la
  fuente única de esos colores en toda la hoja de estilos.
- **Consolidación:** `client.primaryColor` (Fase 1 de UX Premium) se
  migró a `client.theme.primaryColor` — una sola fuente de verdad para
  todo el theming, sin dos campos de color redundantes en el panel.
- **Tipografía:** selector de fuente con preview inmediato (DM Sans,
  Inter, Poppins, Manrope — las 4 precargadas vía Google Fonts en el
  `<head>`, sin inyección de `<link>` en runtime). Tamaño de
  título/subtítulo/texto, peso de título/cuerpo, altura de línea y
  espaciado de títulos (interpretado como letter-spacing — ver nota de
  alcance abajo), todos con slider + valor numérico.
- **Vista previa en vivo:** tarjeta `.theme-preview` dentro del propio
  panel (no atenuada por el overlay), usa las mismas variables reales.
- **Identidad visual adicional:** logo de cliente (topbar, reemplaza el
  punto de marca) y favicon dinámico — mismo modal de imagen genérico
  que ya existía para logo de proyecto/portada, dos usos más del mismo
  componente.
- **Color de error con uso real:** en vez de un campo decorativo sin
  efecto visible, se conectó al toast de "contraseña incorrecta" y al
  de "no se pudo guardar" (`showToast(msg, "error")`).
- **Nota de alcance:** "Espaciado" (pedido bajo Tipografía) se
  interpretó como letter-spacing de títulos — la separación general
  entre tarjetas/secciones queda para la Fase 4 (Sistema de diseño),
  donde el pedido original también la menciona.
- **Sin regresión visual:** todos los valores por defecto del esquema
  coinciden con el diseño anterior a esta fase (verificado
  visualmente); nada cambia hasta que el admin toque un control.
- Verificado con Chromium headless: 19 controles generados
  correctamente (11 color + 3 select + 5 range), cambios de fuente/
  tamaño/color se aplican en vivo, y persisten tras guardar y recargar
  sin modo admin. Regresión completa sin errores.

### Fase 2 — Editor genérico de listas (2026-07-11) — ✅ implementada

Alcance: Roadmap, Bitácora, Calendario, Recursos, Documentos, Material
pendiente, Próximos pasos y Mejoras disponibles (los 8 pedidos
explícitamente — Links importantes queda para la Fase 3, según lo ya
acordado; piezas de contenido sigue con su editor propio).

- **`RS.LIST_SCHEMAS`** (`js/render.js`): esquema declarativo por
  lista — campos, valor por defecto de un item nuevo, y cómo mostrar
  su etiqueta en la vista de lista. Título e ícono se leen de
  `BLOCK_DEFS`, no se duplican.
- **Un solo motor de edición** (`js/admin.js`): un modal
  (`openListEditor`) con dos vistas (lista/formulario), reutilizado sin
  cambios por las 8 listas. El formulario se genera campo por campo
  desde el esquema, reutilizando `field()`/`selectField()` — los mismos
  helpers del Theme Builder, no hubo que escribir un generador nuevo.
- **`primitive: true`** resuelve las listas de strings simples
  (Material pendiente, Próximos pasos) con el mismo motor que las
  listas de objetos, sin una rama de código separada.
- **Reordenar con flechas ↑/↓** en vez de drag&drop dentro del modal —
  más simple de implementar y de usar en un contexto de lista corta
  dentro de un modal (el drag&drop de bloques completos en la página
  sigue igual, no se tocó).
- **Acceso desde el panel:** grilla de botones por proyecto, uno por
  lista, con conteo de elementos (`buildContentListButtons`) — abre el
  editor de esa lista.
- **Arquitectura preparada para el futuro** (pedido explícito de esta
  fase): agregar un bloque de lista nuevo es una entrada en
  `LIST_SCHEMAS` + una en `BLOCK_DEFS` — nada más. No hay lógica
  específica por tipo de bloque en el motor de edición.
- Verificado con Chromium headless contra 3 esquemas representativos
  (Recursos: texto+URL: Roadmap: texto+textarea+select; Bitácora:
  fecha+select+texto) y una lista primitiva (Próximos pasos): agregar,
  editar, reordenar, eliminar, contador actualizado, guardado y
  persistencia tras recargar sin admin — todo sin errores. Regresión
  completa de las 5 vistas también sin errores.

### Fase 3 — Header Inteligente (2026-07-11) — ✅ implementada, alcance ampliado

Ampliada a pedido explícito: no solo accesos rápidos — resumen de
estado (progreso, etapas completadas, material pendiente) e
indicadores de actividad (última actualización, última entrega,
próxima reunión), priorizando valor funcional sobre personalización
visual (radios/sombras/claro-oscuro quedan en Fase 4, sin tocar).

- **Accesos rápidos:** `project.links` dejó de ser un bloque al final
  de la página — se integró como pills de color en el encabezado.
  Esquema (`LIST_SCHEMAS.links`) rediseñado: `type` (8 presets con
  ícono+color) + `icon`/`color` opcionales que anulan al preset. Se
  sigue editando con el mismo motor genérico de la Fase 2 — sin
  cambios en el editor, solo en la forma del dato.
  `BLOCK_DEFS.links` se mantiene (título/ícono para el editor) pero
  ya no forma parte de `defaultBlockOrder()` — no se dibuja como card.
- **Resumen y actividad — decisión de diseño clave: todo derivado, sin
  campos manuales nuevos.** Etapas completadas cuenta
  `roadmap.filter(status === "done")`; última actualización/entrega
  leen la Bitácora; próxima reunión lee el Calendario. Los tres ya son
  editables desde el editor genérico de la Fase 2 — no hizo falta
  agregar ninguna UI de edición nueva para el resumen/actividad, se
  mantienen sincronizados automáticamente porque no existen como datos
  separados.
- Progreso general (ya existente) se consolidó dentro del mismo bloque
  visual (`.smart-header`) en vez de vivir aparte, evitando dos
  secciones de "estado del proyecto" en el hero.
- **Migración de datos:** `links[].style`/`links[].icon` (formato de
  la Fase 4 de UX Premium) se reemplazó por `links[].type` en
  `data.js` — no había datos de producción reales todavía (siguen
  siendo placeholders), así que se migró directo sin capa de
  compatibilidad.
- Verificado con Chromium headless: pills se renderizan con el color
  del preset, resumen y actividad muestran los valores correctos
  derivados de los datos de ejemplo (confirmado "hace 1 día" para la
  bitácora del 10 de julio con fecha de hoy 11 de julio), el bloque
  viejo de links ya no aparece en la página, y agregar un acceso nuevo
  (Instagram) desde el editor genérico se refleja en el header sin
  recargar. Regresión completa sin errores.
