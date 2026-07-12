-- ============================================================
-- REELSUPRA — ESQUEMA SUPABASE (V3, migración desde localStorage)
-- ============================================================
-- Diseño: "cáscara relacional + contenido JSONB".
--
-- Las columnas que hoy son listas editables desde el editor genérico
-- (LIST_SCHEMAS en js/render.js) se guardan como jsonb, con la MISMA
-- forma que ya usa CLIENT_DATA hoy. Esto es deliberado, no un atajo:
-- así el motor declarativo (BLOCK_DEFS/LIST_SCHEMAS/THEME_SCHEMA) no
-- necesita saber que el dato vino de Postgres en vez de un objeto JS
-- en memoria — solo cambia js/store.js. El límite de tabla (clients/
-- projects) sí es relacional, porque ahí es donde importa tener un
-- límite real de fila para Row Level Security (ver 02_policies.sql).
--
-- Ejecutar en el SQL Editor de Supabase, en este orden (01, 02, 03,
-- y 04 solo si querés precargar los datos actuales de data.js).
-- ============================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ------------------------------------------------------------
-- Config global de la agencia (una sola fila — ya no es "por
-- cliente": con múltiples clientes en un mismo deployment, el nombre
-- de la agencia es del deployment, no de cada cliente).
-- ------------------------------------------------------------
create table if not exists agency_settings (
  id boolean primary key default true check (id), -- singleton: fuerza una sola fila
  name text not null default 'ReelSupra',
  tagline text
);

-- ------------------------------------------------------------
-- Clientes (antes: un solo objeto "client" hardcodeado en data.js)
-- ------------------------------------------------------------
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  -- slug: identifica al cliente en la URL (?client=juan-guzman). Ver
  -- nota de routing en PLAN_MIGRACION_SUPABASE.md — reemplaza al
  -- "un cliente por deployment" de la V1/V2.
  slug text unique not null,
  name text not null,
  greeting_emoji text,
  cover_image_url text,
  logo_url text,
  favicon_url text,
  -- Theme Builder completo (THEME_SCHEMA en render.js) — mismo objeto
  -- que hoy vive en client.theme, sin cambios de forma.
  theme jsonb not null default '{}'::jsonb,
  welcome_message text,
  announcement jsonb not null default '{"active": false, "text": ""}'::jsonb,
  -- Hero Inteligente (Prioridad 3 de V3, todavía no implementada) —
  -- se deja la columna lista para no requerir otra migración después.
  hero_slides jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Proyectos (antes: array "projects" dentro de CLIENT_DATA)
-- ------------------------------------------------------------
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  -- slug: reemplaza al "id" string de hoy (project.html?id=jga-realtor).
  -- Único POR CLIENTE, no global (dos clientes distintos podrían
  -- tener un proyecto "principal", por ejemplo).
  slug text not null,
  emoji text,
  logo_url text,
  name text not null,
  sector text,
  language text,
  audience text,
  plan text,
  plan_detail text,
  status text,
  status_tone text,
  objective text,
  -- Cada una de estas es exactamente lo que LIST_SCHEMAS ya sabe
  -- editar hoy — misma forma de array de objetos (o de strings, para
  -- las "primitive: true"), sin cambios.
  goals jsonb not null default '[]'::jsonb,
  roadmap jsonb not null default '[]'::jsonb,
  content_pieces jsonb not null default '[]'::jsonb,
  next_steps jsonb not null default '[]'::jsonb,
  pending_material jsonb not null default '[]'::jsonb,
  resources jsonb not null default '[]'::jsonb,
  documents jsonb not null default '[]'::jsonb,
  links jsonb not null default '[]'::jsonb,
  calendar jsonb not null default '[]'::jsonb,
  bitacora jsonb not null default '[]'::jsonb,
  upsells jsonb not null default '[]'::jsonb,
  hero_slides jsonb not null default '[]'::jsonb,
  -- Orden/visibilidad de bloques (antes: project.blocks)
  blocks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, slug)
);

-- ------------------------------------------------------------
-- Perfiles: mapea un usuario de Supabase Auth a un rol.
-- Preparado para Admin y Cliente (pedido explícito de la migración),
-- aunque el login de Cliente no se activa todavía en la Fase 1 — ver
-- PLAN_MIGRACION_SUPABASE.md, sección "Autenticación".
-- ------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'client')),
  -- Solo se usa si role = 'client': a qué cliente ve. Un admin ve todo
  -- y no necesita esta columna.
  client_id uuid references clients(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- updated_at automático (evita que cada UPDATE desde admin.js tenga
-- que acordarse de setearlo a mano)
-- ------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists clients_set_updated_at on clients;
create trigger clients_set_updated_at before update on clients
  for each row execute function set_updated_at();

drop trigger if exists projects_set_updated_at on projects;
create trigger projects_set_updated_at before update on projects
  for each row execute function set_updated_at();
