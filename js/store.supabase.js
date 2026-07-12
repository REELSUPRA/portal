/**
 * ============================================================
 * REELSUPRA — CAPA DE PERSISTENCIA (RSStore), VERSIÓN SUPABASE
 * ============================================================
 * NO ESTÁ CONECTADA TODAVÍA. Este archivo existe en paralelo a
 * js/store.js (la versión localStorage, todavía la que corre en
 * producción) — ver DOCUMENTACION/PLAN_MIGRACION_SUPABASE.md,
 * sección "Checklist de cutover", para la lista exacta de lo que
 * falta antes de reemplazar el <script src="js/store.js"> por este
 * archivo en index.html/project.html.
 *
 * Por qué un archivo aparte y no un reemplazo directo: activar esto
 * sin credenciales reales rompería el portal en producción (hydrate()
 * es lo primero que corre en boot(), antes de cualquier render — si
 * falla, no se dibuja nada). Se conecta recién cuando:
 *   1. Existe un proyecto Supabase real con el esquema de supabase/
 *      ya corrido (01_schema.sql, 02_policies.sql, 03_storage.sql,
 *      opcionalmente 04_seed_from_data_js.sql).
 *   2. SUPABASE_URL / SUPABASE_ANON_KEY (abajo) tienen los valores
 *      reales de ese proyecto.
 *   3. admin.js reemplazó el gate de contraseña por login real de
 *      Supabase Auth (ver el plan — si no, la sesión de admin queda
 *      sin ninguna protección real).
 *
 * Mantiene la MISMA interfaz que js/store.js — { load, save, clear,
 * hydrate }, todas Promise — así admin.js no necesita saber que el
 * destino cambió. Esa es la razón por la que RSStore se diseñó async
 * desde el día uno, aunque localStorage fuera síncrono.
 * ============================================================
 */

window.RSStore = (() => {
  // TODO: completar con los valores reales del proyecto Supabase.
  // SUPABASE_ANON_KEY es la clave pública ("anon"/"publishable") —
  // está diseñada para vivir en código de cliente, la seguridad real
  // la dan las políticas de RLS (ver supabase/02_policies.sql), NO
  // el secreto de la clave. NUNCA poner acá la "service_role key".
  const SUPABASE_URL = "";
  const SUPABASE_ANON_KEY = "";

  // Qué cliente mostrar cuando la URL no especifica ?client=<slug>.
  // Con un solo cliente real hoy (Juan Guzmán), esto mantiene el
  // link actual (portalreelsupra.netlify.app/, sin parámetros)
  // funcionando exactamente igual que ahora. El día que haya un
  // segundo cliente, cada uno recibe su propio link con ?client=.
  const DEFAULT_CLIENT_SLUG = "juan-guzman";

  let _client = null;
  function client() {
    if (_client) return _client;
    if (!window.supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error(
        "RSStore (Supabase): faltan SUPABASE_URL/SUPABASE_ANON_KEY o no cargó supabase-js. " +
        "Ver DOCUMENTACION/PLAN_MIGRACION_SUPABASE.md antes de activar este archivo."
      );
    }
    _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return _client;
  }

  function currentClientSlug() {
    const params = new URLSearchParams(window.location.search);
    return params.get("client") || DEFAULT_CLIENT_SLUG;
  }

  // ---- mapeo DB (snake_case) <-> CLIENT_DATA (camelCase) ----
  // Único lugar del proyecto que conoce los nombres de columna de
  // Supabase — todo lo demás (render.js, admin.js, LIST_SCHEMAS,
  // BLOCK_DEFS, THEME_SCHEMA) sigue leyendo/escribiendo el mismo
  // objeto CLIENT_DATA de siempre, con las mismas claves camelCase.

  function rowToClient(row) {
    return {
      name: row.name,
      greetingEmoji: row.greeting_emoji,
      coverImage: row.cover_image_url,
      logoUrl: row.logo_url,
      faviconUrl: row.favicon_url,
      theme: row.theme || {},
      welcomeMessage: row.welcome_message,
      heroSlides: row.hero_slides || [],
      _id: row.id, // uso interno (save necesita el uuid) — no lo lee render.js
    };
  }

  function rowToProject(row) {
    return {
      id: row.slug,
      emoji: row.emoji,
      logoUrl: row.logo_url,
      name: row.name,
      sector: row.sector,
      language: row.language,
      audience: row.audience,
      plan: row.plan,
      planDetail: row.plan_detail,
      status: row.status,
      statusTone: row.status_tone,
      objective: row.objective,
      goals: row.goals || [],
      roadmap: row.roadmap || [],
      contentPieces: row.content_pieces || [],
      nextSteps: row.next_steps || [],
      pendingMaterial: row.pending_material || [],
      resources: row.resources || [],
      documents: row.documents || [],
      links: row.links || [],
      calendar: row.calendar || [],
      bitacora: row.bitacora || [],
      upsells: row.upsells || [],
      heroSlides: row.hero_slides || [],
      blocks: row.blocks || [],
      _id: row.id,
    };
  }

  function clientToRow(clientObj, slug, announcement) {
    return {
      slug,
      name: clientObj.name,
      greeting_emoji: clientObj.greetingEmoji,
      cover_image_url: clientObj.coverImage,
      logo_url: clientObj.logoUrl,
      favicon_url: clientObj.faviconUrl,
      theme: clientObj.theme || {},
      welcome_message: clientObj.welcomeMessage,
      hero_slides: clientObj.heroSlides || [],
      announcement: announcement || { active: false, text: "" },
    };
  }

  function projectToRow(project, clientId) {
    return {
      client_id: clientId,
      slug: project.id,
      emoji: project.emoji,
      logo_url: project.logoUrl,
      name: project.name,
      sector: project.sector,
      language: project.language,
      audience: project.audience,
      plan: project.plan,
      plan_detail: project.planDetail,
      status: project.status,
      status_tone: project.statusTone,
      objective: project.objective,
      goals: project.goals || [],
      roadmap: project.roadmap || [],
      content_pieces: project.contentPieces || [],
      next_steps: project.nextSteps || [],
      pending_material: project.pendingMaterial || [],
      resources: project.resources || [],
      documents: project.documents || [],
      links: project.links || [],
      calendar: project.calendar || [],
      bitacora: project.bitacora || [],
      upsells: project.upsells || [],
      hero_slides: project.heroSlides || [],
      blocks: project.blocks || [],
    };
  }

  // ---- interfaz pública, igual a js/store.js ----

  function load() {
    const slug = currentClientSlug();
    return Promise.all([
      client().from("agency_settings").select("*").eq("id", true).single(),
      client().from("clients").select("*").eq("slug", slug).single(),
    ]).then(([agencyRes, clientRes]) => {
      if (agencyRes.error) throw agencyRes.error;
      if (clientRes.error) throw clientRes.error;

      const clientRow = clientRes.data;
      return client()
        .from("projects")
        .select("*")
        .eq("client_id", clientRow.id)
        .order("created_at", { ascending: true })
        .then((projectsRes) => {
          if (projectsRes.error) throw projectsRes.error;
          return {
            agency: { name: agencyRes.data.name, tagline: agencyRes.data.tagline },
            client: rowToClient(clientRow),
            announcement: clientRow.announcement || { active: false, text: "" },
            projects: (projectsRes.data || []).map(rowToProject),
          };
        });
    });
  }

  function save(data) {
    const slug = currentClientSlug();
    const clientId = data.client._id; // seteado por hydrate() al cargar
    if (!clientId) {
      return Promise.resolve(false); // no debería pasar si hydrate() corrió antes
    }

    const clientRow = clientToRow(data.client, slug, data.announcement);

    const updateClient = client().from("clients").update(clientRow).eq("id", clientId);

    const upsertProjects = Promise.all(
      (data.projects || []).map((p) => {
        const row = projectToRow(p, clientId);
        if (p._id) {
          return client().from("projects").update(row).eq("id", p._id);
        }
        return client().from("projects").insert(row);
      })
    );

    return Promise.all([updateClient, upsertProjects])
      .then(([clientResult, projectResults]) => {
        const clientOk = !clientResult.error;
        const projectsOk = projectResults.every((r) => !r.error);
        return clientOk && projectsOk;
      })
      .catch((e) => {
        console.warn("RSStore (Supabase): no se pudo guardar.", e);
        return false;
      });
  }

  function clear() {
    // No aplica igual que en localStorage (no hay "override" que
    // borrar — Supabase ES la fuente de verdad). Se deja como no-op
    // para no romper la interfaz; si algún día hace falta "revertir a
    // los valores de fábrica", sería una operación explícita distinta
    // (restaurar desde 04_seed_from_data_js.sql), no un clear().
    return Promise.resolve();
  }

  function hydrate() {
    return load()
      .then((data) => {
        window.CLIENT_DATA = data;
      })
      .catch((e) => {
        // Fallback real, no cosmético: si Supabase no responde (caída,
        // sin red), se deja el contenido de js/data.js que ya estaba
        // cargado en window.CLIENT_DATA ANTES de este script (mismo
        // orden de <script> que hoy) en vez de romper el portal entero.
        // Es el único rol que conserva data.js en la V3 — bootstrap/
        // fallback, nunca fuente de verdad — pedido explícito de la
        // migración. window.RS_SUPABASE_OFFLINE queda como bandera para
        // que una futura UI (no construida todavía) pueda avisar
        // "estás viendo una versión en caché" si hace falta.
        console.error("RSStore (Supabase): no se pudo cargar desde Supabase, usando data.js como fallback.", e);
        window.RS_SUPABASE_OFFLINE = true;
      });
  }

  return { load, save, clear, hydrate };
})();
