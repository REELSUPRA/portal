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
      // "market" (supabase/08_project_market.sql) puede no estar
      // aplicada todavía — select("*") no falla por una columna de
      // menos, así que esto es seguro incluso antes de esa migración.
      market: row.market,
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
      // "deliverables" (supabase/09_project_deliverables.sql) puede no
      // estar aplicada todavía — mismo caso que "market", select("*")
      // no falla por una columna de menos.
      deliverables: row.deliverables || [],
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
      market: project.market,
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
      deliverables: project.deliverables || [],
      hero_slides: project.heroSlides || [],
      blocks: project.blocks || [],
    };
  }

  // ---- interfaz pública, igual a js/store.js ----

  // Agencia + un cliente (por slug o por id) + todos sus proyectos —
  // misma forma que necesitan tanto load() (index.html, ya sabe el
  // slug) como loadProjectPortal() (project.html, solo sabe el
  // client_id de su propio proyecto). Único lugar que arma este bundle,
  // para no duplicar la lógica entre los dos.
  function fetchClientBundle({ slug, id }) {
    const clientQuery = slug
      ? client().from("clients").select("*").eq("slug", slug).single()
      : client().from("clients").select("*").eq("id", id).single();

    return Promise.all([
      client().from("agency_settings").select("*").eq("id", true).single(),
      clientQuery,
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

  // index.html: el slug ya se resolvió antes (ver resolveClientAccess()
  // más abajo), sea por ?client=<slug> o por la sesión del cliente.
  function load(slug) {
    return fetchClientBundle({ slug });
  }

  // project.html: no necesita (ni adivina) el slug del cliente — busca
  // el proyecto por su propio slug, y de ahí sale el client_id real.
  // Antes de esto, project.html dependía de un ?client=<slug> que los
  // links del Dashboard nunca mandaban — con un solo cliente real pasaba
  // desapercibido, con más de uno mostraba el proyecto equivocado.
  function loadProjectPortal(projectSlug) {
    return client()
      .from("projects")
      .select("client_id")
      .eq("slug", projectSlug)
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        return fetchClientBundle({ id: data.client_id });
      });
  }

  // Columnas de projects que pueden no estar aplicadas todavía en este
  // proyecto de Supabase (migraciones escritas, no ejecutadas — ver
  // 08_project_market.sql / 09_project_deliverables.sql). No hay que
  // romper el guardado de TODO el proyecto (nombre, bloques, listas,
  // etc.) por una de estas columnas de menos: si el update/insert falla
  // específicamente por eso, upsertProjectRow() reintenta sin la que
  // falte, una por una, hasta que funcione o no queden candidatas —
  // mismo patrón que listClients()/"archived", generalizado porque
  // ahora puede faltar más de una a la vez.
  //
  // Dos códigos de error distintos para "columna inexistente", según
  // el camino que toma PostgREST — confirmado contra el proyecto real
  // antes de asumir cuál era (bug real: el código original solo
  // contemplaba 42703 y por eso NINGÚN guardado de proyecto funcionaba
  // mientras faltaran estas columnas):
  //   - 42703: error crudo de Postgres — ocurre cuando una columna
  //     nombrada en un SELECT no existe (ver listClients()).
  //   - PGRST204: PostgREST la detecta ANTES de llegar a Postgres,
  //     validando el body de un INSERT/UPDATE contra su schema cache —
  //     es el código real para este caso (guardar un proyecto).
  const MISSING_COLUMN_ERROR_CODES = ["42703", "PGRST204"];
  const OPTIONAL_PROJECT_COLUMNS = ["market", "deliverables"];

  // .select().single() siempre encadenado: save() no usa la fila
  // devuelta (solo mira .error), pero createProject() sí la necesita
  // para devolver el proyecto recién creado — reutiliza esta misma
  // función en vez de duplicar el insert + la lógica de reintento.
  function upsertProjectRow(row, existingId, remainingOptional = OPTIONAL_PROJECT_COLUMNS) {
    const query = existingId
      ? client().from("projects").update(row).eq("id", existingId).select().single()
      : client().from("projects").insert(row).select().single();
    return query.then((res) => {
      if (res.error && MISSING_COLUMN_ERROR_CODES.includes(res.error.code) && remainingOptional.length) {
        const [drop, ...rest] = remainingOptional;
        if (!(drop in row)) return upsertProjectRow(row, existingId, rest);
        const { [drop]: _omit, ...rowWithoutDrop } = row;
        return upsertProjectRow(rowWithoutDrop, existingId, rest);
      }
      return res;
    });
  }

  function save(data) {
    const clientId = data.client._id; // seteado por hydrate() al cargar
    if (!clientId) {
      return Promise.resolve(false); // no debería pasar si hydrate() corrió antes
    }

    // data.client._slug (rowToClient) en vez de recomputar el slug por
    // URL/sesión — así save() no depende de cómo se llegó a esta página.
    const clientRow = clientToRow(data.client, data.client._slug, data.announcement);

    const updateClient = client().from("clients").update(clientRow).eq("id", clientId);

    const upsertProjects = Promise.all(
      (data.projects || []).map((p) => upsertProjectRow(projectToRow(p, clientId), p._id))
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

  // Recibe la promesa de carga ya armada (RSStore.load(slug) o
  // RSStore.loadProjectPortal(id)) en vez de decidir acá qué cargar —
  // así el mismo try/catch + fallback a data.js sirve para index.html
  // y project.html por igual.
  function hydrate(loadPromise) {
    return loadPromise
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
  // cliente) y "archived" (para el toggle "Ver archivados"), pero no
  // listas/jsonb pesados.
  //
  // "archived" (supabase/07_client_archive.sql) puede no estar aplicada
  // todavía en este proyecto de Supabase — no hay que bloquear TODO el
  // Dashboard (ni ocultar a los clientes reales) por una columna que
  // todavía no existe. Si el select falla específicamente por eso
  // (42703 = "column does not exist" en Postgres), reintenta sin esa
  // columna y asume archived=false para todos — exactamente lo que
  // significa "ninguno está archivado todavía".
  function listClients() {
    return client()
      .from("clients")
      .select("id, slug, name, portal_email, portal_user_id, portal_access_status, archived")
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          if (error.code === "42703") return listClientsWithoutArchivedColumn();
          throw error;
        }
        return data || [];
      });
  }

  function listClientsWithoutArchivedColumn() {
    return client()
      .from("clients")
      .select("id, slug, name, portal_email, portal_user_id, portal_access_status")
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (error) throw error;
        return (data || []).map((row) => ({ ...row, archived: false }));
      });
  }

  // Lista liviana de TODOS los proyectos, para el Dashboard — a
  // propósito sin los campos jsonb más pesados (goals/roadmap/
  // resources/documents/links/upsells/deliverables/blocks/hero_slides):
  // con cientos de clientes, traer TODO el contenido de todos los
  // proyectos solo para listarlos sería desperdiciar ancho de banda.
  //
  // content_pieces/calendar/bitacora SÍ se incluyen — alimentan el feed
  // de "qué necesita atención" del Dashboard (piezas atrasadas/próximas,
  // reuniones próximas, actividad reciente), calculado en dashboard.js
  // sobre esta misma consulta en vez de agregar una segunda. A la
  // escala actual (2 clientes) es gratis; si "cientos de clientes"
  // lo vuelve pesado en el futuro, la evolución natural es resolver
  // esto con una vista/función SQL — no hace falta construirla ahora.
  function listProjectsLight() {
    return client()
      .from("projects")
      .select("id, slug, name, client_id, status, content_pieces, calendar, bitacora")
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

  // Editar los campos básicos de un cliente desde el Dashboard (nombre,
  // slug, emoji de saludo) — un update liviano, separado de save(),
  // porque el modal del Dashboard no carga (ni necesita) el resto del
  // objeto CLIENT_DATA (tema, portada, proyectos, etc.).
  function updateClientBasic(clientId, { name, slug, greeting_emoji }) {
    return client()
      .from("clients")
      .update({ name, slug, greeting_emoji })
      .eq("id", clientId)
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        return rowToClient(data);
      });
  }

  // Archivar/restaurar un cliente desde el Dashboard — solo lo oculta
  // de la lista activa (ver supabase/07_client_archive.sql); no toca
  // RLS ni el acceso al portal del cliente.
  function setClientArchived(clientId, archived) {
    return client()
      .from("clients")
      .update({ archived })
      .eq("id", clientId)
      .then(({ error }) => {
        if (error) throw error;
        return true;
      });
  }

  // Crear un proyecto nuevo ya asociado a un cliente. goals/roadmap/
  // nextSteps/upsells/deliverables/blocks son opcionales — los llena
  // un preset resuelto (RS.resolveProjectPreset(), Fase 3) cuando
  // corresponde; sin preset, siguen vacíos exactamente como antes.
  // Nunca completa sector/audience/language/market/resources/
  // documents/links/calendar/bitacora/contentPieces/pendingMaterial —
  // esos parámetros ni existen acá, quedan 100% manuales como siempre.
  // Reutiliza upsertProjectRow() (no un insert aparte) para heredar el
  // mismo reintento defensivo ante columnas todavía no migradas.
  function createProject(clientId, { name, slug, goals, roadmap, nextSteps, upsells, deliverables, blocks }) {
    const row = {
      client_id: clientId,
      slug,
      name,
      goals: goals || [],
      roadmap: roadmap || [],
      content_pieces: [],
      next_steps: nextSteps || [],
      pending_material: [],
      resources: [],
      documents: [],
      links: [],
      calendar: [],
      bitacora: [],
      upsells: upsells || [],
      deliverables: deliverables || [],
      hero_slides: [],
      blocks: blocks || [],
    };
    return upsertProjectRow(row, null)
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

  // Invitar/crear manualmente/reenviar/restaurar/revocar/cambiar email
  // — todas pasan por la Edge Function (única pieza con la
  // service_role key). No hay "no autorizado" silencioso: si la
  // función devuelve ok:false, se propaga el motivo tal cual para
  // mostrarlo en el toast. `password` solo aplica a "create_manual".
  function manageAccess(action, clientId, email, password) {
    return client()
      .functions.invoke("manage-client-access", { body: { action, clientId, email, password } })
      .then(({ data, error }) => {
        if (error) throw error;
        if (!data || !data.ok) throw new Error((data && data.error) || "No se pudo completar la acción.");
        return data; // { ok, portalEmail, portalAccessStatus }
      });
  }

  // Para el login genérico (index.html/project.html): además de "es
  // admin", un cliente logueado necesita saber A QUÉ portal entrar —
  // no alcanza con "hay sesión", hace falta el slug de SU cliente.
  function getCurrentUserAccess() {
    return client()
      .auth.getUser()
      .then(({ data }) => {
        if (!data || !data.user) return { role: null };
        return client()
          .from("profiles")
          .select("role, client_id")
          .eq("id", data.user.id)
          .single()
          .then(({ data: profile }) => {
            if (!profile) return { role: null };
            if (profile.role === "admin") return { role: "admin" };
            if (profile.role === "client" && profile.client_id) {
              return client()
                .from("clients")
                .select("slug")
                .eq("id", profile.client_id)
                .single()
                .then(({ data: clientRow }) => ({
                  role: "client",
                  slug: clientRow ? clientRow.slug : null,
                }));
            }
            return { role: profile.role || null };
          })
          .catch(() => ({ role: null }));
      })
      .catch(() => ({ role: null }));
  }

  // Puerta única (Fase 2, Parte F): index.html ya no depende de
  // ?client=<slug> para el caso normal. Si viene explícito en la URL
  // (links internos del Dashboard: "Entrar"/"Vista previa"), se
  // respeta tal cual; si no, se resuelve por sesión — admin, cliente
  // (con su slug) o nadie (visitante anónimo, sin sesión).
  function resolveClientAccess() {
    const explicitSlug = new URLSearchParams(window.location.search).get("client");
    if (explicitSlug) return Promise.resolve({ role: null, slug: explicitSlug });
    return getCurrentUserAccess();
  }

  return {
    load, loadProjectPortal, save, clear, hydrate,
    signIn, signOut, getSession, isCurrentUserAdmin, getCurrentUserAccess, resolveClientAccess,
    listClients, listProjectsLight, createClient, createProject, manageAccess, uploadImage,
    updateClientBasic, setClientArchived,
  };
})();
