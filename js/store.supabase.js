/**
 * ============================================================
 * REELSUPRA — CAPA DE PERSISTENCIA (RSStore), VERSIÓN SUPABASE
 * ============================================================
 * Conectada al proyecto real desde el 2026-07-12 — reemplaza a
 * js/store.js (localStorage) en index.html/project.html. js/store.js
 * se conserva en el repo sin borrar, como respaldo/rollback: volver
 * atrás es cambiar el <script src> de vuelta, nada más.
 *
 * Verificado contra el proyecto real antes de conectar: lectura
 * pública (agency_settings/clients/projects) funciona vía la
 * publishable key; una escritura sin sesión admin autenticada queda
 * bloqueada por RLS (confirmado con una prueba real, no solo
 * inspección de políticas). Ver DOCUMENTACION/PLAN_MIGRACION_SUPABASE.md.
 *
 * Mantiene la MISMA interfaz que js/store.js — { load, save, clear,
 * hydrate }, todas Promise — así admin.js no necesita saber que el
 * destino cambió. Esa es la razón por la que RSStore se diseñó async
 * desde el día uno, aunque localStorage fuera síncrono.
 * ============================================================
 */

window.RSStore = (() => {
  // Proyecto real (2026-07-12). SUPABASE_ANON_KEY es la clave pública
  // ("publishable key" en la nomenclatura nueva de Supabase, antes
  // llamada "anon key") — está diseñada para vivir en código de
  // cliente, la seguridad real la dan las políticas de RLS (ver
  // supabase/02_policies.sql), NO el secreto de la clave. NUNCA poner
  // acá la "service_role"/"secret key".
  const SUPABASE_URL = "https://oilfbkzzussozisjmemw.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_9f6zu5ZlxGt0d4o1ifFFFg_C85X2B9j";

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
      // "Acceso al Portal" — de solo lectura acá; los escribe
      // exclusivamente la Edge Function manage-client-access, nunca
      // save() (clientToRow() no los incluye a propósito).
      portalEmail: row.portal_email || null,
      portalUserId: row.portal_user_id || null,
      portalAccessStatus: row.portal_access_status || "sin_invitar",
      _id: row.id, // uso interno (save necesita el uuid) — no lo lee render.js
      _slug: row.slug, // uso interno (selector de clientes) — no lo lee render.js
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

  // ---- Auth — reemplaza al gate de contraseña plana de admin.js ----
  // admin.js no sabe (ni necesita saber) que esto es Supabase — solo
  // llama a estos 3 métodos, igual que hace con load/save/hydrate.

  function signIn(email, password) {
    return client()
      .auth.signInWithPassword({ email, password })
      .then(({ data, error }) => {
        if (error) {
          console.warn("RSStore (Supabase): login fallido.", error.message);
          return false;
        }
        return !!data.session;
      })
      .catch((e) => {
        console.warn("RSStore (Supabase): login fallido.", e);
        return false;
      });
  }

  function signOut() {
    try {
      return client().auth.signOut().catch(() => {});
    } catch (e) {
      return Promise.resolve();
    }
  }

  function getSession() {
    try {
      return client()
        .auth.getSession()
        .then(({ data }) => !!(data && data.session))
        .catch(() => false);
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  // getSession() solo dice "¿hay una sesión?" — no alcanza para decidir
  // modo admin, porque un CLIENTE logueado (profiles.role='client')
  // también tiene una sesión válida. Esta función es la que realmente
  // importa para el gate de admin: ¿esta sesión es de un admin?
  function isCurrentUserAdmin() {
    try {
      return client()
        .auth.getUser()
        .then(({ data }) => {
          if (!data || !data.user) return false;
          return client()
            .from("profiles")
            .select("role")
            .eq("id", data.user.id)
            .single()
            .then(({ data: profile }) => !!profile && profile.role === "admin")
            .catch(() => false);
        })
        .catch(() => false);
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  // ---- "Acceso al Portal" + Dashboard ReelSupra ----

  // Lista para el selector de clientes y el Dashboard — trae también
  // el estado de acceso (para mostrarlo sin un round-trip extra por
  // cliente), pero no listas/jsonb pesados.
  function listClients() {
    return client()
      .from("clients")
      .select("id, slug, name, portal_email, portal_user_id, portal_access_status")
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (error) throw error;
        return data || [];
      });
  }

  // Lista liviana de TODOS los proyectos, para el Dashboard — a
  // propósito sin los campos jsonb pesados (goals/roadmap/etc): con
  // cientos de clientes, traer todo el contenido de todos los
  // proyectos solo para listarlos sería desperdiciar ancho de banda.
  function listProjectsLight() {
    return client()
      .from("projects")
      .select("id, slug, name, client_id, status")
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (error) throw error;
        return data || [];
      });
  }

  // Crear un cliente nuevo desde el Dashboard — defaults vacíos,
  // mismo shape que espera rowToClient()/render.js.
  function createClient({ name, slug }) {
    return client()
      .from("clients")
      .insert({
        slug,
        name,
        theme: {},
        welcome_message: "",
        hero_slides: [],
        announcement: { active: false, text: "" },
      })
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        return rowToClient(data);
      });
  }

  // Crear un proyecto nuevo ya asociado a un cliente — defaults
  // vacíos, mismo shape que espera rowToProject()/render.js.
  function createProject(clientId, { name, slug }) {
    return client()
      .from("projects")
      .insert({
        client_id: clientId,
        slug,
        name,
        goals: [], roadmap: [], content_pieces: [], next_steps: [],
        pending_material: [], resources: [], documents: [], links: [],
        calendar: [], bitacora: [], upsells: [], hero_slides: [], blocks: [],
      })
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        return rowToProject(data);
      });
  }

  // Sube una imagen a Storage y devuelve la URL pública — reemplaza el
  // guardado en base64 dentro de CLIENT_DATA (ver supabase/03_storage.sql).
  // bucket: "logos" | "covers" | "documents" | "media". path: único
  // (admin.js le agrega Date.now() para evitar colisiones de caché).
  function uploadImage(bucket, path, blob, contentType) {
    return client()
      .storage.from(bucket)
      .upload(path, blob, { upsert: true, contentType })
      .then(({ error }) => {
        if (error) throw error;
        const { data } = client().storage.from(bucket).getPublicUrl(path);
        return data.publicUrl;
      });
  }

  // Invitar/reenviar/restaurar/revocar/cambiar email — todas pasan por
  // la Edge Function (única pieza con la service_role key). No hay
  // "no autorizado" silencioso: si la función devuelve ok:false, se
  // propaga el motivo tal cual para mostrarlo en el toast.
  function manageAccess(action, clientId, email) {
    return client()
      .functions.invoke("manage-client-access", { body: { action, clientId, email } })
      .then(({ data, error }) => {
        if (error) throw error;
        if (!data || !data.ok) throw new Error((data && data.error) || "No se pudo completar la acción.");
        return data; // { ok, portalEmail, portalAccessStatus }
      });
  }

  return {
    load, save, clear, hydrate,
    signIn, signOut, getSession, isCurrentUserAdmin,
    listClients, listProjectsLight, createClient, createProject, manageAccess, uploadImage,
  };
})();
