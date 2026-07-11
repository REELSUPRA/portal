# Changelog

Registro cronológico de cambios, más granular que
[VERSIONES.md](VERSIONES.md). Orden: más reciente arriba.

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
