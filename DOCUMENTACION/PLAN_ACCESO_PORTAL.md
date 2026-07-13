# Plan — "Acceso al Portal" (gestión de clientes sin el dashboard de Supabase)

Estado: **implementado en código (2026-07-12), pendiente de 2 pasos
manuales del admin (correr un SQL aditivo + desplegar la Edge
Function) y de la prueba end-to-end con un email propio.** El gate
real de lectura por cliente (`06_client_access_gate.sql`) sigue **sin
activar** — ver sección 4.

## 1. Por qué esta arquitectura

Objetivo pedido: administrar el acceso de los clientes al portal
(invitar, revocar, reenviar, restablecer contraseña, cambiar email)
100% desde el panel admin propio, sin entrar nunca al dashboard de
Supabase.

Las acciones privilegiadas (crear una cuenta e invitarla por email,
cambiarle el email a otro usuario) solo existen en la **Auth Admin
API** de Supabase, que requiere la `service_role key`. Esa clave
**nunca puede vivir en el navegador** (cualquiera con acceso a las
devtools la vería y tendría control total sobre la base). La única
forma de exponer esas acciones a un panel que corre en el navegador,
sin exponer la clave, es un backend intermedio — en este proyecto
(sin servidor propio) eso es una **Supabase Edge Function**: corre en
el servidor de Supabase, ahí sí puede tener la `service_role key` como
variable de entorno, y el panel le pega un request normal.

Una sola excepción: **restablecer contraseña** (`resetPasswordForEmail`)
es un método público de Supabase Auth — no necesita `service_role key`
ni pasar por la Edge Function, se llama directo con la publishable key.

Elegido y confirmado con el admin antes de implementar (ver
`AskUserQuestion` en la sesión):

- El acceso al portal es un **gate real** (requiere login), no solo
  gestión de cuentas sin efecto — justifica retirar la lectura pública
  el día que el cutover esté probado (sección 4).
- Se incluye ahora un **selector de clientes** en el panel (no se
  posterga), porque la feature ya asume "cientos de clientes".

## 2. Qué se implementó

- **`supabase/05_client_access_columns.sql`** (aditivo, seguro de
  correr ya): agrega `portal_email`, `portal_user_id`,
  `portal_access_status` (`sin_invitar` / `invitado` / `revocado`) a
  `clients`. No toca RLS ni lectura pública.
- **`supabase/functions/manage-client-access/index.ts`**: Edge
  Function (Deno). Verifica primero que quien llama es admin
  (`profiles.role`, con un cliente scoped al JWT del caller — nunca
  confía en "solo el panel la invoca"), y solo entonces usa un segundo
  cliente con la `service_role key` para las acciones:
  `invite` / `resend` / `grant` / `revoke` / `change_email`.
  `revoke` borra el vínculo en `profiles` pero conserva
  `portal_user_id`, así `grant` puede restaurar el acceso después sin
  mandar una invitación nueva (la cuenta ya existe).
- **`js/store.supabase.js`**: `rowToClient()` ahora expone
  `portalEmail`/`portalUserId`/`portalAccessStatus`/`_slug`; métodos
  nuevos `listClients()`, `manageAccess(action, clientId, email)`,
  `resetPasswordForClient(email)`.
- **`js/admin.js`**: en el panel, antes del grupo "Cliente", un
  selector que lista todos los clientes (`RSStore.listClients()`) y
  navega con `?client=<slug>` al cambiar. Después del logo/favicon, una
  sección **"Acceso al portal"** con el estado actual, un campo de
  email, y botones contextuales según el estado
  (Dar acceso / Reenviar invitación / Restablecer contraseña / Revocar
  acceso / Restaurar acceso / Cambiar email). Estas acciones no pasan
  por `markDirty()`/`saveChanges()` — quedan confirmadas apenas la
  Edge Function (o Auth) responde `ok:true`, no dependen de "Guardar
  cambios".
- **`supabase/06_client_access_gate.sql`**: preparado, **sin correr**
  (ver sección 4).

## 3. Checklist de cutover de esta fase

1. ✅ **Corrido (2026-07-12):** `supabase/05_client_access_columns.sql`
   en el SQL Editor.
2. ✅ **Desplegado (2026-07-12), vía CLI:** `npx supabase functions
   deploy manage-client-access --project-ref oilfbkzzussozisjmemw`,
   autenticado con un Personal Access Token generado solo para este
   despliegue y revocado apenas terminó. Confirmado con `functions
   list` (`status: ACTIVE`) y con un `POST` real sin `Authorization` →
   `401` (rechaza correctamente lo no autenticado).
3. ✅ **Site URL corregido (2026-07-12), vía Management API:** estaba
   en el valor por defecto `http://localhost:3000` (los links de
   invitación/restablecimiento habrían apuntado ahí). Actualizado a
   `https://portalreelsupra.netlify.app`, con
   `https://portalreelsupra.netlify.app/**` en la lista de redirects
   permitidos.
4. ⏳ **Pendiente — necesita al admin, no lo puedo hacer yo:** probar
   el flujo completo desde el panel con un email propio (nunca de un
   cliente real): Dar acceso → revisar la casilla → confirmar la
   invitación → loguearse con la cuenta nueva → y desde el panel
   probar también Reenviar invitación, Cambiar email, Revocar acceso y
   Restaurar acceso. No puedo ejecutar esta parte yo mismo porque
   requiere estar logueado como admin en el navegador con la
   contraseña real — a diferencia del Personal Access Token temporal
   de los pasos 2-3, esa es la cuenta real del admin y no correspondía
   pedirla.

## 4. El gate real de lectura por cliente — todavía NO activado

`supabase/06_client_access_gate.sql` retira la lectura pública de
`clients`/`projects` y la reemplaza por "el admin ve todo, un cliente
logueado ve solo el suyo". Está escrito y listo, pero **no se corre
como parte de este cambio** porque antes hacen falta dos cosas:

1. El cliente real (Juan Guzmán, hoy sin cuenta) tiene que estar
   invitado de verdad con este mecanismo nuevo y haber confirmado que
   puede loguearse — mismo patrón de seguridad que se usó para el
   cutover del login de admin: primero el mecanismo nuevo probado en
   paralelo, recién después se apaga el viejo.
2. El frontend necesita un estado nuevo, todavía no construido: "no
   tenés acceso / iniciá sesión" para cuando `load()` no encuentra
   ninguna fila porque el visitante no está invitado. Hoy ese caso cae
   en el mismo fallback que "Supabase está caído" (muestra los
   placeholders de `data.js`), que deja de ser el comportamiento
   correcto una vez que el gate esté activo.

Correr `06_client_access_gate.sql` antes de esos dos puntos deja a
Juan Guzmán sin poder ver su propio portal. Queda pendiente como
trabajo aparte, explícitamente fuera del alcance de este bloque.
