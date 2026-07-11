# Documentación — Portal de Operaciones ReelSupra

Índice de la documentación viva del proyecto. Se actualiza automáticamente
con cada cambio importante (esa es la responsabilidad de Claude en este
proyecto, no del equipo).

| Documento | Para qué sirve |
|---|---|
| [VISION.md](VISION.md) | Qué es este proyecto, para quién, y qué NO es. |
| [ALCANCE.md](ALCANCE.md) | Congelación de alcance de la V1: qué se construye ahora, qué queda para después. |
| [ARQUITECTURA.md](ARQUITECTURA.md) | Cómo está construido técnicamente: estructura de archivos, modelo de datos, patrones. |
| [DECISIONES.md](DECISIONES.md) | Decisiones de arquitectura relevantes y su razonamiento (ADR simplificado). |
| [ROADMAP.md](ROADMAP.md) | Qué falta para la V1 y qué viene después, por área. |
| [VERSIONES.md](VERSIONES.md) | Historial de versiones entregadas. |
| [CHANGELOG.md](CHANGELOG.md) | Registro cronológico detallado de cambios (más granular que VERSIONES). |
| [IDEAS.md](IDEAS.md) | Ideas futuras, fuera del alcance de la V1, sin comprometerse a nada. |
| [BUGS.md](BUGS.md) | Bugs conocidos, abiertos y resueltos. |

## Regla de mantenimiento

Después de cualquier cambio importante (nueva funcionalidad, cambio de
arquitectura, fix de bug, nueva versión entregada), Claude debe:

1. Actualizar el/los documentos afectados.
2. Registrar la entrada correspondiente en `CHANGELOG.md`.
3. Hacer commit de git con mensaje descriptivo, incluyendo el commit de
   la documentación.

No se pide confirmación para este mantenimiento — es parte del trabajo.
