-- ============================================================
-- REELSUPRA — "QUÉ INCLUYE ESTE PROYECTO" (aditivo puro)
-- ============================================================
-- Nuevo bloque editable por proyecto (Fase 3, sistema de onboarding
-- por presets): lista de servicios/entregables incluidos en ESTE
-- proyecto puntual (ej. "Landing Page", "Automatización IA", "Videos
-- adicionales"). Se evaluó reutilizar `upsells` o `resources` para
-- esto y se descartó a propósito: `upsells` ya significa lo opuesto
-- (mejoras a VENDER, no ya incluidas) y `resources` ya significa links
-- externos — ambas con datos reales de Juan Guzmán que no hay que
-- pisar. No hay columna existente con este significado.
--
-- Un preset puede cargar una versión inicial (ver RS.PROJECT_PRESETS
-- en js/render.js — registro declarativo, no una tabla), pero queda
-- 100% editable por proyecto después, igual que Objetivos/Roadmap.
--
-- ⚠️ NO EJECUTAR TODAVÍA sin confirmación — mismo patrón que
-- 07_client_archive.sql / 08_project_market.sql. Mientras no se
-- aplique, RSStore.save()/createProject() siguen funcionando: si el
-- insert/update de un proyecto falla específicamente porque
-- "deliverables" no existe, reintenta sin esa columna (ver
-- js/store.supabase.js, mismo patrón defensivo ya usado para
-- "archived"/"market").
-- ============================================================

alter table projects
  add column if not exists deliverables jsonb not null default '[]';
