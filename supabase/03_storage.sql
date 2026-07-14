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
--
-- Idempotente a propósito (2026-07-14): un intento anterior de correr
-- este archivo falló a mitad de camino ("policy ... already exists"),
-- y como el SQL Editor corre el script completo en una sola
-- transacción implícita, el error hizo rollback de TODO — incluida la
-- creación de los buckets, que por eso nunca quedaron creados pese a
-- que la policy sí. `drop policy if exists` antes de cada `create`
-- (mismo patrón que ya usa 06_client_access_gate.sql) hace que correr
-- este archivo de nuevo sea seguro sin importar en qué parte se haya
-- cortado la vez anterior.
-- ============================================================

insert into storage.buckets (id, name, public)
values
  ('logos', 'logos', true),
  ('covers', 'covers', true),
  ('documents', 'documents', true),
  ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "assets: lectura pública" on storage.objects;
create policy "assets: lectura pública" on storage.objects
  for select using (bucket_id in ('logos', 'covers', 'documents', 'media'));

drop policy if exists "assets: solo admin sube" on storage.objects;
create policy "assets: solo admin sube" on storage.objects
  for insert with check (
    bucket_id in ('logos', 'covers', 'documents', 'media') and is_admin()
  );

drop policy if exists "assets: solo admin actualiza" on storage.objects;
create policy "assets: solo admin actualiza" on storage.objects
  for update using (
    bucket_id in ('logos', 'covers', 'documents', 'media') and is_admin()
  );

drop policy if exists "assets: solo admin borra" on storage.objects;
create policy "assets: solo admin borra" on storage.objects
  for delete using (
    bucket_id in ('logos', 'covers', 'documents', 'media') and is_admin()
  );
