# Changelog

Registro cronológico de cambios, más granular que
[VERSIONES.md](VERSIONES.md). Orden: más reciente arriba.

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
