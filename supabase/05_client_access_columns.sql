-- ============================================================
-- REELSUPRA — "ACCESO AL PORTAL" (columnas, seguro de correr ya)
-- ============================================================
-- Aditivo puro: agrega 2 columnas a clients para poder mostrar el
-- estado de acceso ("Acceso al Portal" en el panel admin) sin tener
-- que consultar la Auth Admin API cada vez que se abre el panel. La
-- Edge Function manage-client-access (ver supabase/functions/) es la
-- única que las escribe — el panel solo lee.
--
-- NO cambia ninguna política de RLS ni de lectura pública — correr
-- esto no afecta nada de lo que ya funciona en producción. El cambio
-- que sí afecta el acceso real (05_client_access_gate.sql) es
-- deliberadamente un archivo separado y NO se corre todavía — ver su
-- propio comentario.
-- ============================================================

alter table clients
  add column if not exists portal_email text,
  -- id real en auth.users una vez invitado — se conserva incluso si
  -- se revoca el acceso, para poder RESTAURARLO sin mandar una
  -- invitación nueva (la cuenta ya existe, solo se le devuelve el
  -- vínculo en profiles). Solo es null si nunca se invitó a nadie.
  add column if not exists portal_user_id uuid,
  add column if not exists portal_access_status text
    not null default 'sin_invitar'
    check (portal_access_status in ('sin_invitar', 'invitado', 'revocado'));
