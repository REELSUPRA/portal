# Changelog

Registro cronológico de cambios, más granular que
[VERSIONES.md](VERSIONES.md). Orden: más reciente arriba.

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
