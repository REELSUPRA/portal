# CLAUDE.md — ReelSupra OS / Portal Cliente

Este archivo documenta el contexto real del proyecto para cualquier
sesión futura de Claude Code. Está escrito a partir de una auditoría
del repositorio (código + `DOCUMENTACION/`), no es aspiracional: si
algo dice "pendiente", es porque todavía no está hecho.

Documentación detallada y con historial completo de decisiones vive en
`DOCUMENTACION/` — este archivo es el resumen orientador, no el
reemplazo de esos documentos. Empezar siempre por acá, profundizar ahí
si hace falta.

## 1. Contexto del proyecto

**ReelSupra OS** es la capa interna de administración de ReelSupra
(agencia de contenido) para gestionar a sus clientes y los portales
que cada uno ve. Nació como "Portal del Cliente" (un sitio estático
por cliente) y evolucionó hacia un sistema con un único deployment que
sirve a **múltiples clientes**, cada uno con su propio portal, más un
**Dashboard** para que el admin los administre a todos sin tocar SQL
ni el dashboard de Supabase.

**Objetivo:** que ReelSupra centralice en un solo lugar (sin duplicar
herramientas externas) el estado de cada proyecto de contenido, y que
dar/quitar acceso a un cliente nuevo sea una acción de un click desde
un panel propio — nunca una tarea manual en Supabase.

**Usuarios del sistema:**
- **Admin** (hoy: una sola persona, Alejandro/Ale) — entra por
  `dashboard.html`, ve todos los clientes/proyectos, crea clientes y
  proyectos nuevos, gestiona el acceso de cada cliente, y desde ahí
  entra al editor de contenido de un cliente puntual.
- **Cliente** (`role: client` en `profiles`) — solo ve su propio
  portal (`index.html?client=<slug>` / `project.html`), sin ninguna
  opción administrativa visible. No hay auto-registro: la cuenta la
  crea el admin desde "Acceso al Portal".

No hay más roles todavía (confirmado explícitamente: un solo admin,
sin roles múltiples — ver `DOCUMENTACION/PLAN_REELSUPRA_OS.md` sección
7).

## 2. Stack técnico real

- **Frontend:** HTML/CSS/JS planos, **sin framework y sin build
  step** (sin bundler, sin transpilación, sin `package.json` de
  dependencias de runtime). Todo el HTML dinámico se genera con
  template strings + `innerHTML` (sanitizado con `esc()`). Iconos vía
  Lucide por CDN. Tipografía Google Fonts por CDN.
- **Supabase** como backend completo:
  - **Base de datos:** Postgres. Tablas: `agency_settings` (fila
    única, config global de la agencia), `clients`, `projects`,
    `profiles` (mapea un usuario de Auth a un rol). El contenido de
    cada lista editable del portal (roadmap, bitácora, calendario,
    recursos, documentos, etc.) se guarda como columnas `jsonb` con la
    misma forma que el objeto `CLIENT_DATA` histórico — "cáscara
    relacional + contenido jsonb", ver `supabase/01_schema.sql`.
  - **Auth:** Supabase Auth (email + contraseña). No hay
    auto-registro público — las cuentas de cliente las crea el admin
    vía Auth Admin API, por dos vías: `inviteUserByEmail` (manda un
    email real, requiere SMTP funcionando) o `createUser` con
    contraseña temporal definida a mano (sin email, acción
    `create_manual`, agregada 2026-07-15 porque depender del email
    para cada cliente nuevo consumía demasiado tiempo de debugging de
    SMTP). `profiles.role` (`admin`/`client`) es la fuente de verdad
    de permisos, tanto en RLS como en el frontend.
  - **Storage:** 4 buckets (`logos`, `covers`, `documents`, `media`),
    lectura pública / escritura solo-admin vía RLS sobre
    `storage.objects`. Con fallback automático a base64 si el upload
    falla (`RSStore.uploadImage()` en `js/store.supabase.js`,
    consumido desde `js/admin.js`).
  - **Edge Functions:** `manage-client-access` (Deno) — única pieza
    del proyecto que tiene la `service_role key`. Verifica que quien
    llama es admin (con un cliente scoped al JWT del caller) antes de
    usar el cliente con privilegios. Acciones: `invite` (email),
    `create_manual` (cuenta + contraseña, sin email), `resend`,
    `grant`, `revoke`, `change_email`, `set_password` (cambia la
    contraseña de una cuenta que ya existe, sin recrearla).
- **Hosting:** Netlify, deploy automático en cada push a `main`, sin
  build command, publish directory = raíz. Producción:
  **https://portalreelsupra.netlify.app/**. Redirect propio en
  `_redirects` (`/admin` → `/index.html?admin=true`).
- **Servicios externos:** **Resend** como proveedor SMTP de Supabase
  Auth (dominio propio `reelsupra.com` verificado con DKIM/SPF) —
  reemplaza al mailer compartido por defecto de Supabase, que tiene
  límite de 2 emails/hora y no sirve para producción.

## 3. Arquitectura

```
Dashboard ReelSupra (dashboard.html + js/dashboard.js)
  — login admin real (Supabase Auth + profiles.role='admin')
  — lista todos los clientes y proyectos (RSStore.listClients/listProjectsLight)
  — crea clientes/proyectos nuevos (RSStore.createClient/createProject)
  — gestiona "Acceso al Portal" inline (mismo componente que el panel por-cliente)
  — "Entrar" a un cliente → index.html?client=<slug>&admin=true

Portal Cliente (index.html + project.html, sin cambios de fondo por el Dashboard)
  — vista pública de UN cliente (?client=<slug>)
  — modo admin embebido (?admin=true / Ctrl+Shift+A / ruta /admin):
      Theme Builder, editor de listas, drag&drop de bloques, "Acceso al Portal"
  — modo cliente (usuario logueado con role=client): ve su portal, SIN botón Admin
```

**Flujo admin:** login en `dashboard.html` (o directamente en
`index.html?admin=true` de un cliente) → `RSStore.signIn()` contra
Supabase Auth → `RSStore.isCurrentUserAdmin()` confirma
`profiles.role==='admin'` antes de activar cualquier UI de admin (ver
sección 6, es un bug ya corregido que antes solo miraba "¿hay
sesión?"). Con eso: crear/editar clientes y proyectos, gestionar
accesos, editar contenido (Theme Builder, bloques, listas).

**Flujo cliente:** por dos vías posibles — (a) recibe una invitación
por email (Resend), clic en el link, establece contraseña; o (b) el
admin le crea la cuenta manualmente en el panel (email + contraseña
temporal, sin email de por medio) y se la pasa por otro canal
(WhatsApp, etc.). En ambos casos, el login es el mismo modal genérico
("Iniciar sesión", reutilizado del botón del topbar): si la cuenta es
`role=client`, entra directo a `index.html?client=<su-slug>`
(`RSStore.getCurrentUserAccess()` resuelve el slug) — **sin ninguna
opción administrativa visible** (botón Admin oculto, solo ve "Cerrar
sesión").

**Relación Admin → Clientes → Proyectos → Portal:**
- Un admin administra **N clientes** (tabla `clients`, no "un
  deployment por cliente" — ese modelo antiguo quedó superado por el
  Dashboard, aunque algún documento viejo en `DOCUMENTACION/` todavía
  lo mencione).
- Un cliente tiene **N proyectos** (tabla `projects`, FK a
  `clients.id`).
- Un cliente tiene **como máximo una cuenta de portal**
  (`clients.portal_user_id` → `auth.users`/`profiles`), que ve
  únicamente los proyectos de ese cliente.
- El **Portal** (`index.html`/`project.html`) es la vista pública de
  un cliente puntual; hoy la lectura de `clients`/`projects` es
  pública (sin gate real todavía, ver sección 4).

## 4. Estado actual

**Terminado y verificado en producción:**
- Portal del Cliente completo (todos los módulos del alcance v1:
  bienvenida, proyectos, objetivos, roadmap, calendario, recursos,
  documentos, links, próximos pasos, material pendiente, bitácora,
  upsells) + Theme Builder + editor genérico de listas.
- Persistencia en Supabase (Postgres + RLS), reemplazando
  `localStorage` por completo para `index.html`/`project.html`.
- Login de admin real contra Supabase Auth (ya no hay contraseña en
  texto plano ni gate salteable desde la consola).
- Dashboard ReelSupra (`dashboard.html`): lista clientes/proyectos,
  crea clientes/proyectos nuevos, gestiona accesos inline.
- "Acceso al Portal" simplificado a 2 estados visuales base ("Crear
  acceso", pidiendo contraseña si la cuenta es nueva / "Editar email ·
  Restablecer contraseña · Reenviar acceso · Revocar acceso"), sin
  texto técnico, vía la Edge Function `manage-client-access`.
- Imágenes migradas a Supabase Storage (con fallback a base64 si el
  upload falla) — 4 buckets verificados contra el proyecto real.
- **Flujo de invitación por email cerrado de punta a punta
  (2026-07-15):** Crear acceso → email real vía Resend → cliente crea
  contraseña → login → ve su portal. Verificado con datos reales
  (`auth.users`, `clients.portal_access_status`), no solo "llegó el
  email".
- **Creación manual de acceso (2026-07-15, reemplaza la dependencia
  del email para clientes nuevos):** el admin define email +
  contraseña temporal directo en el panel (botón "Generar" incluido),
  sin mandar ningún email — acción `create_manual`. El flujo de
  invitación por email sigue disponible, no se retiró.
- **Restablecer contraseña (2026-07-15):** para un cliente que ya
  tiene cuenta, el admin puede asignarle una contraseña nueva sin
  borrar/recrear la cuenta (acción `set_password`).
- **Botón "Cerrar sesión" visible (2026-07-15)** en el topbar de
  `index.html`/`project.html`, para cualquier sesión activa (admin o
  cliente) — antes la única forma de salir era el atajo de teclado o
  el "Salir" del Dashboard, que un cliente logueado nunca ve.
- Bug real corregido: el modo admin del frontend ahora verifica
  `profiles.role==='admin'`, no solo "hay una sesión" — antes, una
  sesión de cliente guardada en el mismo navegador podía activar
  visualmente el panel admin (el backend igual rechazaba todo por
  RLS, pero la UI no lo reflejaba).
- Botón "Admin"/"Iniciar sesión" del topbar (mismo botón, label según
  estado) oculto para sesiones de cliente logueadas (sigue visible
  para admins reales y visitantes anónimos, que necesitan poder
  loguearse).
- Overlay de carga inicial (`#portalLoading`) en `index.html`/
  `project.html`, para no dejar la pantalla en blanco mientras
  `boot()` resuelve sesión + datos.

**Pendiente para v1.1 (decisión explícita, no descuido):**
- **Gate real de lectura por cliente**
  (`supabase/06_client_access_gate.sql`, ya escrito pero no aplicado):
  hoy `clients`/`projects` se leen públicamente sin RLS de
  aislamiento — cualquiera con el slug puede ver el portal de un
  cliente. Diferido porque con pocos clientes reales no aporta nada
  práctico todavía y requiere construir un estado "sin acceso" en el
  frontend que hoy no existe.
- Revisión visual manual en dispositivo físico real (hay `@media`
  consolidados y probados con Chromium/Playwright en varios
  viewports, pero no hay confirmación en un dispositivo físico).
- Datos reales de producción pendientes de completar por la agencia
  en algunos campos de recursos/documentos/links para clientes nuevos
  (contenido, no código).

**No planificado para v1.0/v1.1 (fuera de alcance, ver
`DOCUMENTACION/ALCANCE.md`):** CRM, facturación, métricas/analítica,
automatizaciones, IA, integraciones avanzadas, roles múltiples más
allá de admin/client, mover proyectos entre clientes.

## 5. Estructura del repositorio

```
index.html                          Portal del cliente (bienvenida + proyectos)
project.html                        Detalle de un proyecto
dashboard.html                      Dashboard ReelSupra (entrada del admin)
_redirects                          Redirect de Netlify: /admin
css/styles.css                      Design system completo (única hoja de estilos)
js/
  data.js                           Seed/fallback si Supabase no responde (NO es
                                    la fuente de verdad; dashboard.html no lo usa)
  store.js                          Capa de persistencia legacy (localStorage) —
                                    referencia de rollback, no se usa en runtime
  store.supabase.js                 RSStore — ÚNICA capa que habla con Supabase
                                    (datos + Auth + Storage). admin.js/render.js/
                                    dashboard.js nunca llaman a Supabase directo.
  render.js                         Motor de renderizado (RS) — lee CLIENT_DATA,
                                    dibuja. BLOCK_DEFS/THEME_SCHEMA/LIST_SCHEMAS.
  admin.js                          Modo administrador: login, panel lateral,
                                    Theme Builder, editor de listas, drag&drop,
                                    "Acceso al Portal" (buildPortalAccessSection,
                                    reutilizado por dashboard.js vía window.RSAdmin)
  dashboard.js                      Lógica de dashboard.html — reutiliza RSStore/
                                    RS/RSAdmin, no reimplementa login ni accesos
supabase/
  01_schema.sql                     Tablas: agency_settings, clients, projects, profiles
  02_policies.sql                   RLS — incluye is_admin() y policies de insert
  03_storage.sql                    Buckets + policies de Storage (idempotente)
  04_seed_from_data_js.sql          Carga inicial de datos desde data.js (opcional)
  05_client_access_columns.sql      Columnas portal_email/portal_user_id/portal_access_status
  06_client_access_gate.sql         Gate real de lectura por cliente — escrito,
                                    NO aplicado todavía (diferido a v1.1)
  functions/manage-client-access/   Edge Function — única pieza con service_role key
DOCUMENTACION/                      Historial completo: VISION, ALCANCE, ARQUITECTURA,
                                    DECISIONES, ROADMAP, VERSIONES, CHANGELOG, BUGS,
                                    IDEAS, y los PLAN_*.md de cada iniciativa grande
```

**Convenciones del código:**
- Sin build step: los `<script src="...">` en el HTML son el único
  mecanismo de dependencias. El orden de carga importa (`data.js` →
  supabase-js CDN → `store.supabase.js` → `render.js` → `admin.js` →
  script inline de `boot()`).
- Cada módulo es un IIFE que expone un único global (`RSStore`, `RS`,
  `RSAdmin`) — nunca se llama a Supabase fuera de `store.supabase.js`.
- Patrón declarativo repetido a propósito: `BLOCK_DEFS` (módulos del
  portal), `THEME_SCHEMA` (Theme Builder), `LIST_SCHEMAS` (editor
  genérico de listas). Agregar algo nuevo de ese tipo es agregar una
  entrada al esquema correspondiente, no escribir UI a mano.
- `esc()` sanitiza todo texto insertado por `innerHTML`.

## 6. Decisiones técnicas importantes

- **Supabase como backend completo** (Postgres + Auth + Storage + Edge
  Functions), reemplazando `localStorage` — disparado porque los
  cambios del admin no se veían desde otros dispositivos. Ver
  `DOCUMENTACION/PLAN_MIGRACION_SUPABASE.md`.
- **Resend como SMTP de Supabase Auth**, con dominio propio verificado
  — el mailer compartido de Supabase (2 emails/hora) no alcanza para
  producción. Nota real: un SMTP mal configurado (API key inválida)
  puede fallar en silencio desde la UI (el error real vive en los
  logs de Auth, `auth_logs`, como un 535 de autenticación) — si un
  email de invitación no llega, revisar ahí antes de asumir un bug de
  código.
- **Roles admin/client vía `profiles.role`**, verificado tanto en RLS
  (Postgres) como en el frontend (`RSStore.isCurrentUserAdmin()`). Las
  dos verificaciones son necesarias: RLS protege los datos pase lo que
  pase; el frontend decide qué UI mostrar. Un bug real (corregido)
  fue confundir "hay sesión" con "es admin" en el frontend.
- **Edge Function como único punto con `service_role key`** — cualquier
  acción privilegiada (crear/invitar/revocar acceso de un cliente) pasa
  por `manage-client-access`, que re-verifica el rol del caller antes
  de usar privilegios. La clave nunca llega al navegador.
- **Storage con fallback a base64** — si el upload a Supabase Storage
  falla (RLS, red), el admin no se queda bloqueado: la imagen se
  guarda igual como base64, con un aviso, en vez de romper el flujo.
- **Dashboard como superficie nueva, no como reescritura** — el editor
  de contenido por-cliente (Theme Builder, bloques, listas) no se
  tocó al construir `dashboard.html`; el Dashboard solo resuelve "a
  quién quiero administrar", nunca "cómo se administra".
- **Gate real de lectura por cliente diferido a v1.1**, decisión
  explícita — no aporta nada práctico con pocos clientes reales y
  requiere un estado "sin acceso" en el frontend que no existe hoy.
- **Creación manual de cuenta como alternativa al email, no como
  reemplazo** — el email de invitación depende de un servicio externo
  (SMTP/deliverability) que consumía tiempo real de debugging en cada
  cliente nuevo; se agregó `create_manual` (contraseña definida por el
  admin, sin email) sin tocar ni retirar el flujo de invitación
  existente. Mismo criterio para `set_password`: cambia la contraseña
  de una cuenta ya creada sin borrarla/recrearla.
- **Login genérico, no separado por rol** — el mismo modal
  ("Iniciar sesión") sirve para admin y cliente; antes cualquier login
  que no fuera de un admin se cerraba a la fuerza, lo cual no tenía
  sentido una vez que se puede crear una cuenta de cliente sin email
  (esa cuenta necesita alguna forma de loguearse). Ahora
  `RSStore.getCurrentUserAccess()` decide destino: admin → panel;
  cliente → su portal (`index.html?client=<slug>`).

## 7. Convenciones para trabajar con Claude Code

- **Leer este archivo (y `DOCUMENTACION/` si hace falta más detalle)
  antes de modificar cualquier cosa** — la mayoría de las decisiones
  "raras" a primera vista (fallback a base64, Edge Function separada,
  2 estados en vez de 4 en "Acceso al Portal", gate diferido a v1.1)
  ya fueron discutidas y decididas explícitamente; no son descuidos.
- **No cambiar arquitectura sin aprobación explícita** — en particular:
  no reescribir el motor declarativo (`BLOCK_DEFS`/`THEME_SCHEMA`/
  `LIST_SCHEMAS`), no mover la `service_role key` fuera de la Edge
  Function, no activar `06_client_access_gate.sql` sin construir antes
  el estado "sin acceso" del frontend.
- **Priorizar soluciones simples** — este proyecto no tiene build step
  ni framework a propósito; no introducir uno para resolver un
  problema puntual. Reutilizar componentes/patrones existentes antes
  de crear uno nuevo.
- **Ante un bug que "parece" de infraestructura (SMTP, red, RLS):
  verificar con logs reales antes de asumir la causa** — este
  proyecto tuvo dos casos reales donde la causa asumida inicialmente
  era incorrecta (ver `DOCUMENTACION/PLAN_ACCESO_PORTAL.md` secciones
  6 y 7).
- **Hacer commits claros**, un cambio lógico por commit, sin mezclar
  refactors con features.
- **Probar antes de cerrar cambios** — mínimo: `node --check` en los
  `.js` tocados, y una verificación funcional real (Playwright headless
  contra un server estático local, o el propio admin probando en
  producción) antes de reportar algo como terminado. No marcar un
  flujo como "funciona" solo porque el código "debería" andar.
