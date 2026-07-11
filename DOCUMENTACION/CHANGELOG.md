# Changelog

Registro cronológico de cambios, más granular que
[VERSIONES.md](VERSIONES.md). Orden: más reciente arriba.

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
