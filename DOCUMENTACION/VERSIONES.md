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

## v0.3 — UX Premium (2026-07-11)

Las 4 fases del [plan de UX Premium](PLAN_UX_PREMIUM.md) implementadas
sobre la V1, sin cambiar la arquitectura de base:

- Personalización de marca (portada, color, gate de admin).
- Dashboard visual (barra de progreso, estados con color/ícono).
- Bitácora como timeline visual.
- Links importantes con 3 variantes de presentación.

Pendiente real: datos de producción de Juan (logos, links, recursos) —
contenido, no código. Fase 5 del plan (persistencia en `localStorage`
del orden de bloques) no incluida en este pase.

## v0.4 — Guardado centralizado y persistencia (2026-07-11)

- Barra de guardado inferior, única, que aparece solo con cambios
  pendientes en modo admin.
- Persistencia en `localStorage` vía capa desacoplada (`js/store.js`),
  con interfaz async lista para migrar a un backend real más adelante.
- Aviso de cierre de pestaña con cambios sin guardar.
- Con esto, la "Fase 5" mencionada en el plan de UX Premium queda
  resuelta (y ampliada a todo el admin, no solo el orden de bloques).

## v0.5 — Portal Cliente V2, Fase 1: Theme Builder (2026-07-11)

- Arranca la V2: panel de administración integral (CMS + Theme
  Builder), pedida explícitamente como evolución de fase — ver
  [ALCANCE.md](ALCANCE.md).
- Fase 1 completa: identidad visual completa (11 colores + 8 variables
  de tipografía) configurable desde el panel, generado desde un
  esquema declarativo (`THEME_SCHEMA`) — no hay UI escrita a mano por
  campo. Logo de cliente y favicon dinámico.
- Fases 2 (editor genérico de listas), 3 (accesos rápidos en header) y
  4 (sistema de diseño: radios, sombras, estilos de botón/tarjeta,
  claro/oscuro) quedan pendientes — ver
  [PLAN_V2_CMS.md](PLAN_V2_CMS.md).

## v0.6 — Portal Cliente V2, Fase 2: editor genérico de listas (2026-07-11)

- Roadmap, Bitácora, Calendario, Recursos, Documentos, Material
  pendiente, Próximos pasos y Mejoras disponibles ahora se administran
  por completo desde el panel (crear/editar/eliminar/reordenar), sin
  tocar `data.js`.
- Un solo motor de edición para las 8 listas, dirigido por un esquema
  declarativo — arquitectura preparada para que agregar un bloque de
  lista nuevo no requiera código específico.
- Fases 3 (accesos rápidos en el header) y 4 (sistema de diseño:
  radios, sombras, estilos de botón/tarjeta, claro/oscuro) quedan
  pendientes — ver [PLAN_V2_CMS.md](PLAN_V2_CMS.md).

## v0.7 — Portal Cliente V2, Fase 3: Header Inteligente (2026-07-11)

- Accesos rápidos configurables integrados al encabezado del proyecto
  (reemplazan el bloque de links al final de la página), editables con
  el mismo motor genérico de la Fase 2.
- Resumen de estado (progreso, etapas completadas, material pendiente)
  e indicadores de actividad (última actualización, última entrega,
  próxima reunión) — todos calculados a partir de datos ya existentes
  (Roadmap, Bitácora, Calendario), sin campos manuales nuevos.
- Fase 4 (sistema de diseño: radios, sombras, estilos de botón/tarjeta,
  claro/oscuro) queda pendiente — ver [PLAN_V2_CMS.md](PLAN_V2_CMS.md).

## v0.8 — V3 Portal Vivo, Prioridad 1: Responsive completo (2026-07-12)

- Arranca la V3: convertir el portal en una experiencia "viva", no solo
  informativa — ver [PLAN_V3_PORTAL_VIVO.md](PLAN_V3_PORTAL_VIVO.md).
  Prioridad absoluta antes de seguir: el sitio debía quedar 100%
  responsive, sin ocultar contenido por CSS.
- Los 7 `@media` sueltos e inconsistentes se consolidaron en 2 bloques
  únicos (Tablet/Mobile), auditados componente por componente.
- Dos bugs reales corregidos (no solo estética): imágenes subidas sin
  comprimir podían superar la cuota de `localStorage` y no persistir
  en mobile; un guardado fallido se marcaba como exitoso en la UI. Ver
  [BUGS.md](BUGS.md).
- Objetivos táctiles de ~40px en todo el modo admin, inputs a 16px
  (evita el zoom automático de Safari en iOS), modales a pantalla
  completa en mobile, portada del cliente con prioridad visual
  (sangrado a los bordes) en vez de "comprimida".
- Verificado en Desktop, iPhone SE, iPhone 13, Pixel 7 e iPad — sin
  errores de consola, sin overflow horizontal, sin requests fallidos.
- Pendiente de la V3: Centro de Actividad (Prioridad 2) y Hero
  Inteligente / carrusel reutilizable (Prioridad 3) — ver el plan.

## v0.9 — Migración a Supabase: cutover a producción (2026-07-12)

- `js/store.supabase.js` conectado en `index.html`/`project.html` —
  Supabase (Postgres + Auth + RLS) es la fuente de verdad real desde
  ahora, no `localStorage`. Disparado porque el cliente confirmó que
  sus cambios (logos, portada) no se veían desde otros dispositivos,
  ya que nunca habían salido del `localStorage` de una sola PC.
- Login de admin real (email + contraseña contra Supabase Auth),
  reemplazando la contraseña en texto plano — cutover hecho junto con
  el anterior a propósito, ver [DECISIONES.md](DECISIONES.md).
- Esquema: cáscara relacional (`clients`/`projects`, con RLS) +
  contenido de cada lista como `jsonb` idéntico a `CLIENT_DATA` de
  siempre — cero cambios en `LIST_SCHEMAS`/`BLOCK_DEFS`/Theme Builder.
- Verificado contra el proyecto real (no simulado): lectura pública,
  escritura sin sesión admin rechazada por RLS, portal completo
  cargando en desktop y mobile sin errores.
- **Cerrado (2026-07-12):** el admin confirmó en producción, con sus
  credenciales reales, el ciclo completo — login, editar, guardar,
  recargar en modo cliente, y ver el mismo cambio desde otro
  dispositivo. Los 5 pasos funcionaron. Detalle completo en
  [PLAN_MIGRACION_SUPABASE.md](PLAN_MIGRACION_SUPABASE.md).
- Queda como mejora futura (no bloquea el cierre): subida de imágenes
  a Storage (siguen en base64, funcionando, no migradas todavía).
- Reabrió una decisión que estaba marcada como resuelta: "un cliente
  por deployment" (ver [DECISIONES.md](DECISIONES.md)) — el pedido de
  diseñar pensando en cientos de clientes la puso otra vez en
  discusión; el esquema ya soporta multi-cliente, la decisión de
  producto sigue abierta.

## v0.10 — "Acceso al Portal": gestión de clientes sin el dashboard de Supabase (2026-07-12, en curso)

- Nueva sección "Acceso al portal" en el panel admin (por cliente):
  ver email, invitar, reenviar invitación, restablecer contraseña,
  revocar y restaurar acceso, cambiar email — sin pisar nunca el
  dashboard de Supabase.
- Selector de clientes agregado en el panel (pensado desde ya para
  "cientos de clientes", no solo el actual).
- Arquitectura: Edge Function `manage-client-access` como única pieza
  con la `service_role key` (verifica rol admin antes de usarla);
  columnas aditivas `portal_email`/`portal_user_id`/`portal_access_status`
  en `clients`; `RSStore.listClients/manageAccess/resetPasswordForClient`.
  Detalle y por qué esta arquitectura en
  [PLAN_ACCESO_PORTAL.md](PLAN_ACCESO_PORTAL.md).
- **Actualizado (2026-07-13):** columnas corridas, Edge Function
  desplegada, Site URL de Auth corregido. Panel simplificado: "Dar
  acceso" es un solo botón (antes separado en dar/restaurar), acciones
  poco frecuentes detrás de "Más opciones", y el panel completo pasó a
  secciones colapsables. Decisión explícita: **el gate real de lectura
  por cliente (`06_client_access_gate.sql`) se difiere a v1.1** — v1.0
  cierra con "Acceso al Portal" como gestión de cuentas, sin activar el
  aislamiento de lectura. Ver [PLAN_ACCESO_PORTAL.md](PLAN_ACCESO_PORTAL.md).
- **Evolucionado (2026-07-14) a "ReelSupra OS":** nuevo `dashboard.html`
  (punto de entrada del admin — lista clientes/proyectos, crea
  clientes/proyectos nuevos, gestiona accesos inline; el editor de
  contenido por-cliente no cambió). "Acceso al Portal" simplificado
  aún más: 2 estados puramente visuales (sin acceso → "Crear acceso";
  con acceso → email bloqueado + Editar email/Reenviar acceso/Revocar
  acceso), sin texto técnico ni "Restablecer contraseña" por separado.
  Detalle en [PLAN_REELSUPRA_OS.md](PLAN_REELSUPRA_OS.md).
- **Continuado de forma autónoma (2026-07-14):** imágenes migradas a
  Supabase Storage en código (`RSStore.uploadImage()`, con fallback a
  base64) — bloqueado en producción porque se verificó que los buckets
  de `03_storage.sql` nunca se crearon (hallazgo real, no supuesto).
  Verificación end-to-end completa (`index`/`project`/`dashboard` en 5
  viewports) sin errores. Único bug encontrado y corregido: mensaje de
  error crudo de Postgres al crear un cliente/proyecto con slug
  duplicado.
- **No cerrado todavía (requiere al admin, ver lista de intervenciones
  en el último mensaje de la conversación):** correr `03_storage.sql`,
  y resolver el email de invitación (`otp_expired`) configurando SMTP
  propio (Resend) — sin esos dos pasos, "Crear acceso" y la subida de
  imágenes no quedan 100% cerrados de punta a punta.

## Deployment — 2026-07-11

- Repo conectado a GitHub: `https://github.com/REELSUPRA/portal`
  (rama `main`).
- Netlify conectado al repo, deploy automático en cada push.
- **Producción: https://portalreelsupra.netlify.app/**
- Verificado sin errores (portal, detalle de proyecto, `/admin`) contra
  la URL de producción.
