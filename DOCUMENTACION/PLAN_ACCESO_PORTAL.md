# Plan — "Acceso al Portal" (gestión de clientes sin el dashboard de Supabase)

Estado: **infraestructura desplegada; UI simplificada aún más el
2026-07-14 (ver [PLAN_REELSUPRA_OS.md](PLAN_REELSUPRA_OS.md) sección
3 — es la versión vigente de "Acceso al Portal", reemplaza la
descripción de botones de la sección 2 de este documento). Pendiente:
resolver un email de invitación que llegó rechazado (`otp_expired`,
en diagnóstico — ver sección 3) y, recién después, la prueba
end-to-end con un email propio.** El gate real de lectura por cliente
(`06_client_access_gate.sql`) queda **diferido a v1.1**, decisión
explícita — ver sección 4.

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
- **`js/admin.js`**: arriba del todo, un selector que lista todos los
  clientes (`RSStore.listClients()`) y navega con `?client=<slug>` al
  cambiar. Debajo, la sección **"Acceso al portal"** (abierta por
  defecto — es la acción más frecuente) con el estado actual, el email,
  y solo las acciones relevantes según el estado: **un único botón
  "Dar acceso"** cuando el cliente nunca fue invitado o se le revocó el
  acceso (el sistema decide solo si es invitación nueva o restauración
  — el admin no tiene que saber la diferencia); "Reenviar invitación" +
  "Quitar acceso" cuando ya tiene acceso, con "Cambiar email" y
  "Restablecer contraseña" escondidos detrás de un "Más opciones" (uso
  poco frecuente). Ver sección 5 (simplificación del panel, 2026-07-13)
  para el detalle completo de este rediseño. Estas acciones no pasan
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

## 4. El gate real de lectura por cliente — diferido a v1.1 (decisión, 2026-07-13)

`supabase/06_client_access_gate.sql` retira la lectura pública de
`clients`/`projects` y la reemplaza por "el admin ve todo, un cliente
logueado ve solo el suyo". Está escrito y listo, pero **se decidió
explícitamente no activarlo en v1.0**, para priorizar cerrar el
producto simple. Motivos (confirmados con el admin):

1. Con un solo cliente real hoy (Juan Guzmán) y una sola URL de
   portal, el aislamiento real no cambia nada práctico todavía.
2. Activarlo requiere primero construir una pantalla nueva de "no
   tenés acceso / iniciá sesión" en `index.html`/`project.html` — hoy
   no existe; sin ella, un visitante sin sesión caería en el mismo
   fallback que "Supabase está caído" (ve los placeholders de
   `data.js`), que no es el comportamiento correcto una vez activo el
   gate.
3. El cliente real tendría que estar invitado y confirmado con este
   mecanismo antes de poder correr el gate sin dejarlo afuera de su
   propio portal (mismo patrón de seguridad que el cutover del login
   de admin: mecanismo nuevo probado en paralelo, recién después se
   apaga el viejo).

**"Acceso al Portal" (invitar/revocar/reenviar/cambiar email/restablecer
contraseña) queda funcionando igual en v1.0** como gestión de cuentas
— lo único que se pospone es el aislamiento de lectura en sí. Pasa a
ser trabajo de v1.1, junto con la pantalla de "sin acceso". Ver
[DECISIONES.md](DECISIONES.md).

## 5. Panel admin: simplificación de "Acceso al Portal" y del panel completo (2026-07-13)

Con la infraestructura ya funcionando, se revisó el panel completo
como diseño (no como arquitectura) con un objetivo concreto: que dar
acceso a un cliente sea "entrar, elegir el cliente, poner el email,
tocar un botón" — y que el panel siga siendo manejable con muchos
clientes, no solo con uno.

**"Acceso al Portal" — de hasta 4 botones visibles a 1-2:**
- Antes: según el estado, podían aparecer "Dar acceso", "Restaurar
  acceso", "Reenviar invitación", "Restablecer contraseña", "Revocar
  acceso" y "Cambiar email" — hasta 4 al mismo tiempo.
- Ahora: **"Dar acceso" es un solo botón** que cubre tanto la
  invitación nueva como la restauración tras revocar — el sistema
  decide internamente cuál de las dos acciones corresponde
  (`invite` si nunca tuvo cuenta, `grant` si la tiene pero está
  revocada) según si `data.client.portalUserId` ya existe; el admin
  ve siempre el mismo botón con el mismo significado ("dale acceso").
  Cuando ya tiene acceso, se ven "Reenviar invitación" y "Quitar
  acceso"; "Cambiar email" y "Restablecer contraseña" quedan detrás de
  un enlace "Más opciones" (uso poco frecuente, no necesitan estar
  siempre a la vista).

**Panel completo — de una lista larga sin jerarquía a secciones colapsables:**
Se agregó `collapsibleGroup()` (usa `<details>`/`<summary>` nativos,
sin JS de toggle) y se reorganizó `buildPanel()`:
- Selector de cliente: siempre visible, arriba.
- **Acceso al portal**: abierto por defecto (es la acción más
  frecuente al entrar al panel).
- Cliente, Apariencia (Theme Builder), Aviso superior: **colapsados
  por defecto** — se editan una vez y no se vuelven a tocar seguido.
- Un grupo colapsable por proyecto (el primero abierto, el resto
  cerrado) — antes era una lista plana, ahora cada proyecto ocupa una
  línea hasta que lo abrís.

**Limpieza del footer:**
- Se quitó **"Exportar JSON"** (y la función `exportJSON()`): era el
  mecanismo para propagar cambios a otros dispositivos en la era
  pre-Supabase; hoy no cumple ningún rol, cualquier guardado ya
  persiste en Supabase automáticamente.
- **"Aplicar cambios"** se renombró a **"Previsualizar cambios"** y
  bajó de jerarquía visual (de `btn--primary` a `btn--ghost`): no es
  lo mismo que "Guardar cambios" (la barra inferior que persiste en
  Supabase), pero el nombre casi idéntico generaba confusión real.
  Sigue cumpliendo su rol genuino: refrescar el render con ediciones
  de texto que están en memoria pero no se ven todavía en la página
  (el Theme Builder ya se previsualiza solo, sin este botón, llamando
  `RS.applyTheme()` en cada cambio).

Verificado con Playwright contra el proyecto real (localhost, datos
reales de Supabase): sin errores de consola, estructura de acordeón
correcta, "Acceso al portal" mostrando "Reenviar invitación"/"Quitar
acceso" (estado real: `invitado`) con "Más opciones" revelando
"Restablecer contraseña"/"Cambiar email" correctamente.
