-- ============================================================
-- REELSUPRA — ROW LEVEL SECURITY (V3)
-- ============================================================
-- Criterio (decisión documentada en PLAN_MIGRACION_SUPABASE.md, no es
-- un atajo): el portal del cliente hoy es de solo lectura pública vía
-- URL, sin login — así funcionó siempre, y no romperlo era un
-- requisito explícito. Lo que SÍ era una falla real de seguridad es
-- que escribir dependía únicamente de un gate en el navegador (la
-- contraseña de admin, visible en el JS público) — cualquiera con
-- las herramientas de desarrollador podía llamar a las funciones de
-- admin.js sin esa contraseña. Estas políticas cierran ESO: la
-- escritura ahora se rechaza en el servidor si no hay una sesión de
-- Supabase Auth con rol admin, sin importar qué haga el navegador.
--
-- Lectura pública de clients/projects: se mantiene (mismo modelo de
-- seguridad que ya existía — la URL/slug es el límite, no una
-- contraseña). El día que se active login de Cliente (profiles.role
-- = 'client'), esta política de lectura pública se puede reemplazar
-- sin tocar el resto — está aislada a propósito.
-- ============================================================

alter table agency_settings enable row level security;
alter table clients enable row level security;
alter table projects enable row level security;
alter table profiles enable row level security;

-- ------------------------------------------------------------
-- Helper: ¿el usuario autenticado actual es admin?
-- security definer + search_path fijo: evita que alguien "secuestre"
-- la función apuntando a una tabla profiles falsa en otro schema.
-- ------------------------------------------------------------
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ------------------------------------------------------------
-- agency_settings: lectura pública (nombre/tagline en el topbar),
-- escritura solo admin.
-- ------------------------------------------------------------
create policy "agency_settings: lectura pública" on agency_settings
  for select using (true);
create policy "agency_settings: solo admin escribe" on agency_settings
  for all using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------
-- clients: lectura pública (portal sin login, como hoy).
-- ------------------------------------------------------------
create policy "clients: lectura pública" on clients
  for select using (true);

create policy "clients: solo admin inserta" on clients
  for insert with check (is_admin());
create policy "clients: solo admin actualiza" on clients
  for update using (is_admin()) with check (is_admin());
create policy "clients: solo admin borra" on clients
  for delete using (is_admin());

-- Preparado para cuando exista login de Cliente: un usuario con
-- profiles.role = 'client' podría ver (además de la lectura pública
-- de arriba, que se retiraría en ese momento) específicamente su
-- propio cliente. Se deja comentado a propósito — activarlo es parte
-- de la fase de login de Cliente, no de esta.
-- create policy "clients: un cliente ve el suyo" on clients
--   for select using (
--     exists (select 1 from profiles where id = auth.uid() and role = 'client' and client_id = clients.id)
--   );

-- ------------------------------------------------------------
-- projects: mismo criterio, a través de client_id.
-- ------------------------------------------------------------
create policy "projects: lectura pública" on projects
  for select using (true);

create policy "projects: solo admin inserta" on projects
  for insert with check (is_admin());
create policy "projects: solo admin actualiza" on projects
  for update using (is_admin()) with check (is_admin());
create policy "projects: solo admin borra" on projects
  for delete using (is_admin());

-- create policy "projects: un cliente ve los suyos" on projects
--   for select using (
--     exists (select 1 from profiles where id = auth.uid() and role = 'client' and client_id = projects.client_id)
--   );

-- ------------------------------------------------------------
-- profiles: cada usuario ve su propio perfil (necesario para que el
-- panel admin pueda preguntar "¿soy admin?" al iniciar sesión); solo
-- un admin puede crear/editar perfiles (asignar roles).
-- ------------------------------------------------------------
create policy "profiles: un usuario ve el suyo" on profiles
  for select using (id = auth.uid());
create policy "profiles: solo admin gestiona roles" on profiles
  for insert with check (is_admin());
create policy "profiles: solo admin actualiza roles" on profiles
  for update using (is_admin()) with check (is_admin());
