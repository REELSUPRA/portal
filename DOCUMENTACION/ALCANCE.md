# Alcance congelado

Última actualización: 2026-07-11.

Este documento congela qué se construye **ahora**. Cambiarlo requiere
una decisión consciente, no un agregado orgánico durante el desarrollo.
Si algo no está en esta lista, no se construye todavía — va a
[IDEAS.md](IDEAS.md) o al roadmap correspondiente.

## V1 — cerrada

La V1 (Portal del Cliente + Panel Administrador simple, para entregar a
Juan Guzmán) está cerrada y en producción. Su alcance queda registrado
abajo tal como se congeló — no se toca retroactivamente.

## V2 — en curso: Panel de administración integral (CMS + Theme Builder)

Evolución consciente de fase, pedida explícitamente el 2026-07-11 bajo
el título "Portal Cliente V2". Amplía deliberadamente lo que "V1
simple" permitía — el objetivo pasa a ser que **casi todo el portal se
administre desde el panel**, sin tocar `data.js`, HTML ni CSS. Ver
[PLAN_V2_CMS.md](PLAN_V2_CMS.md) para el detalle completo y el estado
de cada fase.

Esto **no** reabre lo que sigue prohibido (ver más abajo) — CRM,
Facturación, Métricas, Automatizaciones, IA e integraciones avanzadas
siguen fuera de alcance. La V2 es sobre **cómo se administra** el
portal existente, no sobre agregar esas capacidades de negocio.

## Dentro del alcance — Portal del Cliente

- Bienvenida (mensaje + saludo personalizado)
- Lista de proyectos del cliente
- Estado del proyecto (badge de estado)
- Objetivos del proyecto
- Roadmap / hoja de ruta del proyecto
- Indicador visual de piezas contratadas (ej. 8 videos mensuales) que se
  desbloquean a medida que se entregan — **sin miniaturas**, solo
  indicador numerado/de estado
- Calendario (reuniones + fechas de publicación sugeridas)
- Recursos (links a material de apoyo externo)
- Documentos (links a documentos externos: propuestas, briefs)
- Links rápidos (accesos a herramientas externas: Drive, calendario
  editorial, etc.)
- Próximos pasos
- Material pendiente (lo que falta que envíe el cliente)
- **Bitácora** (registro cronológico de novedades del proyecto)
- **Mejoras disponibles / Upsells** (servicios adicionales ofrecidos al
  cliente, con link de contacto — no checkout, no facturación)

## Dentro del alcance — Panel Administrador

- Gestión de clientes (datos básicos del/los cliente(s))
- Gestión de proyectos (alta, edición de campos, organización)
- Organización general (orden y visibilidad de módulos por proyecto)
- Edición rápida de contenido (piezas de contenido, logo, textos)
- Facilidad de administración por sobre funcionalidad exhaustiva —
  prioridad a que sea rápido de usar para la agencia, no a cubrir
  cada caso posible

## Explícitamente fuera de alcance (por ahora)

No se construyen en la V1, aunque la arquitectura debe quedar preparada
para incorporarlos después sin rehacer lo existente:

- **CRM** (pipeline de ventas, leads, contactos)
- **Facturación** (cobros, invoices, checkout)
- **Métricas / analítica** (dashboards de performance)
- **Automatizaciones** (triggers, workflows)
- **IA** (generación o asistencia automatizada)
- **Integraciones avanzadas** (APIs de terceros más allá de un link)

Cuando se necesite alguna de estas capacidades, la respuesta por
defecto es **enlazar una herramienta externa que ya la resuelve**, no
construirla dentro del portal. Esa es la filosofía "centralizar sin
duplicar" descrita en [VISION.md](VISION.md).

## Multi-cliente: decidido

El Panel Administrador gestiona "Clientes" bajo el modelo **un
deployment = un cliente** (decisión del 2026-07-11, ver
[DECISIONES.md](DECISIONES.md)). No se construye multi-tenancy en la
V1.
