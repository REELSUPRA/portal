/**
 * ============================================================
 * REELSUPRA — DASHBOARD (punto de entrada del admin)
 * ============================================================
 * No es un editor de contenido nuevo: lista clientes/proyectos y deja
 * "Entrar" al editor de siempre (index.html/project.html?admin=true).
 * Reutiliza RSStore (datos), RS (íconos) y RSAdmin (login, toasts,
 * Acceso al Portal, modales de cliente/proyecto) tal cual — cero
 * lógica de admin duplicada acá.
 *
 * Fase 2: además de listar y crear, permite buscar, editar (nombre/
 * slug/emoji), archivar/restaurar (solo oculta de esta lista — ver
 * supabase/07_client_archive.sql) y entrar en "Vista previa" (ver el
 * portal exactamente como lo ve el cliente, sin activar el panel
 * admin — ver detectAdminMode() en js/admin.js).
 * ============================================================
 */

(() => {
  const gateEl = document.getElementById("loginGate");
  const appEl = document.getElementById("app");
  const listEl = document.getElementById("clientList");
  const searchInput = document.getElementById("clientSearchInput");
  const showArchivedToggle = document.getElementById("showArchivedToggle");

  // Clientes/proyectos ya traídos de Supabase — buscar y "Ver
  // archivados" filtran sobre esto en memoria, sin ida y vuelta al
  // backend por cada tecla.
  let allClients = [];
  let allProjects = [];

  // Feed de "qué necesita atención" (Fase 3, Módulo 3) — umbrales
  // fáciles de ajustar después de verlo funcionar con datos reales.
  const ATTENTION_SOON_DAYS = 7;
  const ATTENTION_STALE_DAYS = 14;
  const ATTENTION_MAX_ITEMS = 8;

  function showGate() {
    gateEl.style.display = "flex";
    appEl.style.display = "none";
  }

  function showApp() {
    gateEl.style.display = "none";
    appEl.style.display = "block";
    loadDashboard();
  }

  function login() {
    RSAdmin.tryActivateAdmin().then((ok) => {
      if (ok) showApp();
      else showGate();
    });
  }

  function createClientFlow() {
    RSAdmin.openClientFormModal({
      mode: "create",
      onSaved: () => loadDashboard(),
    });
  }

  function editClientFlow(clientRow) {
    RSAdmin.openClientFormModal({
      mode: "edit",
      client: { _id: clientRow.id, name: clientRow.name, slug: clientRow.slug, greetingEmoji: clientRow.greeting_emoji },
      onSaved: () => loadDashboard(),
    });
  }

  function createProjectFlow(clientId, clientName) {
    RSAdmin.openProjectFormModal({
      clientId,
      clientName,
      onSaved: () => loadDashboard(),
    });
  }

  function toggleArchivedFlow(clientRow) {
    const nextArchived = !clientRow.archived;
    const confirmMsg = nextArchived
      ? `¿Archivar "${clientRow.name}"? Se oculta de esta lista (con "Ver archivados" se puede recuperar); el portal del cliente sigue funcionando igual que hoy.`
      : `¿Restaurar "${clientRow.name}" a la lista activa?`;
    if (!window.confirm(confirmMsg)) return;
    RSStore.setClientArchived(clientRow.id, nextArchived)
      .then(() => {
        RSAdmin.showToast(nextArchived ? "Cliente archivado" : "Cliente restaurado");
        loadDashboard();
      })
      .catch((e) => RSAdmin.showToast(e.message || "No se pudo completar la acción", "error"));
  }

  // buildPortalAccessSection() espera el mismo shape camelCase que usa
  // el panel por-cliente (rowToClient) — acá se arma a mano porque
  // listClients() devuelve filas crudas (snake_case), más livianas,
  // pensadas para listar, no para pasar por el mapeo completo.
  function toAccessData(clientRow) {
    return {
      client: {
        _id: clientRow.id,
        portalEmail: clientRow.portal_email,
        portalUserId: clientRow.portal_user_id,
        portalAccessStatus: clientRow.portal_access_status,
      },
    };
  }

  // Días desde la última novedad de bitácora de CUALQUIERA de los
  // proyectos del cliente — reutiliza RS.bitacoraEntries() (ya ordena
  // por fecha) tal cual, solo que juntando todos los proyectos del
  // cliente en vez de uno solo. Un único cálculo, usado tanto por el
  // badge de cada card como por el feed de atención — no hay dos
  // versiones de "cuán reciente es la actividad de este cliente".
  function daysSinceLastActivity(clientRow, projects) {
    const entries = [];
    projects.forEach((p) => RS.bitacoraEntries(p).forEach((e) => entries.push(e)));
    entries.sort((a, b) => b.dateObj - a.dateObj);
    if (!entries.length) return null; // null = nunca hubo actividad
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.floor((today - entries[0].dateObj) / 86400000);
  }

  // Ítems de "necesita atención" para un cliente puntual + sus
  // proyectos — usado por computeAttentionItems() (feed de arriba) y
  // reutilizable si en el futuro se necesita el mismo cálculo en otro
  // lugar (ej. el panel por-cliente).
  function clientAttentionItems(clientRow, projects) {
    const items = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const soon = new Date(today); soon.setDate(soon.getDate() + ATTENTION_SOON_DAYS);

    projects.forEach((p) => {
      (p.content_pieces || []).forEach((piece) => {
        if (piece.status === "delivered" || !piece.publishDate) return;
        const date = new Date(piece.publishDate + "T00:00:00");
        if (Number.isNaN(date.getTime())) return;
        const title = piece.title || "Pieza sin título";
        if (date < today) {
          items.push({ type: "pieza-atrasada", priority: 0, text: `"${title}" está atrasada — ${p.name}`, href: `project.html?id=${encodeURIComponent(p.slug)}&admin=true` });
        } else if (date <= soon) {
          items.push({ type: "pieza-proxima", priority: 1, text: `"${title}" publica pronto — ${p.name}`, href: `project.html?id=${encodeURIComponent(p.slug)}&admin=true` });
        }
      });

      (p.calendar || []).forEach((evt) => {
        const date = new Date(evt.date + "T00:00:00");
        if (Number.isNaN(date.getTime()) || date < today || date > soon) return;
        items.push({ type: "reunion-proxima", priority: 2, text: `${evt.label} — ${p.name}`, href: `project.html?id=${encodeURIComponent(p.slug)}&admin=true` });
      });
    });

    if (clientRow.portal_access_status === "sin_invitar") {
      items.push({ type: "sin-invitar", priority: 3, text: `${clientRow.name} todavía no tiene acceso al portal`, href: `#client-card-${encodeURIComponent(clientRow.slug)}` });
    }

    const days = daysSinceLastActivity(clientRow, projects);
    if (days === null || days >= ATTENTION_STALE_DAYS) {
      const text = days === null
        ? `${clientRow.name} nunca tuvo novedades en la bitácora`
        : `${clientRow.name} sin novedades hace ${days} días`;
      items.push({ type: "sin-actividad", priority: 4, text, href: `#client-card-${encodeURIComponent(clientRow.slug)}` });
    }

    return items;
  }

  // Junta los ítems de todos los clientes (no archivados), ordena por
  // urgencia y listo — se calcula una sola vez por carga del Dashboard,
  // no depende del buscador ni de "Ver archivados".
  function computeAttentionItems(clients, projects) {
    const items = [];
    clients.forEach((c) => {
      if (c.archived) return;
      const ownProjects = projects.filter((p) => p.client_id === c.id);
      clientAttentionItems(c, ownProjects).forEach((item) => items.push(item));
    });
    items.sort((a, b) => a.priority - b.priority);
    return items;
  }

  const ATTENTION_ICONS = {
    "pieza-atrasada": "alert-triangle",
    "pieza-proxima": "clock",
    "reunion-proxima": "calendar",
    "sin-invitar": "user-x",
    "sin-actividad": "moon",
  };

  function renderAttentionFeed(items) {
    const section = document.getElementById("attentionFeed");
    const list = document.getElementById("attentionFeedList");
    if (!items.length) { section.style.display = "none"; return; }
    section.style.display = "";

    const shown = items.slice(0, ATTENTION_MAX_ITEMS);
    list.innerHTML = shown.map((item) => `
      <a class="attention-item attention-item--${item.type}" href="${item.href}">
        ${RS.icon(ATTENTION_ICONS[item.type] || "info")}<span>${RS.esc(item.text)}</span>
      </a>`).join("");

    if (items.length > shown.length) {
      const more = document.createElement("p");
      more.className = "dashboard-loading";
      more.textContent = `+ ${items.length - shown.length} más`;
      list.appendChild(more);
    }
    RS.hydrateIcons();
  }

  function renderClientCard(clientRow, projects) {
    const card = document.createElement("div");
    card.id = `client-card-${clientRow.slug}`;
    card.className = "dashboard-card" + (clientRow.archived ? " dashboard-card--archived" : "");

    // Badge chico de salud — mismo cálculo que alimenta el feed de
    // atención de arriba, no una segunda versión.
    const staleDays = clientRow.archived ? null : daysSinceLastActivity(clientRow, projects);
    const staleBadge = (staleDays === null || staleDays >= ATTENTION_STALE_DAYS) && !clientRow.archived
      ? `<span class="dashboard-badge dashboard-badge--stale">${staleDays === null ? "Sin actividad" : `Sin actividad hace ${staleDays}d`}</span>`
      : "";

    const header = document.createElement("div");
    header.className = "dashboard-card__header";
    header.innerHTML = `
      <div class="dashboard-card__title">
        ${clientRow.name}
        ${clientRow.archived ? `<span class="dashboard-badge dashboard-badge--archived">Archivado</span>` : staleBadge}
      </div>
      <div class="dashboard-card__actions">
        <button class="btn btn--ghost btn--sm" data-action="edit">${RS.icon("pencil")} Editar</button>
        <a class="btn btn--ghost btn--sm" href="index.html?client=${encodeURIComponent(clientRow.slug)}&preview=1">${RS.icon("eye")} Vista previa</a>
        <a class="btn btn--ghost btn--sm" href="index.html?client=${encodeURIComponent(clientRow.slug)}&admin=true">${RS.icon("arrow-right")} Entrar</a>
        <button class="btn btn--ghost btn--sm" data-action="archive">${clientRow.archived ? RS.icon("rotate-ccw") + " Restaurar" : RS.icon("archive") + " Archivar"}</button>
      </div>`;
    header.querySelector('[data-action="edit"]').addEventListener("click", () => editClientFlow(clientRow));
    header.querySelector('[data-action="archive"]').addEventListener("click", () => toggleArchivedFlow(clientRow));
    card.appendChild(header);

    card.appendChild(RSAdmin.buildPortalAccessSection(toAccessData(clientRow), loadDashboard));

    const projectsWrap = document.createElement("div");
    projectsWrap.className = "dashboard-card__projects";
    projects.forEach((p) => {
      const row = document.createElement("a");
      row.className = "dashboard-project-row";
      row.href = `project.html?id=${encodeURIComponent(p.slug)}&admin=true`;
      row.textContent = p.name;
      projectsWrap.appendChild(row);
    });
    const addProjectBtn = document.createElement("button");
    addProjectBtn.type = "button";
    addProjectBtn.className = "admin-link-btn";
    addProjectBtn.textContent = "+ Nuevo proyecto";
    addProjectBtn.addEventListener("click", () => createProjectFlow(clientRow.id, clientRow.name));
    projectsWrap.appendChild(addProjectBtn);
    card.appendChild(projectsWrap);

    return card;
  }

  // Filtra allClients por texto de búsqueda + toggle de archivados, y
  // vuelve a pintar la lista — no golpea el backend de nuevo.
  function renderFilteredList() {
    const query = (searchInput.value || "").trim().toLowerCase();
    const showArchived = showArchivedToggle.checked;

    const visible = allClients.filter((c) => {
      if (!showArchived && c.archived) return false;
      if (!query) return true;
      return c.name.toLowerCase().includes(query) || c.slug.toLowerCase().includes(query);
    });

    listEl.innerHTML = "";
    if (!allClients.length) {
      listEl.innerHTML = `<p class="dashboard-loading">Todavía no hay clientes — creá el primero con "Nuevo cliente".</p>`;
      return;
    }
    if (!visible.length) {
      listEl.innerHTML = `<p class="dashboard-loading">Ningún cliente coincide con la búsqueda.</p>`;
      return;
    }
    visible.forEach((c) => {
      const ownProjects = allProjects.filter((p) => p.client_id === c.id);
      listEl.appendChild(renderClientCard(c, ownProjects));
    });
    RS.hydrateIcons();
  }

  function loadDashboard() {
    listEl.innerHTML = `<p class="dashboard-loading">Cargando…</p>`;
    Promise.all([RSStore.listClients(), RSStore.listProjectsLight()])
      .then(([clients, projects]) => {
        allClients = clients;
        allProjects = projects;
        renderAttentionFeed(computeAttentionItems(allClients, allProjects));
        renderFilteredList();
      })
      .catch((e) => {
        listEl.innerHTML = `<p class="dashboard-loading">No se pudo cargar: ${e.message || e}</p>`;
      });
  }

  document.getElementById("loginGateBtn").addEventListener("click", login);
  document.getElementById("newClientBtn").addEventListener("click", createClientFlow);
  document.getElementById("logoutBtn").addEventListener("click", () => {
    RSStore.signOut().then(showGate);
  });
  searchInput.addEventListener("input", renderFilteredList);
  showArchivedToggle.addEventListener("change", renderFilteredList);

  // Puerta única (Fase 2, Parte F): el Dashboard de la agencia es solo
  // para admins — un cliente logueado (sesión válida, pero no admin)
  // nunca debería quedarse acá, va a su propio Dashboard en index.html.
  RSStore.getSession().then((hasSession) => {
    if (!hasSession) { login(); return; }
    RSStore.isCurrentUserAdmin().then((isAdmin) => {
      if (isAdmin) showApp();
      else window.location.replace("index.html");
    });
  });
})();
