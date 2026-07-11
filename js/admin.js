/**
 * ============================================================
 * REELSUPRA — MODO ADMINISTRADOR
 * ============================================================
 * No hay backend: los cambios se guardan en localStorage de este
 * navegador (vía js/store.js) al tocar "Guardar cambios" — persisten
 * entre visitas en ese mismo dispositivo, pero no se sincronizan a
 * otros. Para que un cambio sea la nueva base para cualquier
 * dispositivo/cliente, usar "Exportar JSON" y reemplazar el
 * contenido de js/data.js.
 *
 * Se activa con:
 *   - ?admin=true en la URL
 *   - /admin en la ruta (Netlify redirige /admin -> index.html)
 *   - Ctrl/Cmd + Shift + A en cualquier momento
 * ...pidiendo antes una contraseña simple (agency.adminPassphrase en
 * data.js). Esto NO es autenticación real — vive en un archivo JS
 * público, cualquiera con conocimientos técnicos puede leerla. Su
 * único objetivo es evitar que un cliente entre por accidente al
 * modo admin, no proteger contra un acceso intencional.
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
 *
 * Cualquier modificación marca el estado como "sin guardar" y muestra
 * una barra inferior con un único botón "Guardar cambios", que
 * persiste todo (vía js/store.js — hoy localStorage) y avisa antes de
 * cerrar la pestaña si hay cambios pendientes.
 * ============================================================
 */

(function () {

  let panelEl, overlayEl, toastEl, pieceModalEl, imageModalEl, saveBarEl;
  let isBuilt = false;
  let draggedBlockId = null;
  let imageModalConfig = null;
  let isDirty = false;

  /* ---------------------------------------------------------- */
  /* Estado del modo admin (persistido solo en esta sesión)     */
  /* ---------------------------------------------------------- */

  function wantsAdminViaUrl() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "true") return true;
    if (window.location.pathname.replace(/\/$/, "").endsWith("/admin")) return true;
    return false;
  }

  function isAuthed() {
    return sessionStorage.getItem("rsAdminAuthed") === "true";
  }

  function setAdminMode(value) {
    window.RS_ADMIN_MODE = value;
    sessionStorage.setItem("rsAdminAuthed", value ? "true" : "false");
  }

  // Gate simple: no es seguridad real, evita el acceso accidental.
  // Si el cliente ya se autenticó en esta sesión de navegador, no
  // vuelve a preguntar.
  function verifyPassphrase() {
    const expected = (window.CLIENT_DATA.agency && window.CLIENT_DATA.agency.adminPassphrase) || "";
    if (!expected) return true;
    const attempt = window.prompt("Contraseña de administrador:");
    if (attempt === expected) return true;
    if (attempt !== null) showToast("Contraseña incorrecta");
    return false;
  }

  function tryActivateAdmin() {
    if (isAuthed()) { setAdminMode(true); return true; }
    if (verifyPassphrase()) { setAdminMode(true); return true; }
    return false;
  }

  function toggleAdminMode() {
    if (window.RS_ADMIN_MODE) {
      setAdminMode(false);
      refreshPage();
      showToast("Modo administrador desactivado");
      return;
    }
    if (!tryActivateAdmin()) return;
    refreshPage();
    showToast("Modo administrador activado");
    if (document.getElementById("blocksContainer")) initBlockDragDrop();
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

  /* ---------------------------------------------------------- */
  /* Cambios sin guardar: barra inferior + guardado centralizado */
  /* ---------------------------------------------------------- */

  function ensureSaveBar() {
    if (saveBarEl) return;
    saveBarEl = document.createElement("div");
    saveBarEl.className = "save-bar";
    saveBarEl.innerHTML = `
      <span class="save-bar__text">${RS.icon("alert-circle")} Tenés cambios sin guardar</span>
      <button class="btn btn--primary" id="saveBarBtn">${RS.icon("check")} Guardar cambios</button>`;
    document.body.appendChild(saveBarEl);
    saveBarEl.querySelector("#saveBarBtn").addEventListener("click", saveChanges);
    RS.hydrateIcons();
  }

  function markDirty() {
    if (isDirty) return;
    isDirty = true;
    ensureSaveBar();
    saveBarEl.classList.add("is-open");
  }

  function saveChanges() {
    RSStore.save(window.CLIENT_DATA).then((ok) => {
      isDirty = false;
      if (saveBarEl) saveBarEl.classList.remove("is-open");
      showToast(ok ? "Cambios guardados" : "No se pudo guardar — probá de nuevo");
    });
  }

  window.addEventListener("beforeunload", (e) => {
    if (!isDirty) return;
    e.preventDefault();
    e.returnValue = "";
  });

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
    input.addEventListener("input", (e) => { onChange(e.target.value); markDirty(); });
    wrap.appendChild(input);
    return wrap;
  }

  function checkboxField(labelText, checked, onChange) {
    const wrap = document.createElement("label");
    wrap.className = "admin-checkbox-field";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!checked;
    input.addEventListener("change", (e) => { onChange(e.target.checked); markDirty(); });
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
    body.appendChild(field("Color principal del portal", data.client.primaryColor || "#e02020", (v) => {
      data.client.primaryColor = v;
      RS.applyTheme();
    }, false, "color"));

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
    markDirty();
    showToast("Orden actualizado para este proyecto");
  }

  function toggleBlockVisibility(blockId) {
    const project = currentProject();
    const block = project.blocks.find((b) => b.id === blockId);
    if (!block) return;
    block.visible = !block.visible;
    RS.renderProjectDetail();
    markDirty();
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
    select.addEventListener("change", (e) => { piece.status = e.target.value; markDirty(); });
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
  /* Modal genérico de imagen (logo de proyecto, portada de cliente) */
  /* ---------------------------------------------------------- */

  function ensureImageModal() {
    if (imageModalEl) return;
    imageModalEl = document.createElement("div");
    imageModalEl.className = "piece-modal-overlay";
    imageModalEl.innerHTML = `<div class="piece-modal">
      <div class="admin-panel__header">
        <div class="admin-panel__title" id="imageModalTitle"></div>
        <button class="admin-panel__close" id="imageModalClose">${RS.icon("x")}</button>
      </div>
      <div class="admin-panel__body">
        <div class="admin-field">
          <label>Subir imagen</label>
          <input type="file" id="imageFileInput" accept="image/*" />
        </div>
        <div class="admin-field">
          <label>O pegar una URL de imagen</label>
          <input type="text" id="imageUrlInput" placeholder="https://..." />
        </div>
        <button class="btn btn--ghost" id="imageRemoveBtn" style="width:100%; justify-content:center;">${RS.icon("trash-2")} Quitar imagen</button>
      </div>
    </div>`;
    document.body.appendChild(imageModalEl);
    imageModalEl.addEventListener("click", (e) => { if (e.target === imageModalEl) closeImageModal(); });
    imageModalEl.querySelector("#imageModalClose").addEventListener("click", closeImageModal);
  }

  // config: { title, icon, get, set, onSaved, removedMessage }
  function openImageModal(config) {
    ensureImageModal();
    imageModalConfig = config;
    imageModalEl.querySelector("#imageModalTitle").innerHTML = `${RS.icon(config.icon || "image-plus")} ${config.title}`;

    const fileInput = imageModalEl.querySelector("#imageFileInput");
    const urlInput = imageModalEl.querySelector("#imageUrlInput");
    fileInput.value = "";
    urlInput.value = "";

    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        imageModalConfig.set(reader.result);
        imageModalConfig.onSaved();
        closeImageModal();
        markDirty();
        showToast("Imagen actualizada");
      };
      reader.readAsDataURL(file);
    };

    urlInput.onchange = (e) => {
      if (!e.target.value) return;
      imageModalConfig.set(e.target.value);
      imageModalConfig.onSaved();
      closeImageModal();
      markDirty();
      showToast("Imagen actualizada");
    };

    imageModalEl.querySelector("#imageRemoveBtn").onclick = () => {
      imageModalConfig.set(null);
      imageModalConfig.onSaved();
      closeImageModal();
      markDirty();
      showToast(imageModalConfig.removedMessage || "Imagen quitada");
    };

    imageModalEl.classList.add("is-open");
  }

  function closeImageModal() {
    if (imageModalEl) imageModalEl.classList.remove("is-open");
  }

  function openLogoModal() {
    openImageModal({
      title: "Logo del proyecto",
      set: (v) => { currentProject().logoUrl = v; },
      onSaved: () => { RS.renderProjectDetail(); RS.hydrateIcons(); },
      removedMessage: "Logo quitado, volviendo al emoji",
    });
  }

  function openCoverModal() {
    openImageModal({
      title: "Portada del cliente",
      set: (v) => { window.CLIENT_DATA.client.coverImage = v; },
      onSaved: () => { RS.renderHero(); RS.hydrateIcons(); },
      removedMessage: "Portada quitada",
    });
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
    const coverBtn = document.getElementById("editCoverBtn");
    if (coverBtn && !coverBtn.dataset.bound) {
      coverBtn.dataset.bound = "true";
      coverBtn.addEventListener("click", openCoverModal);
    }
  }

  /* ---------------------------------------------------------- */
  /* Init                                                          */
  /* ---------------------------------------------------------- */

  function init() {
    // El estado de RS_ADMIN_MODE ya lo resolvió detectAdminMode() al
    // principio del boot() de la página (incluye el gate de contraseña
    // si corresponde) — no se vuelve a pedir acá.

    // Delegado sobre #topbar (que nunca se reemplaza) en lugar del botón
    // en sí (que se recrea cada vez que se vuelve a dibujar el topbar).
    const topbarEl = document.getElementById("topbar");
    if (topbarEl && !topbarEl.dataset.adminBound) {
      topbarEl.dataset.adminBound = "true";
      topbarEl.addEventListener("click", (e) => {
        if (!e.target.closest("#adminToggle")) return;
        if (!window.RS_ADMIN_MODE) { toggleAdminMode(); if (window.RS_ADMIN_MODE) openPanel(); }
        else { openPanel(); }
      });
    }

    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (!window.RS_ADMIN_MODE) toggleAdminMode();
        if (window.RS_ADMIN_MODE) openPanel();
      }
      if (e.key === "Escape") { closePanel(); closePieceModal(); closeImageModal(); }
    });

    if (document.getElementById("blocksContainer")) initBlockDragDrop();
    bindProjectPageEvents();

    if (window.RS_ADMIN_MODE) refreshPage();
    if (wantsAdminViaUrl() && window.RS_ADMIN_MODE) openPanel();
  }

  function detectAdminMode() {
    if (isAuthed()) { setAdminMode(true); return; }
    if (wantsAdminViaUrl()) { tryActivateAdmin(); return; }
    setAdminMode(false);
  }

  window.RSAdmin = { init, toggleAdminMode, detectAdminMode };
})();
