/**
 * ============================================================
 * REELSUPRA — DASHBOARD (punto de entrada del admin)
 * ============================================================
 * No es un editor de contenido nuevo: lista clientes/proyectos y deja
 * "Entrar" al editor de siempre (index.html/project.html?admin=true).
 * Reutiliza RSStore (datos), RS (íconos) y RSAdmin (login, toasts,
 * Acceso al Portal) tal cual — cero lógica de admin duplicada acá.
 * ============================================================
 */

(() => {
  function slugify(text) {
    return (text || "")
      .toString()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  const gateEl = document.getElementById("loginGate");
  const appEl = document.getElementById("app");
  const listEl = document.getElementById("clientList");

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

  // Slug duplicado (23505 = unique_violation en Postgres) es el único
  // error esperable en uso normal — el resto de errores no correspondía
  // adivinarlos, se muestra el mensaje real.
  function friendlyCreateError(e) {
    if (e && e.code === "23505") return "Ese slug ya existe — probá con otro.";
    return (e && e.message) || "No se pudo completar la acción";
  }

  function createClientFlow() {
    const name = window.prompt("Nombre del cliente nuevo:");
    if (!name) return;
    const slug = window.prompt("Slug para la URL (sin espacios ni acentos):", slugify(name));
    if (!slug) return;
    RSStore.createClient({ name, slug: slugify(slug) })
      .then(() => { RSAdmin.showToast("Cliente creado"); loadDashboard(); })
      .catch((e) => RSAdmin.showToast(friendlyCreateError(e), "error"));
  }

  function createProjectFlow(clientId, clientName) {
    const name = window.prompt(`Nombre del proyecto nuevo para ${clientName}:`);
    if (!name) return;
    const slug = window.prompt("Slug para la URL (sin espacios ni acentos):", slugify(name));
    if (!slug) return;
    RSStore.createProject(clientId, { name, slug: slugify(slug) })
      .then(() => { RSAdmin.showToast("Proyecto creado"); loadDashboard(); })
      .catch((e) => RSAdmin.showToast(friendlyCreateError(e), "error"));
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
    card.className = "dashboard-card";

    const header = document.createElement("div");
    header.className = "dashboard-card__header";
    header.innerHTML = `
      <div class="dashboard-card__title">${clientRow.name}</div>
      <a class="btn btn--ghost" href="index.html?client=${encodeURIComponent(clientRow.slug)}&admin=true">${RS.icon("arrow-right")} Entrar</a>`;
    card.appendChild(header);

    card.appendChild(RSAdmin.buildPortalAccessSection(toAccessData(clientRow), loadDashboard));

    const projectsWrap = document.createElement("div");
    projectsWrap.className = "dashboard-card__projects";
    projects.forEach((p) => {
      const row = document.createElement("a");
      row.className = "dashboard-project-row";
      row.href = `project.html?project=${encodeURIComponent(p.slug)}&admin=true`;
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

  function loadDashboard() {
    listEl.innerHTML = `<p class="dashboard-loading">Cargando…</p>`;
    Promise.all([RSStore.listClients(), RSStore.listProjectsLight()])
      .then(([clients, projects]) => {
        listEl.innerHTML = "";
        if (!clients.length) {
          listEl.innerHTML = `<p class="dashboard-loading">Todavía no hay clientes — creá el primero con "Nuevo cliente".</p>`;
          return;
        }
        clients.forEach((c) => {
          const ownProjects = projects.filter((p) => p.client_id === c.id);
          listEl.appendChild(renderClientCard(c, ownProjects));
        });
        RS.hydrateIcons();
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

  RSStore.getSession().then((hasSession) => {
    if (hasSession) showApp();
    else login();
  });
})();
