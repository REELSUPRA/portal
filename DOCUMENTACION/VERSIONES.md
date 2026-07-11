# Versiones

Historial de versiones entregadas o hitos significativos. Para el
detalle de cada cambio individual, ver [CHANGELOG.md](CHANGELOG.md).

## v0.1 — Baseline consolidado (2026-07-11)

Primer estado estable versionado del proyecto.

- Estructura de archivos consolidada (`index.html`, `project.html`,
  `css/`, `js/`, `_redirects`) a partir de dos copias divergentes en
  completitud (no en contenido).
- Verificado sin errores de consola/JS en las vistas principales
  (portal, detalle de proyecto, modo admin).
- Control de versiones inicializado (`git init` + commit baseline).
- Commit: `7e49cc4`.

## v0.2 — Portal del Cliente y Panel Administrador completos según alcance V1

- Agrega los dos módulos que faltaban para cubrir el alcance congelado
  del Portal del Cliente: Bitácora y Mejoras disponibles (Upsells).
- Estructura de documentación (`DOCUMENTACION/`) creada y mantenida
  desde esta versión en adelante.
- Resuelta la decisión de arquitectura sobre "Clientes" en el Panel
  Administrador: un deployment por cliente (ver
  [DECISIONES.md](DECISIONES.md)). Agregado el switch de
  activar/desactivar el aviso superior, único control que faltaba en
  esa sección.
- Con esto, Portal del Cliente y Panel Administrador cubren el 100% del
  alcance definido en [ALCANCE.md](ALCANCE.md) para la V1.
- Pendiente antes de considerarla V1 entregable: datos reales de Juan
  Guzmán (`resources`, `documents`, `links` siguen con placeholders) —
  el cliente/agencia los completa directamente en `js/data.js`.

## Deployment — 2026-07-11

- Repo conectado a GitHub: `https://github.com/REELSUPRA/portal`
  (rama `main`).
- Netlify conectado al repo, deploy automático en cada push.
- **Producción: https://portalreelsupra.netlify.app/**
- Verificado sin errores (portal, detalle de proyecto, `/admin`) contra
  la URL de producción.
