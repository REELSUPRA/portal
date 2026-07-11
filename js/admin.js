/**
 * ============================================================
 * REELSUPRA — MODO ADMINISTRADOR
 * ============================================================
 * No persiste en una base de datos: los cambios viven en memoria
 * del navegador (y en sessionStorage solo para recordar si el
 * modo admin está activo mientras navegás entre páginas). Para
 * dejarlos permanentes, usar "Exportar JSON" y reemplazar el
 * contenido de js/data.js.
 *
 * Se activa con:
 *   - ?admin=true en la URL
 *   - /admin en la ruta (Netlify redirige /admin -> index.html)
 *   - Ctrl/Cmd + Shift + A en cualquier momento
 *
 * En modo administrador, sobre la página de un proyecto, además:
 *   - Los bloques (Objetivos, Roadmap, Calendario, etc.) se
 *     pueden arrastrar para reordenarlos. El orden se guarda
 *     por proyecto — no afecta a otros clientes.
 *   - Cada bloque tiene un ícono de ojo para ocultarlo/mostrarlo
 *     al cliente, sin borrar los datos.
 *   - Las "Piezas de contenido" se editan haciendo clic en el
 *     numerito correspondiente (título, fecha, link, nota).
 *   - El logo del proyecto se cambia haciendo clic en el ícono
 *     que aparece sobre el emoji/logo, en el encabezado.
 * ============================================================
 */

(function () {

  let panelEl, overlayEl, toastEl, pieceModalEl, logoModalEl;
  let isBuilt = false;
  let draggedBlockId = null;

  /* ---------------------------------------------------------- */
  /* Estado del modo admin (persistido solo en esta sesión)     */
  /* ---------------------------------------------------------- */

  function readAdminModeFlag() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "true") return true;
    if (window.location.pathname.replace(/\/$/, "").endsWith("/admin")) return true;
    return sessionStorage.getItem("rsAdminMode") === "true";
  }

  function setAdminMode(value) {
    window.RS_ADMIN_MODE = value;
    sessionStorage.setItem("rsAdminMode", value ? "true" : "false");
  }

  function toggleAdminMode() {
    setAdminMode(!window.RS_ADMIN_MODE);
    refreshPage();
    if (window.RS_ADMIN_MODE) {
      showToast("Modo administrador activado");
      if (document.getElementById("blocksContainer")) initBlockDragDrop();
    } else {
      showToast("Modo administrador desactivado");
    }
  }

  function refreshPage() {
    RS.renderTopbar({ showBack: !!document.getElementById("projectHero") });
    if (document.getElementById("hero")) { RS.renderHero(); RS.renderProjectGrid(); }
    if (document.getElementById("projectHero")) RS.renderProjectDetail();
    RS.renderAnnouncement();
    RS.hydrateIcons();
    bindProjectPageEvents();
  }

  /* ---------------------------------------------------------- */
  /* Toast + helpers de formulario                               */
  /* ---------------------------------------------------------- */

  function ensureToast() {
    if (toastEl) return;
    toastEl = document.createElement("div");
    toastEl.className = "admin-toast";
    document.body.appendChild(toastEl);
  }

  function showToast(message) {
    ensureToast();
    toastEl.textContent = message;
    toastEl.classList.add("is-visible");
    setTimeout(() => toastEl.classList.remove("is-visible"), 2200);
  }

  function field(labelText, value, onChange, multiline = false, type = "text") {
    const wrap = document.createElement("div");
    wrap.className = "admin-field";
    const label = document.createElement("label");
    label.textContent = labelText;
    wrap.appendChild(label);
    const input = document.createElement(multiline ? "textarea" : "input");
    if (!multiline) input.type = type;
    else input.rows = 3;
    input.value = value || "";
    input.addEventListener("input", (e) => onChange(e.target.value));
    wrap.appendChild(input);
    return wrap;
  }

  function checkboxField(labelText, checked, onChange) {
    const wrap = document.createElement("label");
    wrap.className = "admin-checkbox-field";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!checked;
    input.addEventListener("change", (e) => onChange(e.target.checked));
    wrap.appendChild(input);
    wrap.appendChild(document.createTextNode(labelText));
    return wrap;
  }

  function groupTitle(text) {
    const h = document.createElement("div");
    h.className = "admin-group-title";
    h.textContent = text;
    return h;
  }

  /* ---------------------------------------------------------- */
  /* Panel lateral (textos básicos)                               */
  /* ---------------------------------------------------------- */

  function buildPanel() {
    const data = window.CLIENT_DATA;

    overlayEl = document.createElement("div");
    overlayEl.className = "admin-overlay";
    overlayEl.addEventListener("click", closePanel);

    panelEl = document.createElement("div");
    panelEl.className = "admin-panel";
    panelEl.innerHTML = `
      <div class="admin-panel__header">
        <div class="admin-panel__title">${RS.icon("settings")} Modo administrador</div>
        <button class="admin-panel__close" aria-label="Cerrar">${RS.icon("x")}</button>
      </div>
      <div class="admin-panel__body" id="adminBody"></div>
      <div class="admin-panel__footer">
        <button class="btn btn--ghost" id="adminExport">${RS.icon("download")} Exportar JSON</button>
        <button class="btn btn--primary" id="adminApply">${RS.icon("check")} Aplicar cambios</button>
      </div>`;

    document.body.appendChild(overlayEl);
    document.body.appendChild(panelEl);
    ensureToast();

    panelEl.querySelector(".admin-panel__close").addEventListener("click", closePanel);
    panelEl.querySelector("#adminExport").addEventListener("click", exportJSON);
    panelEl.querySelector("#adminApply").addEventListener("click", () => {
      refreshPage();
      showToast("Cambios aplicados en esta sesión");
    });

    const body = panelEl.querySelector("#adminBody");
    body.appendChild(groupTitle("Cliente"));
    body.appendChild(field("Nombre del cliente", data.client.name, (v) => (data.client.name = v)));
    body.appendChild(field("Mensaje de bienvenida", data.client.welcomeMessage, (v) => (data.client.welcomeMessage = v), true));

    body.appendChild(groupTitle("Aviso superior"));
    body.appendChild(checkboxField("Mostrar aviso al cliente", data.announcement.active, (v) => (data.announcement.active = v)));
    body.appendChild(field("Texto del aviso", data.announcement.text, (v) => (data.announcement.text = v), true));

    data.projects.forEach((p, i) => {
      body.appendChild(groupTitle(`Proyecto ${i + 1} — ${p.name}`));
      body.appendChild(field("Nombre del proyecto", p.name, (v) => (p.name = v)));
      body.appendChild(field("Estado (texto visible)", p.status, (v) => (p.status = v)));
      body.appendChild(field("Objetivo", p.objective, (v) => (p.objective = v), true));
    });

    const hint = document.createElement("p");
    hint.style.cssText = "font-size:12.5px;color:var(--rs-gray-300);line-height:1.6;margin-top:var(--space-4);";
    hint.textContent = "Para editar piezas de contenido, logo, y orden de los bloques, hacelo directamente sobre la página del proyecto — no hace falta este panel.";
    body.appendChild(hint);

    isBuilt = true;
  }

  function exportJSON() {
    const json = JSON.stringify(window.CLIENT_DATA, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "client-data-export.json";
    a.click();
    URL.revokeObjectURL(url);
    showToast("JSON exportado — reemplazá el objeto en js/data.js");
  }

  function openPanel() {
    if (!isBuilt) buildPanel();
    overlayEl.classList.add("is-open");
    panelEl.classList.add("is-open");
  }

  function closePanel() {
    if (!panelEl) return;
    overlayEl.classList.remove("is-open");
    panelEl.classList.remove("is-open");
  }

  /* ---------------------------------------------------------- */
  /* Arrastrar bloques (solo en project.html, en modo admin)     */
  /* ---------------------------------------------------------- */

  function currentProject() {
    return RS.getProjectFromURL();
  }

  function initBlockDragDrop() {
    const container = document.getElementById("blocksContainer");
    if (!container || container.dataset.dndBound) return;
    container.dataset.dndBound = "true";

    let lastMouseDownTarget = null;
    container.addEventListener("mousedown", (e) => { lastMouseDownTarget = e.target; });

    container.addEventListener("dragstart", (e) => {
      const card = e.target.closest(".block-card");
      if (!card) return;
      // Solo permitir arrastrar si el gesto empezó en el ícono de agarre —
      // así un clic en un botón o en una pieza de contenido nunca arrastra.
      if (!lastMouseDownTarget || !lastMouseDownTarget.closest(".drag-handle")) {
        e.preventDefault();
        return;
      }
      draggedBlockId = card.dataset.blockId;
      e.dataTransfer.effectAllowed = "move";
    });

    container.addEventListener("dragover", (e) => {
      const card = e.target.closest(".block-card");
      if (!card || card.dataset.blockId === draggedBlockId) return;
      e.preventDefault();
      card.classList.add("block-card--drag-over");
    });

    container.addEventListener("dragleave", (e) => {
      const card = e.target.closest(".block-card");
      if (card) card.classList.remove("block-card--drag-over");
    });

    container.addEventListener("drop", (e) => {
      const card = e.target.closest(".block-card");
      if (!card) return;
      e.preventDefault();
      card.classList.remove("block-card--drag-over");
      const targetId = card.dataset.blockId;
      if (!draggedBlockId || targetId === draggedBlockId) return;
      reorderBlocks(draggedBlockId, targetId);
      draggedBlockId = null;
    });

    // Toggle de visibilidad de bloque
    container.addEventListener("click", (e) => {
      const toggleBtn = e.target.closest("[data-toggle-block]");
      if (toggleBtn) {
        toggleBlockVisibility(toggleBtn.dataset.toggleBlock);
        return;
      }
      const pieceEl = e.target.closest("[data-admin-edit-piece]");
      if (pieceEl) {
        openPieceEditor(pieceEl.dataset.adminEditPiece);
      }
    });

    // Navegación de calendario (funciona con o sin admin)
    container.addEventListener("click", (e) => {
      const navBtn = e.target.closest("[data-cal-nav]");
      if (!navBtn) return;
      const val = navBtn.dataset.calNav;
      RS.navigateCalendar(val === "today" ? "today" : parseInt(val, 10));
      bindProjectPageEvents();
    });
  }

  function reorderBlocks(draggedId, targetId) {
    const project = currentProject();
    const blocks = project.blocks;
    const fromIdx = blocks.findIndex((b) => b.id === draggedId);
    const toIdx = blocks.findIndex((b) => b.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = blocks.splice(fromIdx, 1);
    blocks.splice(toIdx, 0, moved);
    RS.renderProjectDetail();
    showToast("Orden actualizado para este proyecto");
  }

  function toggleBlockVisibility(blockId) {
    const project = currentProject();
    const block = project.blocks.find((b) => b.id === blockId);
    if (!block) return;
    block.visible = !block.visible;
    RS.renderProjectDetail();
  }

  /* ---------------------------------------------------------- */
  /* Editor de pieza de contenido (modal)                        */
  /* ---------------------------------------------------------- */

  function ensurePieceModal() {
    if (pieceModalEl) return;
    pieceModalEl = document.createElement("div");
    pieceModalEl.className = "piece-modal-overlay";
    pieceModalEl.innerHTML = `<div class="piece-modal">
      <div class="admin-panel__header">
        <div class="admin-panel__title">${RS.icon("film")} Editar pieza de contenido</div>
        <button class="admin-panel__close" id="pieceModalClose">${RS.icon("x")}</button>
      </div>
      <div class="admin-panel__body" id="pieceModalBody"></div>
      <div class="admin-panel__footer">
        <button class="btn btn--primary" id="pieceModalSave" style="width:100%; justify-content:center;">${RS.icon("check")} Guardar</button>
      </div>
    </div>`;
    document.body.appendChild(pieceModalEl);
    pieceModalEl.addEventListener("click", (e) => { if (e.target === pieceModalEl) closePieceModal(); });
    pieceModalEl.querySelector("#pieceModalClose").addEventListener("click", closePieceModal);
  }

  function openPieceEditor(pieceId) {
    ensurePieceModal();
    const project = currentProject();
    const piece = (project.contentPieces || []).find((p) => p.id === pieceId);
    if (!piece) return;

    const body = pieceModalEl.querySelector("#pieceModalBody");
    body.innerHTML = "";
    body.appendChild(field("Título del video", piece.title, (v) => (piece.title = v)));

    const statusWrap = document.createElement("div");
    statusWrap.className = "admin-field";
    statusWrap.innerHTML = `<label>Estado</label>`;
    const select = document.createElement("select");
    select.innerHTML = `<option value="pending">Pendiente</option><option value="delivered">Entregada</option>`;
    select.value = piece.status;
    select.addEventListener("change", (e) => (piece.status = e.target.value));
    statusWrap.appendChild(select);
    body.appendChild(statusWrap);

    body.appendChild(field("Fecha sugerida de publicación", piece.publishDate, (v) => (piece.publishDate = v), false, "date"));
    body.appendChild(field("Link al video (Drive, etc.)", piece.videoUrl, (v) => (piece.videoUrl = v)));
    body.appendChild(field("Nota para el cliente", piece.note, (v) => (piece.note = v), true));

    const note = document.createElement("p");
    note.style.cssText = "font-size:12px;color:var(--rs-gray-300);line-height:1.6;";
    note.textContent = "La fecha se refleja sola en el módulo Calendario — no hace falta cargarla ahí también.";
    body.appendChild(note);

    pieceModalEl.querySelector("#pieceModalSave").onclick = () => {
      closePieceModal();
      RS.renderProjectDetail();
      showToast("Pieza actualizada");
    };

    pieceModalEl.classList.add("is-open");
    RS.hydrateIcons();
  }

  function closePieceModal() {
    if (pieceModalEl) pieceModalEl.classList.remove("is-open");
  }

  /* ---------------------------------------------------------- */
  /* Logo del proyecto                                            */
  /* ---------------------------------------------------------- */

  function ensureLogoModal() {
    if (logoModalEl) return;
    logoModalEl = document.createElement("div");
    logoModalEl.className = "piece-modal-overlay";
    logoModalEl.innerHTML = `<div class="piece-modal">
      <div class="admin-panel__header">
        <div class="admin-panel__title">${RS.icon("image-plus")} Logo del proyecto</div>
        <button class="admin-panel__close" id="logoModalClose">${RS.icon("x")}</button>
      </div>
      <div class="admin-panel__body">
        <div class="admin-field">
          <label>Subir imagen (PNG o JPG, ideal cuadrada)</label>
          <input type="file" id="logoFileInput" accept="image/*" />
        </div>
        <div class="admin-field">
          <label>O pegar una URL de imagen</label>
          <input type="text" id="logoUrlInput" placeholder="https://..." />
        </div>
        <button class="btn btn--ghost" id="logoRemoveBtn" style="width:100%; justify-content:center;">${RS.icon("trash-2")} Quitar logo (volver al emoji)</button>
      </div>
    </div>`;
    document.body.appendChild(logoModalEl);
    logoModalEl.addEventListener("click", (e) => { if (e.target === logoModalEl) closeLogoModal(); });
    logoModalEl.querySelector("#logoModalClose").addEventListener("click", closeLogoModal);

    logoModalEl.querySelector("#logoFileInput").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        currentProject().logoUrl = reader.result;
        RS.renderProjectDetail();
        RS.hydrateIcons();
        closeLogoModal();
        showToast("Logo actualizado");
      };
      reader.readAsDataURL(file);
    });

    logoModalEl.querySelector("#logoUrlInput").addEventListener("change", (e) => {
      if (!e.target.value) return;
      currentProject().logoUrl = e.target.value;
      RS.renderProjectDetail();
      RS.hydrateIcons();
      closeLogoModal();
      showToast("Logo actualizado");
    });

    logoModalEl.querySelector("#logoRemoveBtn").addEventListener("click", () => {
      currentProject().logoUrl = null;
      RS.renderProjectDetail();
      RS.hydrateIcons();
      closeLogoModal();
      showToast("Logo quitado, volviendo al emoji");
    });
  }

  function openLogoModal() {
    ensureLogoModal();
    logoModalEl.classList.add("is-open");
  }

  function closeLogoModal() {
    if (logoModalEl) logoModalEl.classList.remove("is-open");
  }

  /* ---------------------------------------------------------- */
  /* Eventos puntuales que dependen del render actual             */
  /* ---------------------------------------------------------- */

  function bindProjectPageEvents() {
    const logoBtn = document.getElementById("editLogoBtn");
    if (logoBtn && !logoBtn.dataset.bound) {
      logoBtn.dataset.bound = "true";
      logoBtn.addEventListener("click", openLogoModal);
    }
  }

  /* ---------------------------------------------------------- */
  /* Init                                                          */
  /* ---------------------------------------------------------- */

  function init() {
    setAdminMode(readAdminModeFlag());

    // Delegado sobre #topbar (que nunca se reemplaza) en lugar del botón
    // en sí (que se recrea cada vez que se vuelve a dibujar el topbar).
    const topbarEl = document.getElementById("topbar");
    if (topbarEl && !topbarEl.dataset.adminBound) {
      topbarEl.dataset.adminBound = "true";
      topbarEl.addEventListener("click", (e) => {
        if (!e.target.closest("#adminToggle")) return;
        if (!window.RS_ADMIN_MODE) { toggleAdminMode(); openPanel(); }
        else { openPanel(); }
      });
    }

    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (!window.RS_ADMIN_MODE) toggleAdminMode();
        openPanel();
      }
      if (e.key === "Escape") { closePanel(); closePieceModal(); closeLogoModal(); }
    });

    if (document.getElementById("blocksContainer")) initBlockDragDrop();
    bindProjectPageEvents();

    if (window.RS_ADMIN_MODE) refreshPage();
    if (readAdminModeFlag() && new URLSearchParams(window.location.search).get("admin") === "true") openPanel();
  }

  function detectAdminMode() {
    setAdminMode(readAdminModeFlag());
  }

  window.RSAdmin = { init, toggleAdminMode, detectAdminMode };
})();
