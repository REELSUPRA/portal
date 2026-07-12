-- ============================================================
-- REELSUPRA — GATE REAL DE ACCESO POR CLIENTE
-- ============================================================
-- ⚠️ NO EJECUTAR TODAVÍA. Este archivo queda preparado, no corrido.
--
-- Qué hace: retira la lectura PÚBLICA de clients/projects y la
-- reemplaza por "el admin ve todo, un cliente logueado ve solo el
-- suyo". Antes de correr esto:
--
--   1. El cliente real (hoy: Juan Guzmán) tiene que estar invitado
--      de verdad (usar "Acceso al Portal" en el panel admin) y haber
--      confirmado que puede loguearse — igual que se hizo con el
--      cutover del login de admin: primero se prueba con el mecanismo
--      nuevo funcionando en paralelo, recién después se apaga el
--      mecanismo viejo (en este caso, el acceso público por link).
--   2. El frontend necesita un estado nuevo, todavía no construido:
--      "no tenés acceso / iniciá sesión" para cuando load() no
--      encuentra ninguna fila (porque el visitante no está invitado)
--      — hoy ese caso cae en el mismo fallback que "Supabase está
--      caído" (muestra los datos de ejemplo de data.js), lo que NO
--      es lo que se quiere una vez que el gate esté activo. Es un
--      cambio de código chico pero real, pendiente, ver
--      PLAN_ACCESO_PORTAL.md.
--
-- Correrlo antes de esos dos puntos deja a Juan Guzmán (el único
-- cliente real hoy) sin poder ver su propio portal — por eso está
-- separado de 05_client_access_columns.sql (que sí es seguro de
-- correr ya) y no se ejecuta como parte de este cambio.
-- ============================================================

drop policy if exists "clients: lectura pública" on clients;
drop policy if exists "projects: lectura pública" on projects;

-- El admin sigue viendo/editando todo — antes esto lo cubría la
-- policy pública (using(true) también dejaba pasar al admin); al
-- retirarla, hace falta esta explícita o el panel admin se rompe.
create policy "clients: admin lee todo" on clients
  for select using (is_admin());
create policy "projects: admin lee todo" on projects
  for select using (is_admin());

-- Un cliente autenticado (profiles.role='client') ve únicamente su
-- propio registro / sus propios proyectos.
create policy "clients: un cliente ve el suyo" on clients
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'client' and client_id = clients.id)
  );
create policy "projects: un cliente ve los suyos" on projects
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'client' and client_id = projects.client_id)
  );
