-- ============================================================
-- REELSUPRA — MERCADO / UBICACIÓN DEL PROYECTO (aditivo puro)
-- ============================================================
-- Sector, Idioma y Público ya existen en projects (sector, language,
-- audience) — este archivo solo agrega "Mercado / Ubicación", que no
-- tenía ninguna columna todavía. Se queda a nivel PROYECTO, no cliente:
-- un mismo cliente puede tener proyectos en mercados distintos (ver
-- Juan Guzmán: closets en EE.UU. vs. real estate en Florida — sector,
-- idioma y público ya difieren hoy entre sus 2 proyectos reales).
--
-- ⚠️ NO EJECUTAR TODAVÍA sin confirmación — igual que
-- 07_client_archive.sql, este archivo se deja listo pero no se corre
-- solo. Mientras no se aplique, RSStore.save() sigue funcionando
-- normal: si el update/insert de un proyecto falla específicamente
-- porque "market" no existe, reintenta sin esa columna (ver
-- js/store.supabase.js, mismo patrón que listClients()/"archived").
-- ============================================================

alter table projects
  add column if not exists market text;
