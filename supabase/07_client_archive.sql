-- ============================================================
-- REELSUPRA — ARCHIVAR CLIENTES (Dashboard, Fase 2)
-- ============================================================
-- Aditivo puro: agrega una columna a clients para poder "archivar"
-- un cliente desde el Dashboard sin borrar nada. Archivar es
-- deliberadamente débil: solo oculta al cliente de la lista activa
-- del Dashboard (el propio Dashboard filtra por esta columna). NO
-- cambia ninguna política de RLS, NO revoca el acceso al portal del
-- cliente, y el portal sigue siendo accesible por URL exactamente
-- igual que hoy — coherente con que el gate real de lectura por
-- cliente (06_client_access_gate.sql) sigue diferido a v1.1 a
-- propósito. Correr esto no afecta nada de lo que ya funciona en
-- producción.
-- ============================================================

alter table clients
  add column if not exists archived boolean not null default false;
