-- ============================================================
-- REELSUPRA — SEED: migra el contenido real de js/data.js (2026-07-12)
-- ============================================================
-- Ejecutar UNA sola vez, después de 01_schema.sql y 02_policies.sql.
-- Carga a Supabase el contenido actual y real de Juan Guzmán y sus
-- dos proyectos — así el día del cutover, Supabase ya tiene lo mismo
-- que hoy sirve js/data.js, sin perder nada.
--
-- Nota: coverImage/logoUrl/faviconUrl de client y de ambos proyectos
-- siguen en null acá a propósito — según lo verificado en esta misma
-- conversación, hoy son null en js/data.js (lo que se subió desde el
-- panel quedó solo en localStorage del navegador de la PC, nunca
-- llegó al repo). Si querés que ese logo/portada real quede en
-- Supabase desde el día uno, mandámelo (el archivo "Exportar JSON")
-- y lo incorporo a este seed antes de correrlo.
-- ============================================================

insert into agency_settings (id, name, tagline) values
  (true, 'ReelSupra', 'Sistemas de contenido para marcas que escalan')
on conflict (id) do update set name = excluded.name, tagline = excluded.tagline;

insert into clients (slug, name, greeting_emoji, cover_image_url, logo_url, favicon_url, theme, welcome_message, announcement)
values (
  'juan-guzman',
  'Juan Guzmán',
  '⚡',
  null,
  null,
  null,
  '{"primaryColor": "#e02020"}'::jsonb,
  'Este es tu portal ReelSupra. Acá vas a encontrar el estado de cada proyecto, qué sigue, y todo el material y los recursos que necesitás tener a mano — sin buscar en chats ni carpetas sueltas.',
  '{"active": true, "text": "Juan viaja del 4 al 11 de este mes. Durante ese período se trabaja con material ya grabado para ambos proyectos."}'::jsonb
)
on conflict (slug) do nothing;

-- ------------------------------------------------------------
-- Proyecto 1: JGA Group Services LLC (jga-realtor)
-- ------------------------------------------------------------
insert into projects (
  client_id, slug, emoji, logo_url, name, sector, language, audience, plan, plan_detail, status, status_tone, objective,
  goals, roadmap, content_pieces, next_steps, pending_material, resources, documents, links, calendar, bitacora, upsells, blocks
)
select
  (select id from clients where slug = 'juan-guzman'),
  'jga-realtor', '🏡', null, 'JGA Group Services LLC', 'Real Estate', 'Español', 'Comunidad latina en Florida',
  'RS-08', '8 videos mensuales', 'En producción', 'active',
  'Posicionar la marca personal de Juan como realtor de referencia para la comunidad latina en Florida, generando autoridad y consultas calificadas.',
  '["Generar autoridad en el nicho inmobiliario", "Generar consultas de clientes potenciales", "Mostrar cierres de ventas reales", "Posicionar la marca personal de Juan"]'::jsonb,
  '[
    {"phase": "Fase 1 — Producción con material existente", "status": "in-progress", "detail": "Cierres de ventas, propiedades y contenido ya grabado (4–11 del mes, viaje de Juan)."},
    {"phase": "Fase 2 — Producción regular", "status": "upcoming", "detail": "8 videos mensuales según plan RS-08, grabación y edición en ciclo continuo."},
    {"phase": "Fase 3 — Optimización de embudo", "status": "upcoming", "detail": "Ajuste de landing page y automatizaciones según resultados del primer mes."}
  ]'::jsonb,
  '[
    {"id": "cp1", "title": "Cierre de venta — Propiedad Doral", "status": "delivered", "publishDate": "2026-07-08", "videoUrl": "https://drive.google.com/", "note": "Publicar con caption de autoridad."},
    {"id": "cp2", "title": "", "status": "pending", "publishDate": "2026-07-11", "videoUrl": "", "note": ""},
    {"id": "cp3", "title": "", "status": "pending", "publishDate": "", "videoUrl": "", "note": ""},
    {"id": "cp4", "title": "", "status": "pending", "publishDate": "", "videoUrl": "", "note": ""},
    {"id": "cp5", "title": "", "status": "pending", "publishDate": "", "videoUrl": "", "note": ""},
    {"id": "cp6", "title": "", "status": "pending", "publishDate": "", "videoUrl": "", "note": ""},
    {"id": "cp7", "title": "", "status": "pending", "publishDate": "", "videoUrl": "", "note": ""},
    {"id": "cp8", "title": "", "status": "pending", "publishDate": "", "videoUrl": "", "note": ""}
  ]'::jsonb,
  '["Seleccionar clips de cierres y propiedades ya grabados", "Editar primer lote de contenido para la semana del viaje", "Definir calendario de publicación con Juan"]'::jsonb,
  '["Confirmación de propiedades a destacar este mes", "Testimonios de clientes recientes (si están disponibles)"]'::jsonb,
  '[
    {"label": "Guion base para redes", "url": "#"},
    {"label": "Banco de música con licencia", "url": "#"},
    {"label": "Guía de hashtags — nicho inmobiliario Florida", "url": "#"}
  ]'::jsonb,
  '[
    {"label": "Propuesta y alcance RS-08", "url": "#"},
    {"label": "Brief de marca — JGA Realtor", "url": "#"}
  ]'::jsonb,
  '[
    {"label": "Carpeta de material en bruto", "url": "#", "type": "drive"},
    {"label": "Calendario editorial compartido", "url": "#", "type": "calendar"},
    {"label": "Escribir por WhatsApp", "url": "#", "type": "whatsapp"}
  ]'::jsonb,
  '[
    {"date": "2026-07-04", "label": "Inicio de viaje de Juan"},
    {"date": "2026-07-11", "label": "Regreso de Juan"},
    {"date": "2026-07-15", "label": "Revisión mensual de resultados"}
  ]'::jsonb,
  '[
    {"date": "2026-07-10", "type": "material", "text": "Nuevas fotos de la propiedad recibidas de Juan."},
    {"date": "2026-07-08", "type": "delivery", "text": "Primer video del mes entregado y listo para publicar."},
    {"date": "2026-07-04", "type": "milestone", "text": "Arranca producción con material grabado antes del viaje de Juan."}
  ]'::jsonb,
  '[
    {"title": "Landing page para captación de leads", "description": "Página dedicada para convertir las visitas de los videos en consultas calificadas.", "ctaLabel": "Consultar", "ctaUrl": "#"},
    {"title": "Automatización de respuesta por WhatsApp", "description": "Respuesta inmediata a quienes consultan por Instagram o WhatsApp fuera de horario.", "ctaLabel": "Consultar", "ctaUrl": "#"}
  ]'::jsonb,
  '[
    {"id": "goals", "visible": true}, {"id": "roadmap", "visible": true}, {"id": "contentPieces", "visible": true},
    {"id": "calendar", "visible": true}, {"id": "resources", "visible": true}, {"id": "documents", "visible": true},
    {"id": "nextSteps", "visible": true}, {"id": "pendingMaterial", "visible": true}, {"id": "bitacora", "visible": true},
    {"id": "upsells", "visible": true}
  ]'::jsonb
where not exists (
  select 1 from projects p join clients c on c.id = p.client_id
  where c.slug = 'juan-guzman' and p.slug = 'jga-realtor'
);

-- ------------------------------------------------------------
-- Proyecto 2: JGA Closet Upgrade (jga-closets)
-- ------------------------------------------------------------
insert into projects (
  client_id, slug, emoji, logo_url, name, sector, language, audience, plan, plan_detail, status, status_tone, objective,
  goals, roadmap, content_pieces, next_steps, pending_material, resources, documents, links, calendar, bitacora, upsells, blocks
)
select
  (select id from clients where slug = 'juan-guzman'),
  'jga-closets', '🚪', null, 'JGA Closet Upgrade', 'Closets personalizados', 'Inglés', 'Propietarios de vivienda en EE.UU.',
  'RS-08', '8 videos mensuales', 'En producción', 'active',
  'Posicionar a JGA Closet Upgrade como referencia en instalación de closets personalizados, mostrando transformaciones reales que generen confianza y clientes.',
  '["Mostrar transformaciones antes y después", "Generar confianza en el proceso de instalación", "Conseguir clientes nuevos"]'::jsonb,
  '[
    {"phase": "Fase 1 — Producción con material existente", "status": "in-progress", "detail": "B-roll, instalaciones, before & after y detalles de procesos ya grabados."},
    {"phase": "Fase 2 — Narración en inglés", "status": "upcoming", "detail": "Evaluación de clonación de voz de Juan (IA) para narración en inglés. Si la calidad no es profesional, se usará música, subtítulos y texto en pantalla."},
    {"phase": "Fase 3 — Producción regular", "status": "upcoming", "detail": "8 videos mensuales según plan RS-08."}
  ]'::jsonb,
  '[
    {"id": "cp1", "title": "Before & after — Walk-in closet", "status": "delivered", "publishDate": "2026-07-09", "videoUrl": "https://drive.google.com/", "note": "Subtítulos en inglés."},
    {"id": "cp2", "title": "", "status": "pending", "publishDate": "2026-07-14", "videoUrl": "", "note": ""},
    {"id": "cp3", "title": "", "status": "pending", "publishDate": "", "videoUrl": "", "note": ""},
    {"id": "cp4", "title": "", "status": "pending", "publishDate": "", "videoUrl": "", "note": ""},
    {"id": "cp5", "title": "", "status": "pending", "publishDate": "", "videoUrl": "", "note": ""},
    {"id": "cp6", "title": "", "status": "pending", "publishDate": "", "videoUrl": "", "note": ""},
    {"id": "cp7", "title": "", "status": "pending", "publishDate": "", "videoUrl": "", "note": ""},
    {"id": "cp8", "title": "", "status": "pending", "publishDate": "", "videoUrl": "", "note": ""}
  ]'::jsonb,
  '["Seleccionar mejor material de before & after disponible", "Probar clonación de voz en inglés y evaluar calidad", "Definir plan B de subtítulos si la narración no es viable"]'::jsonb,
  '["Fotos o video adicional de proyectos recientes", "Confirmación de qué instalaciones se pueden mostrar públicamente"]'::jsonb,
  '[
    {"label": "Guion base en inglés", "url": "#"},
    {"label": "Banco de música con licencia", "url": "#"},
    {"label": "Referencias de edición before & after", "url": "#"}
  ]'::jsonb,
  '[
    {"label": "Propuesta y alcance RS-08", "url": "#"},
    {"label": "Brief de marca — JGA Closet Upgrade", "url": "#"}
  ]'::jsonb,
  '[
    {"label": "Carpeta de material en bruto", "url": "#", "type": "drive"},
    {"label": "Calendario editorial compartido", "url": "#", "type": "calendar"},
    {"label": "Escribir por WhatsApp", "url": "#", "type": "whatsapp"}
  ]'::jsonb,
  '[
    {"date": "2026-07-04", "label": "Inicio de viaje de Juan"},
    {"date": "2026-07-11", "label": "Regreso de Juan"},
    {"date": "2026-07-15", "label": "Revisión mensual de resultados"}
  ]'::jsonb,
  '[
    {"date": "2026-07-09", "type": "delivery", "text": "Primer before & after entregado, con subtítulos en inglés."},
    {"date": "2026-07-04", "type": "milestone", "text": "Arranca producción con material grabado antes del viaje de Juan."}
  ]'::jsonb,
  '[
    {"title": "Clonación de voz en inglés (IA)", "description": "Narración automática en inglés con la voz de Juan, si la calidad resulta profesional.", "ctaLabel": "Consultar", "ctaUrl": "#"}
  ]'::jsonb,
  '[
    {"id": "goals", "visible": true}, {"id": "roadmap", "visible": true}, {"id": "contentPieces", "visible": true},
    {"id": "calendar", "visible": true}, {"id": "resources", "visible": true}, {"id": "documents", "visible": true},
    {"id": "nextSteps", "visible": true}, {"id": "pendingMaterial", "visible": true}, {"id": "bitacora", "visible": true},
    {"id": "upsells", "visible": true}
  ]'::jsonb
where not exists (
  select 1 from projects p join clients c on c.id = p.client_id
  where c.slug = 'juan-guzman' and p.slug = 'jga-closets'
);

-- ------------------------------------------------------------
-- Bootstrap del primer admin — PASO MANUAL, no automatizable:
-- 1. Crear el usuario admin en Authentication > Users (o que se
--    registre una vez con Supabase Auth).
-- 2. Copiar su UUID y correr:
--    insert into profiles (id, role) values ('<uuid-del-usuario>', 'admin');
-- (No puede salir de una policy porque is_admin() todavía no tendría
-- a quién apuntar — es la única escritura que se hace a mano, una
-- sola vez, desde el SQL Editor de Supabase con permisos de owner.)
-- ------------------------------------------------------------
