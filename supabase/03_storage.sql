-- ============================================================
-- REELSUPRA — STORAGE (V3)
-- ============================================================
-- 4 buckets pedidos explícitamente: logos, portadas, documentos,
-- imágenes. Público de lectura (mismo criterio que clients/projects
-- — hoy todo es accesible por URL sin login) y escritura solo admin.
--
-- Reemplaza el guardado de imágenes en base64 dentro de CLIENT_DATA
-- (ver PLAN_MIGRACION_SUPABASE.md, sección "Imágenes"): a partir de
-- este cambio, admin.js sube el archivo a uno de estos buckets y
-- guarda la URL pública resultante en la columna correspondiente
-- (logo_url, cover_image_url, favicon_url, o dentro del jsonb de
-- resources/documents), en vez de un string base64 gigante.
-- ============================================================

insert into storage.buckets (id, name, public)
values
  ('logos', 'logos', true),
  ('covers', 'covers', true),
  ('documents', 'documents', true),
  ('media', 'media', true)
on conflict (id) do nothing;

create policy "assets: lectura pública" on storage.objects
  for select using (bucket_id in ('logos', 'covers', 'documents', 'media'));

create policy "assets: solo admin sube" on storage.objects
  for insert with check (
    bucket_id in ('logos', 'covers', 'documents', 'media') and is_admin()
  );

create policy "assets: solo admin actualiza" on storage.objects
  for update using (
    bucket_id in ('logos', 'covers', 'documents', 'media') and is_admin()
  );

create policy "assets: solo admin borra" on storage.objects
  for delete using (
    bucket_id in ('logos', 'covers', 'documents', 'media') and is_admin()
  );
