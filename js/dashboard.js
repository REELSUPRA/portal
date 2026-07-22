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

  function renderClientCard(clientRow, projects) {
    const card = document.createElement("div");
    card.className = "dashboard-card" + (clientRow.archived ? " dashboard-card--archived" : "");

    const header = document.createElement("div");
    header.className = "dashboard-card__header";
    header.innerHTML = `
      <div class="dashboard-card__title">
        ${clientRow.name}
        ${clientRow.archived ? `<span class="dashboard-badge dashboard-badge--archived">Archivado</span>` : ""}
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
