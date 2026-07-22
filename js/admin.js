/**
 * ============================================================
 * REELSUPRA — MODO ADMINISTRADOR
 * ============================================================
 * Backend real desde el 2026-07-12: los cambios se guardan en Supabase
 * (vía js/store.supabase.js) al tocar "Guardar cambios" — persisten
 * para cualquier dispositivo/navegador, no solo el que hizo el cambio.
 * js/data.js/js/store.js (localStorage) quedan solo como fallback si
 * Supabase no responde — ver DOCUMENTACION/PLAN_MIGRACION_SUPABASE.md.
 *
 * Se activa con:
 *   - ?admin=true en la URL
 *   - /admin en la ruta (Netlify redirige /admin -> index.html)
 *   - Ctrl/Cmd + Shift + A en cualquier momento
 * ...pidiendo antes un login real (email + contraseña) contra
 * Supabase Auth. Server-side de verdad: Row Level Security rechaza
 * cualquier escritura sin una sesión autenticada con rol admin, sin
 * importar qué haga el navegador — a diferencia de la contraseña
 * plana que usaba la V1/V2, esto no se puede saltear desde la consola
 * del navegador.
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
 * Desde el panel lateral (botón Admin de la barra superior), cada
 * proyecto tiene un botón por lista (Roadmap, Bitácora, Calendario,
 * Recursos, Documentos, Material pendiente, Próximos pasos, Mejoras
 * disponibles) que abre el editor genérico de listas: crear, editar,
 * eliminar y reordenar cualquier elemento sin tocar data.js. Un solo
 * motor (RS.LIST_SCHEMAS + el modal de abajo) sirve a las 8 — agregar
 * un bloque de lista nuevo es una entrada en el esquema, no un editor
 * nuevo.
 *
 * Cualquier modificación marca el estado como "sin guardar" y muestra
 * una barra inferior con un único botón "Guardar cambios", que
 * persiste todo (vía js/store.js — hoy localStorage) y avisa antes de
 * cerrar la pestaña si hay cambios pendientes.
 * ============================================================
 */

(function () {

  let panelEl, overlayEl, toastEl, pieceModalEl, imageModalEl, saveBarEl, clientFormModalEl;
  let isBuilt = false;
  let draggedBlockId = null;
  let imageModalConfig = null;
  let isDirty = false;

  // Achica una imagen subida al lado más largo (maxDim) antes de
  // guardarla — sin esto, una foto de celular sin comprimir (varios MB)
  // hace lenta la carga en mobile. Devuelve un Blob (para subir a
  // Storage) en vez de un data URL — más liviano que ida-y-vuelta por
  // base64 para el mismo archivo.
  function resizeImageToBlob(dataUrl, maxDim, mimeType) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width <= maxDim && height <= maxDim) {
          fetch(dataUrl).then((r) => r.blob()).then(resolve);
          return;
        }
        const scale = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        canvas.toBlob(resolve, mimeType, 0.85);
      };
      img.onerror = () => fetch(dataUrl).then((r) => r.blob()).then(resolve);
      img.src = dataUrl;
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  /* ---------------------------------------------------------- */
  /* Estado del modo admin — login real contra Supabase Auth    */
  /* ---------------------------------------------------------- */
  /* Reemplaza a la contraseña en texto plano (agency.adminPassphrase,
     ahora vestigial en js/data.js — no se usa desde este cambio,
     2026-07-12). La sesión real la persiste el propio cliente de
     Supabase (su storage interno, no rsClientDataOverride) — por eso
     ya no hace falta sessionStorage.rsAdminAuthed acá: RSStore.getSession()
     es la fuente de verdad. Nota: si Supabase no responde, el portal
     cae a js/data.js de solo lectura (ver store.supabase.js) y el
     login de admin tampoco funciona en ese estado — aceptado a
     propósito, ver PLAN_MIGRACION_SUPABASE.md. */

  function wantsAdminViaUrl() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "true") return true;
    if (window.location.pathname.replace(/\/$/, "").endsWith("/admin")) return true;
    return false;
  }

  function setAdminMode(value) {
    window.RS_ADMIN_MODE = value;
  }

  let loginModalEl = null;
  let loginModalResolve = null;

  function ensureLoginModal() {
    if (loginModalEl) return;
    loginModalEl = document.createElement("div");
    loginModalEl.className = "piece-modal-overlay";
    loginModalEl.innerHTML = `<div class="piece-modal">
      <div class="admin-panel__header">
        <div class="admin-panel__title">${RS.icon("lock")} Iniciar sesión</div>
        <button class="admin-panel__close" id="loginModalClose">${RS.icon("x")}</button>
      </div>
      <div class="admin-panel__body">
        <div class="admin-field">
          <label>Email</label>
          <input type="email" id="loginEmailInput" autocomplete="username" />
        </div>
        <div class="admin-field">
          <label>Contraseña</label>
          <input type="password" id="loginPasswordInput" autocomplete="current-password" />
        </div>
        <button class="btn btn--primary" id="loginSubmitBtn" style="width:100%; justify-content:center;">${RS.icon("log-in")} Ingresar</button>
      </div>
    </div>`;
    document.body.appendChild(loginModalEl);

    const submit = () => {
      const email = loginModalEl.querySelector("#loginEmailInput").value.trim();
      const password = loginModalEl.querySelector("#loginPasswordInput").value;
      if (!email || !password) return;
      RSStore.signIn(email, password).then((ok) => {
        if (!ok) { showToast("Email o contraseña incorrectos", "error"); return; }
        // Login genérico: admin activa el panel; cliente va directo a
        // SU portal (no alcanza con "hay sesión", hace falta saber a
        // qué cliente pertenece). Cualquier otra cosa (sin profile,
        // sin client_id) cierra la sesión — no queda "a medias".
        RSStore.getCurrentUserAccess().then((access) => {
          if (access.role === "admin") { closeLoginModal(true); return; }
          if (access.role === "client" && access.slug) {
            closeLoginModal(false);
            window.location.href = `index.html?client=${encodeURIComponent(access.slug)}`;
            return;
          }
          RSStore.signOut().then(() => showToast("Esta cuenta no tiene acceso configurado", "error"));
        });
      });
    };

    loginModalEl.addEventListener("click", (e) => { if (e.target === loginModalEl) closeLoginModal(false); });
    loginModalEl.querySelector("#loginModalClose").addEventListener("click", () => closeLoginModal(false));
    loginModalEl.querySelector("#loginSubmitBtn").addEventListener("click", submit);
    loginModalEl.querySelector("#loginPasswordInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
  }

  function openLoginModal() {
    ensureLoginModal();
    loginModalEl.querySelector("#loginEmailInput").value = "";
    loginModalEl.querySelector("#loginPasswordInput").value = "";
    loginModalEl.classList.add("is-open");
    RS.hydrateIcons();
    return new Promise((resolve) => { loginModalResolve = resolve; });
  }

  function closeLoginModal(success) {
    if (loginModalEl) loginModalEl.classList.remove("is-open");
    if (loginModalResolve) { loginModalResolve(success); loginModalResolve = null; }
  }

  // Devuelve una Promise<boolean> — antes era síncrono (window.prompt
  // bloqueaba), ahora depende de una llamada real a Supabase Auth.
  function tryActivateAdmin() {
    return openLoginModal().then((success) => {
      if (success) setAdminMode(true);
      return success;
    });
  }

  // Devuelve una Promise — los call sites que antes revisaban
  // window.RS_ADMIN_MODE justo después de llamar a esta función ahora
  // tienen que encadenar un .then() (ver init()).
  function toggleAdminMode() {
    if (window.RS_ADMIN_MODE) {
      return RSStore.signOut().then(() => {
        setAdminMode(false);
        refreshPage();
        showToast("Modo administrador desactivado");
      });
    }
    return tryActivateAdmin().then((ok) => {
      if (!ok) return;
      refreshPage();
      showToast("Modo administrador activado");
      if (document.getElementById("blocksContainer")) initBlockDragDrop();
    });
  }

  function refreshPage() {
    RS.renderTopbar({ showBack: !!document.getElementById("projectHero") });
    if (document.getElementById("hero")) { RS.renderHero(); RS.renderRecentActivity(); RS.renderProjectGrid(); }
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

  function showToast(message, type = "default") {
    ensureToast();
    toastEl.textContent = message;
    toastEl.classList.toggle("admin-toast--error", type === "error");
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
      // Si falla (ej: cuota de localStorage superada por una imagen
      // grande), NO se limpia el estado "sin guardar" — si lo
      // hiciéramos, la barra desaparecería y beforeunload dejaría de
      // avisar, y el cambio se perdería sin que el usuario se entere.
      if (!ok) {
        showToast("No se pudo guardar — probá de nuevo", "error");
        return;
      }
      isDirty = false;
      if (saveBarEl) saveBarEl.classList.remove("is-open");
      showToast("Cambios guardados");
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

  function selectField(labelText, value, options, onChange) {
    const wrap = document.createElement("div");
    wrap.className = "admin-field";
    const label = document.createElement("label");
    label.textContent = labelText;
    wrap.appendChild(label);
    const select = document.createElement("select");
    select.innerHTML = options.map((o) => `<option value="${o}">${o}</option>`).join("");
    select.value = value;
    select.addEventListener("change", (e) => { onChange(e.target.value); markDirty(); });
    wrap.appendChild(select);
    return wrap;
  }

  function rangeField(labelText, value, { min, max, step = 1, unit = "" }, onChange) {
    const wrap = document.createElement("div");
    wrap.className = "admin-field";
    const label = document.createElement("label");
    label.textContent = labelText;
    wrap.appendChild(label);
    const row = document.createElement("div");
    row.className = "admin-range-field";
    const input = document.createElement("input");
    input.type = "range";
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = value;
    const out = document.createElement("span");
    out.className = "admin-range-field__value";
    out.textContent = `${value}${unit}`;
    input.addEventListener("input", (e) => {
      out.textContent = `${e.target.value}${unit}`;
      onChange(e.target.value);
      markDirty();
    });
    row.appendChild(input);
    row.appendChild(out);
    wrap.appendChild(row);
    return wrap;
  }

  function groupTitle(text) {
    const h = document.createElement("div");
    h.className = "admin-group-title";
    h.textContent = text;
    return h;
  }

  // Sección colapsable del panel admin (<details>/<summary> nativo —
  // sin JS de toggle). Devuelve { details, bodyEl }: agregar contenido
  // a bodyEl, y agregar details al padre. open=false por defecto
  // porque la mayoría de las secciones se editan una vez y no se
  // vuelven a tocar — el objetivo es que abrir el panel no muestre
  // todo de una, con 50 clientes eso era ruido, no orden.
  function collapsibleGroup(text, { open = false } = {}) {
    const details = document.createElement("details");
    details.className = "admin-group";
    if (open) details.open = true;
    const summary = document.createElement("summary");
    summary.className = "admin-group__summary";
    summary.innerHTML = `<span>${text}</span>${RS.icon("chevron-down")}`;
    const bodyEl = document.createElement("div");
    bodyEl.className = "admin-group__body";
    details.appendChild(summary);
    details.appendChild(bodyEl);
    return { details, bodyEl };
  }

  /* ---------------------------------------------------------- */
  /* Theme Builder — generado desde RS.THEME_SCHEMA              */
  /* ---------------------------------------------------------- */

  // Un solo dispatcher por tipo de campo — agregar una variable de
  // tema nueva en THEME_SCHEMA no requiere tocar esta función salvo
  // que use un tipo de control que todavía no exista.
  function renderThemeField(item, currentValue, onChange) {
    if (item.type === "select" || item.type === "font") {
      return selectField(item.label, currentValue, item.options, onChange);
    }
    if (item.type === "range") {
      return rangeField(item.label, currentValue, item, onChange);
    }
    return field(item.label, currentValue, onChange, false, item.type);
  }

  function buildThemeBuilder(body, data) {
    const theme = data.client.theme || (data.client.theme = {});

    const preview = document.createElement("div");
    preview.className = "theme-preview";
    preview.innerHTML = `
      <div class="theme-preview__title">Título de ejemplo</div>
      <p class="theme-preview__text">Así se ve el texto de tu portal con esta configuración.</p>
      <button class="btn btn--primary" type="button">Botón de ejemplo</button>`;
    body.appendChild(preview);

    const groups = {};
    RS.THEME_SCHEMA.forEach((item) => { (groups[item.group] = groups[item.group] || []).push(item); });

    Object.keys(groups).forEach((groupName) => {
      body.appendChild(groupTitle(groupName));
      groups[groupName].forEach((item) => {
        const current = theme[item.key] !== undefined ? theme[item.key] : item.default;
        body.appendChild(renderThemeField(item, current, (v) => {
          theme[item.key] = v;
          RS.applyTheme();
        }));
      });
    });
  }

  /* ---------------------------------------------------------- */
  /* Editor genérico de listas — un solo motor para Roadmap,      */
  /* Bitácora, Calendario, Recursos, Documentos, Material         */
  /* pendiente, Próximos pasos y Mejoras disponibles. Agregar un  */
  /* bloque de lista nuevo en el futuro = una entrada en          */
  /* RS.LIST_SCHEMAS (+ una en RS.BLOCK_DEFS para el render de    */
  /* solo lectura) — no un editor nuevo.                          */
  /* ---------------------------------------------------------- */

  let listEditorEl;
  let listEditorState = null; // { project, listKey, mode: 'list'|'form', editingIndex, draft }

  function getList(project, listKey) {
    return project[listKey] || (project[listKey] = []);
  }

  function buildContentListButtons(project) {
    const wrap = document.createElement("div");
    wrap.className = "content-list-buttons";
    Object.keys(RS.LIST_SCHEMAS).forEach((listKey) => {
      const def = RS.BLOCK_DEFS[listKey];
      if (!def) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "content-list-btn";
      btn.innerHTML = `
        <span>${RS.icon(def.icon)}${def.title}</span>
        <span class="content-list-btn__count" data-list-count data-project-id="${project.id}" data-list-key="${listKey}">${getList(project, listKey).length}</span>`;
      btn.addEventListener("click", () => openListEditor(project, listKey));
      wrap.appendChild(btn);
    });
    return wrap;
  }

  function refreshContentListCounts() {
    if (!panelEl) return;
    panelEl.querySelectorAll("[data-list-count]").forEach((el) => {
      const project = window.CLIENT_DATA.projects.find((p) => p.id === el.dataset.projectId);
      if (project) el.textContent = getList(project, el.dataset.listKey).length;
    });
  }

  function ensureListEditorModal() {
    if (listEditorEl) return;
    listEditorEl = document.createElement("div");
    listEditorEl.className = "piece-modal-overlay";
    listEditorEl.innerHTML = `<div class="piece-modal list-editor-modal">
      <div class="admin-panel__header">
        <div class="admin-panel__title" id="listEditorTitle"></div>
        <button class="admin-panel__close" id="listEditorClose">${RS.icon("x")}</button>
      </div>
      <div class="admin-panel__body" id="listEditorBody"></div>
    </div>`;
    document.body.appendChild(listEditorEl);
    listEditorEl.addEventListener("click", (e) => { if (e.target === listEditorEl) closeListEditorModal(); });
    listEditorEl.querySelector("#listEditorClose").addEventListener("click", closeListEditorModal);
  }

  function openListEditor(project, listKey) {
    ensureListEditorModal();
    listEditorState = { project, listKey, mode: "list", editingIndex: null, draft: null };
    renderListEditor();
    listEditorEl.classList.add("is-open");
  }

  function closeListEditorModal() {
    if (listEditorEl) listEditorEl.classList.remove("is-open");
    refreshContentListCounts();
  }

  function renderListEditor() {
    listEditorState.mode === "list" ? renderListEditorListView() : renderListEditorFormView();
  }

  function renderListEditorListView() {
    const { project, listKey } = listEditorState;
    const schema = RS.LIST_SCHEMAS[listKey];
    const def = RS.BLOCK_DEFS[listKey];
    const list = getList(project, listKey);

    listEditorEl.querySelector("#listEditorTitle").innerHTML = `${RS.icon(def.icon)} ${def.title}`;
    const body = listEditorEl.querySelector("#listEditorBody");
    body.innerHTML = "";

    if (!list.length) {
      const empty = document.createElement("p");
      empty.className = "empty-hint";
      empty.textContent = "Todavía no hay elementos. Agregá el primero.";
      body.appendChild(empty);
    }

    list.forEach((item, i) => {
      const row = document.createElement("div");
      row.className = "list-editor-item";
      const labelText = schema.itemLabel(item);
      row.innerHTML = `
        <div class="list-editor-item__order">
          <button type="button" data-move="-1" ${i === 0 ? "disabled" : ""}>${RS.icon("chevron-up")}</button>
          <button type="button" data-move="1" ${i === list.length - 1 ? "disabled" : ""}>${RS.icon("chevron-down")}</button>
        </div>
        <span class="list-editor-item__label">${RS.esc(labelText)}</span>
        <button type="button" class="list-editor-item__edit" data-edit title="Editar">${RS.icon("pencil")}</button>
        <button type="button" class="list-editor-item__delete" data-delete title="Eliminar">${RS.icon("trash-2")}</button>`;
      row.querySelector('[data-move="-1"]').addEventListener("click", () => moveListItem(i, -1));
      row.querySelector('[data-move="1"]').addEventListener("click", () => moveListItem(i, 1));
      row.querySelector("[data-edit]").addEventListener("click", () => startEditListItem(i));
      row.querySelector("[data-delete]").addEventListener("click", () => deleteListItem(i));
      body.appendChild(row);
    });

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn btn--ghost";
    addBtn.style.cssText = "width:100%; justify-content:center; margin-top:var(--space-3);";
    addBtn.innerHTML = `${RS.icon("plus")} Agregar`;
    addBtn.addEventListener("click", startAddListItem);
    body.appendChild(addBtn);

    RS.hydrateIcons();
  }

  function moveListItem(index, delta) {
    const { project, listKey } = listEditorState;
    const list = getList(project, listKey);
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    markDirty();
    renderListEditorListView();
    refreshListBlockOnPage();
  }

  function deleteListItem(index) {
    const { project, listKey } = listEditorState;
    const list = getList(project, listKey);
    if (!window.confirm("¿Eliminar este elemento? No se puede deshacer.")) return;
    list.splice(index, 1);
    markDirty();
    renderListEditorListView();
    refreshListBlockOnPage();
  }

  function startAddListItem() {
    const schema = RS.LIST_SCHEMAS[listEditorState.listKey];
    listEditorState.mode = "form";
    listEditorState.editingIndex = null;
    listEditorState.draft = schema.newItem();
    renderListEditorFormView();
  }

  function startEditListItem(index) {
    const { project, listKey } = listEditorState;
    const list = getList(project, listKey);
    const schema = RS.LIST_SCHEMAS[listKey];
    listEditorState.mode = "form";
    listEditorState.editingIndex = index;
    listEditorState.draft = schema.primitive ? list[index] : { ...list[index] };
    renderListEditorFormView();
  }

  function renderListEditorFormView() {
    const { listKey, draft } = listEditorState;
    const schema = RS.LIST_SCHEMAS[listKey];
    const def = RS.BLOCK_DEFS[listKey];

    listEditorEl.querySelector("#listEditorTitle").innerHTML = `${RS.icon(def.icon)} ${def.title}`;
    const body = listEditorEl.querySelector("#listEditorBody");
    body.innerHTML = "";

    if (schema.primitive) {
      body.appendChild(field(schema.fields[0].label, draft, (v) => { listEditorState.draft = v; }));
    } else {
      schema.fields.forEach((f) => {
        const onChange = (v) => { listEditorState.draft[f.key] = v; };
        if (f.type === "select") body.appendChild(selectField(f.label, draft[f.key], f.options, onChange));
        else if (f.type === "textarea") body.appendChild(field(f.label, draft[f.key], onChange, true));
        else body.appendChild(field(f.label, draft[f.key], onChange, false, f.type));
      });
    }

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex; gap:var(--space-2); margin-top:var(--space-4);";
    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "btn btn--ghost";
    backBtn.style.cssText = "flex:1; justify-content:center;";
    backBtn.textContent = "Cancelar";
    backBtn.addEventListener("click", () => { listEditorState.mode = "list"; renderListEditorListView(); });
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn btn--primary";
    saveBtn.style.cssText = "flex:1; justify-content:center;";
    saveBtn.innerHTML = `${RS.icon("check")} Guardar`;
    saveBtn.addEventListener("click", commitListItem);
    actions.appendChild(backBtn);
    actions.appendChild(saveBtn);
    body.appendChild(actions);

    RS.hydrateIcons();
  }

  function commitListItem() {
    const { project, listKey, editingIndex, draft } = listEditorState;
    const list = getList(project, listKey);
    if (editingIndex === null) list.push(draft);
    else list[editingIndex] = draft;
    markDirty();
    listEditorState.mode = "list";
    renderListEditorListView();
    refreshListBlockOnPage();
    showToast("Elemento guardado");
  }

  function refreshListBlockOnPage() {
    if (document.getElementById("blocksContainer")) RS.renderProjectDetail();
  }

  /* ---------------------------------------------------------- */
  /* Selector de clientes + Acceso al Portal                      */
  /* ---------------------------------------------------------- */

  // Selector para cambiar de cliente sin salir del panel — navega con
  // ?client=<slug> (la URL sigue siendo la fuente de verdad de "qué
  // cliente estoy viendo", igual que hoy). Con un solo cliente real
  // hoy no cambia nada visible salvo la lista con una opción.
  function buildClientSelector(body) {
    const wrap = document.createElement("div");
    wrap.className = "admin-field";
    wrap.style.marginBottom = "var(--space-4)";
    const label = document.createElement("label");
    label.textContent = "Cliente (cambiar)";
    wrap.appendChild(label);
    const select = document.createElement("select");
    select.disabled = true;
    select.innerHTML = `<option>Cargando…</option>`;
    wrap.appendChild(select);
    body.appendChild(wrap);

    RSStore.listClients()
      .then((clients) => {
        const current = window.CLIENT_DATA.client._slug;
        select.innerHTML = clients
          .map((c) => `<option value="${c.slug}" ${c.slug === current ? "selected" : ""}>${c.name}</option>`)
          .join("");
        select.disabled = false;
        select.addEventListener("change", (e) => {
          const url = new URL(window.location.href);
          url.searchParams.set("client", e.target.value);
          url.searchParams.set("admin", "1");
          window.location.href = url.toString();
        });
      })
      .catch((e) => {
        select.innerHTML = `<option>No se pudo cargar la lista</option>`;
        console.warn("RSAdmin: no se pudo listar clientes.", e);
      });
  }

  // "Acceso al Portal" — todas las acciones pasan por RSStore.manageAccess(),
  // que llama a la Edge Function (única pieza con la service_role key).
  // Sin estados técnicos visibles: el admin solo ve "sin acceso" (campo
  // vacío/editable + "Crear acceso") o "con acceso" (campo bloqueado +
  // Editar email / Reenviar acceso / Revocar acceso) — la diferencia
  // entre "nunca invitado" y "revocado" (ambas caen en "sin acceso") la
  // resuelve esta función sola, no es algo que el admin tenga que
  // pensar. Reutilizada tal cual desde el Dashboard (window.RSAdmin).
  // No toca CLIENT_DATA ni pasa por markDirty/saveChanges — no es un
  // cambio "sin guardar", ya queda confirmado apenas la acción responde.
  function generateTempPassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    const arr = new Uint32Array(12);
    crypto.getRandomValues(arr);
    let out = "";
    for (let i = 0; i < arr.length; i++) out += chars[arr[i] % chars.length];
    return out;
  }

  function buildPortalAccessSection(data, onChange) {
    const wrap = document.createElement("div");
    wrap.style.marginBottom = "var(--space-4)";

    let pendingEmail = data.client.portalEmail || "";
    let pendingPassword = "";
    let editingEmail = false;
    let settingPassword = false;

    const emailWrap = document.createElement("div");
    emailWrap.className = "admin-field";
    const emailLabel = document.createElement("label");
    emailLabel.textContent = "Email del cliente";
    emailWrap.appendChild(emailLabel);
    const emailInput = document.createElement("input");
    emailInput.type = "email";
    emailInput.value = pendingEmail;
    emailInput.addEventListener("input", (e) => { pendingEmail = e.target.value; });
    emailWrap.appendChild(emailInput);
    wrap.appendChild(emailWrap);

    // Solo se muestra para una cuenta nueva (nunca invitada/creada
    // antes) — el admin define la contraseña temporal acá mismo, sin
    // depender de que llegue un email. Se la pasa al cliente por
    // fuera (WhatsApp, etc.).
    const passwordWrap = document.createElement("div");
    passwordWrap.className = "admin-field";
    const passwordLabel = document.createElement("label");
    passwordLabel.textContent = "Contraseña temporal";
    passwordWrap.appendChild(passwordLabel);
    const passwordRow = document.createElement("div");
    passwordRow.style.cssText = "display:flex; gap:var(--space-2);";
    const passwordInput = document.createElement("input");
    passwordInput.type = "text";
    passwordInput.autocomplete = "off";
    passwordInput.spellcheck = false;
    passwordInput.style.flex = "1";
    passwordInput.addEventListener("input", (e) => { pendingPassword = e.target.value; });
    const generateBtn = document.createElement("button");
    generateBtn.type = "button";
    generateBtn.className = "btn btn--ghost";
    generateBtn.textContent = "Generar";
    generateBtn.addEventListener("click", () => {
      pendingPassword = generateTempPassword();
      passwordInput.value = pendingPassword;
    });
    passwordRow.appendChild(passwordInput);
    passwordRow.appendChild(generateBtn);
    passwordWrap.appendChild(passwordRow);

    const actionsRow = document.createElement("div");
    actionsRow.style.cssText = "display:flex; flex-wrap:wrap; gap:var(--space-2);";
    wrap.appendChild(actionsRow);

    function actionBtn(label, onClick, variant = "ghost") {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `btn btn--${variant}`;
      btn.innerHTML = label;
      btn.addEventListener("click", () => {
        btn.disabled = true;
        onClick(btn).finally(() => { btn.disabled = false; });
      });
      return btn;
    }

    function runAccessAction(action, email) {
      return RSStore.manageAccess(action, data.client._id, email)
        .then((res) => {
          data.client.portalEmail = res.portalEmail;
          data.client.portalAccessStatus = res.portalAccessStatus;
          pendingEmail = res.portalEmail || "";
          editingEmail = false;
          render();
          showToast("Listo — Acceso al Portal actualizado");
          if (onChange) onChange();
        })
        .catch((e) => {
          showToast(e.message || "No se pudo completar la acción", "error");
        });
    }

    // Distinto de runAccessAction: crea la cuenta con contraseña
    // definida a mano (sin email) y muestra esa contraseña una sola
    // vez, de forma persistente (window.alert, no un toast que
    // desaparece solo) para que el admin la copie y se la pase al
    // cliente por otro canal.
    function runManualCreate(email, password) {
      return RSStore.manageAccess("create_manual", data.client._id, email, password)
        .then((res) => {
          data.client.portalEmail = res.portalEmail;
          data.client.portalAccessStatus = res.portalAccessStatus;
          pendingEmail = res.portalEmail || "";
          pendingPassword = "";
          editingEmail = false;
          render();
          if (onChange) onChange();
          window.alert(
            `Acceso creado.\n\nEmail: ${res.portalEmail}\nContraseña temporal: ${password}\n\n` +
            `Compartísela al cliente por un canal seguro (WhatsApp, etc.) — no vuelve a mostrarse después de cerrar este mensaje.`
          );
        })
        .catch((e) => {
          showToast(e.message || "No se pudo completar la acción", "error");
        });
    }

    // Cambia la contraseña de una cuenta que YA existe (sin
    // borrarla/recrearla) — para cuando el cliente la perdió o hace
    // falta asignarle una nueva a mano.
    function runSetPassword(password) {
      return RSStore.manageAccess("set_password", data.client._id, null, password)
        .then(() => {
          settingPassword = false;
          pendingPassword = "";
          render();
          if (onChange) onChange();
          window.alert(
            `Contraseña actualizada.\n\nNueva contraseña: ${password}\n\n` +
            `Compartísela al cliente por un canal seguro — no vuelve a mostrarse después de cerrar este mensaje.`
          );
        })
        .catch((e) => {
          showToast(e.message || "No se pudo completar la acción", "error");
        });
    }

    function render() {
      actionsRow.innerHTML = "";
      const status = data.client.portalAccessStatus;
      const hasAccess = status === "invitado";
      const hasAccount = !!data.client.portalUserId;
      if (!hasAccess) settingPassword = false;

      // Bloqueado (solo lectura) mientras hay acceso y no se tocó
      // "Editar email" — evita cambios accidentales del email de un
      // cliente que ya está usando el portal.
      emailInput.readOnly = hasAccess && !editingEmail;
      emailInput.classList.toggle("admin-field__input--locked", emailInput.readOnly);

      const showPasswordField = (!hasAccess && !hasAccount) || (hasAccess && settingPassword);
      if (showPasswordField) {
        if (!passwordWrap.isConnected) wrap.insertBefore(passwordWrap, actionsRow);
        passwordInput.value = pendingPassword;
      } else if (passwordWrap.isConnected) {
        passwordWrap.remove();
      }

      if (!hasAccess) {
        if (!hasAccount) {
          // Cuenta nueva: hace falta definir la contraseña temporal.
          actionsRow.appendChild(
            actionBtn(`${RS.icon("send")} Crear acceso`, () => {
              if (!pendingEmail) { showToast("Ingresá un email primero", "error"); return Promise.resolve(); }
              if (!pendingPassword || pendingPassword.length < 8) {
                showToast("Ingresá o generá una contraseña de al menos 8 caracteres", "error");
                return Promise.resolve();
              }
              return runManualCreate(pendingEmail, pendingPassword);
            }, "primary")
          );
        } else {
          // Acceso revocado antes: la cuenta ya existe con su
          // contraseña original, no hace falta pedir una nueva.
          actionsRow.appendChild(
            actionBtn(`${RS.icon("send")} Crear acceso`, () => {
              if (!pendingEmail) { showToast("Ingresá un email primero", "error"); return Promise.resolve(); }
              return runAccessAction("grant", pendingEmail);
            }, "primary")
          );
        }
        return;
      }

      if (editingEmail) {
        actionsRow.appendChild(
          actionBtn(`${RS.icon("check")} Guardar email`, () => {
            if (!pendingEmail || pendingEmail === data.client.portalEmail) {
              editingEmail = false;
              render();
              return Promise.resolve();
            }
            return runAccessAction("change_email", pendingEmail);
          }, "primary")
        );
        // Sin botón "cancelar" aparte: cerrar y reabrir el panel
        // descarta el cambio a medio hacer sin necesitar uno.
      } else {
        actionsRow.appendChild(
          actionBtn(`${RS.icon("edit")} Editar email`, () => {
            editingEmail = true;
            render();
            emailInput.focus();
            return Promise.resolve();
          })
        );
      }

      if (settingPassword) {
        actionsRow.appendChild(
          actionBtn(`${RS.icon("check")} Guardar contraseña`, () => {
            if (!pendingPassword || pendingPassword.length < 8) {
              showToast("Ingresá o generá una contraseña de al menos 8 caracteres", "error");
              return Promise.resolve();
            }
            return runSetPassword(pendingPassword);
          }, "primary")
        );
      } else {
        actionsRow.appendChild(
          actionBtn(`${RS.icon("key")} Restablecer contraseña`, () => {
            settingPassword = true;
            pendingPassword = "";
            render();
            return Promise.resolve();
          })
        );
      }

      actionsRow.appendChild(
        actionBtn(`${RS.icon("send")} Reenviar acceso`, () => runAccessAction("resend"))
      );
      actionsRow.appendChild(
        actionBtn(`${RS.icon("x")} Revocar acceso`, () => {
          if (!window.confirm("¿Revocar el acceso de este cliente al portal?")) return Promise.resolve();
          return runAccessAction("revoke");
        })
      );
    }

    render();
    return wrap;
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
        <button class="btn btn--ghost" id="adminPreview">${RS.icon("eye")} Previsualizar cambios</button>
      </div>`;

    document.body.appendChild(overlayEl);
    document.body.appendChild(panelEl);
    ensureToast();

    panelEl.querySelector(".admin-panel__close").addEventListener("click", closePanel);
    // Distinto de "Guardar cambios" (barra inferior, persiste en
    // Supabase): esto solo refresca el render con lo que ya está en
    // memoria, para ver textos editados sin esperar a guardar. El
    // Theme Builder ya previsualiza solo (RS.applyTheme() en cada
    // cambio) — este botón cubre el resto (nombre, mensajes, etc.).
    panelEl.querySelector("#adminPreview").addEventListener("click", () => {
      refreshPage();
      showToast("Vista previa actualizada");
    });

    const body = panelEl.querySelector("#adminBody");
    buildClientSelector(body);

    const accesoGroup = collapsibleGroup("Acceso al portal", { open: true });
    accesoGroup.bodyEl.appendChild(buildPortalAccessSection(data));
    body.appendChild(accesoGroup.details);

    const clienteGroup = collapsibleGroup("Cliente");
    clienteGroup.bodyEl.appendChild(field("Nombre del cliente", data.client.name, (v) => (data.client.name = v)));
    clienteGroup.bodyEl.appendChild(field("Mensaje de bienvenida", data.client.welcomeMessage, (v) => (data.client.welcomeMessage = v), true));
    const brandRow = document.createElement("div");
    brandRow.style.cssText = "display:flex; gap:var(--space-2); margin-bottom:var(--space-4);";
    const logoBtn = document.createElement("button");
    logoBtn.type = "button";
    logoBtn.className = "btn btn--ghost";
    logoBtn.style.cssText = "flex:1; justify-content:center;";
    logoBtn.innerHTML = `${RS.icon("image-plus")} Logo`;
    logoBtn.addEventListener("click", openClientLogoModal);
    const faviconBtn = document.createElement("button");
    faviconBtn.type = "button";
    faviconBtn.className = "btn btn--ghost";
    faviconBtn.style.cssText = "flex:1; justify-content:center;";
    faviconBtn.innerHTML = `${RS.icon("image-plus")} Favicon`;
    faviconBtn.addEventListener("click", openFaviconModal);
    brandRow.appendChild(logoBtn);
    brandRow.appendChild(faviconBtn);
    clienteGroup.bodyEl.appendChild(brandRow);
    body.appendChild(clienteGroup.details);

    const aparienciaGroup = collapsibleGroup("Apariencia");
    buildThemeBuilder(aparienciaGroup.bodyEl, data);
    body.appendChild(aparienciaGroup.details);

    const avisoGroup = collapsibleGroup("Aviso superior");
    avisoGroup.bodyEl.appendChild(checkboxField("Mostrar aviso al cliente", data.announcement.active, (v) => (data.announcement.active = v)));
    avisoGroup.bodyEl.appendChild(field("Texto del aviso", data.announcement.text, (v) => (data.announcement.text = v), true));
    body.appendChild(avisoGroup.details);

    data.projects.forEach((p, i) => {
      const projectGroup = collapsibleGroup(`Proyecto ${i + 1} — ${p.name}`, { open: i === 0 });
      projectGroup.bodyEl.appendChild(field("Nombre del proyecto", p.name, (v) => (p.name = v)));
      projectGroup.bodyEl.appendChild(field("Estado (texto visible)", p.status, (v) => (p.status = v)));
      projectGroup.bodyEl.appendChild(field("Objetivo", p.objective, (v) => (p.objective = v), true));
      projectGroup.bodyEl.appendChild(buildContentListButtons(p));
      body.appendChild(projectGroup.details);
    });

    const hint = document.createElement("p");
    hint.style.cssText = "font-size:12.5px;color:var(--rs-gray-300);line-height:1.6;margin-top:var(--space-4);";
    hint.textContent = "Para editar piezas de contenido, logo, y el orden/visibilidad de los bloques, hacelo directamente sobre la página del proyecto — no hace falta este panel.";
    body.appendChild(hint);

    isBuilt = true;
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

    // "Ver historial completo" de la bitácora (funciona con o sin
    // admin — es una vista de solo lectura, ver Fase 2 Parte D).
    container.addEventListener("click", (e) => {
      if (!e.target.closest("[data-bitacora-history]")) return;
      openBitacoraHistoryModal(currentProject());
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
  /* Modal de solo lectura: historial completo de la bitácora     */
  /* (Fase 2, Parte D) — blockBitacora() solo muestra las últimas  */
  /* novedades; acá se ve el timeline entero, sin nada editable.   */
  /* ---------------------------------------------------------- */

  let bitacoraHistoryModalEl = null;

  function ensureBitacoraHistoryModal() {
    if (bitacoraHistoryModalEl) return;
    bitacoraHistoryModalEl = document.createElement("div");
    bitacoraHistoryModalEl.className = "piece-modal-overlay";
    bitacoraHistoryModalEl.innerHTML = `<div class="piece-modal">
      <div class="admin-panel__header">
        <div class="admin-panel__title">${RS.icon("history")} Historial completo</div>
        <button class="admin-panel__close" id="bitacoraHistoryModalClose">${RS.icon("x")}</button>
      </div>
      <div class="admin-panel__body" id="bitacoraHistoryModalBody"></div>
    </div>`;
    document.body.appendChild(bitacoraHistoryModalEl);
    bitacoraHistoryModalEl.addEventListener("click", (e) => { if (e.target === bitacoraHistoryModalEl) closeBitacoraHistoryModal(); });
    bitacoraHistoryModalEl.querySelector("#bitacoraHistoryModalClose").addEventListener("click", closeBitacoraHistoryModal);
  }

  function closeBitacoraHistoryModal() {
    if (bitacoraHistoryModalEl) bitacoraHistoryModalEl.classList.remove("is-open");
  }

  function openBitacoraHistoryModal(project) {
    if (!project) return;
    ensureBitacoraHistoryModal();
    const entries = RS.bitacoraEntries(project);
    bitacoraHistoryModalEl.querySelector("#bitacoraHistoryModalBody").innerHTML = RS.bitacoraTimelineHtml(entries);
    bitacoraHistoryModalEl.classList.add("is-open");
    RS.hydrateIcons();
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
        const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
        const ext = mimeType === "image/png" ? "png" : "jpg";
        resizeImageToBlob(reader.result, 1280, mimeType).then((blob) => {
          const path = `${imageModalConfig.storagePrefix}-${Date.now()}.${ext}`;
          RSStore.uploadImage(imageModalConfig.bucket, path, blob, mimeType)
            .then((url) => {
              imageModalConfig.set(url);
              imageModalConfig.onSaved();
              closeImageModal();
              markDirty();
              showToast("Imagen actualizada");
            })
            .catch((err) => {
              // Storage no disponible (bucket sin crear todavía, sin red,
              // etc.) — respaldo: mismo comportamiento que antes de esta
              // migración, base64 directo en CLIENT_DATA. No rompe la
              // función mientras tanto.
              console.warn("RSAdmin: no se pudo subir a Storage, uso base64 como respaldo.", err);
              blobToDataUrl(blob).then((dataUrl) => {
                imageModalConfig.set(dataUrl);
                imageModalConfig.onSaved();
                closeImageModal();
                markDirty();
                showToast("Imagen actualizada (respaldo local)");
              });
            });
        });
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
    const project = currentProject();
    openImageModal({
      title: "Logo del proyecto",
      bucket: "logos",
      storagePrefix: `project-${project._id || project.id}`,
      set: (v) => { project.logoUrl = v; },
      onSaved: () => { RS.renderProjectDetail(); RS.hydrateIcons(); },
      removedMessage: "Logo quitado, volviendo al emoji",
    });
  }

  function openCoverModal() {
    openImageModal({
      title: "Portada del cliente",
      bucket: "covers",
      storagePrefix: `cover-${window.CLIENT_DATA.client._id}`,
      set: (v) => { window.CLIENT_DATA.client.coverImage = v; },
      onSaved: () => { RS.renderHero(); RS.hydrateIcons(); },
      removedMessage: "Portada quitada",
    });
  }

  /* ---------------------------------------------------------- */
  /* Modal liviano de cliente (Dashboard, Fase 2): crear/editar   */
  /* nombre, slug y emoji de saludo — reemplaza los window.prompt()  */
  /* encadenados. Todo lo visual/de contenido (tema, portada, logo, */
  /* bloques) se sigue editando desde el panel admin del cliente,   */
  /* no acá.                                                        */
  /* ---------------------------------------------------------- */

  function slugifyClientName(text) {
    return (text || "")
      .toString()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function friendlyClientFormError(e) {
    if (e && e.code === "23505") return "Ese slug ya existe — probá con otro.";
    return (e && e.message) || "No se pudo completar la acción";
  }

  function ensureClientFormModal() {
    if (clientFormModalEl) return;
    clientFormModalEl = document.createElement("div");
    clientFormModalEl.className = "piece-modal-overlay";
    clientFormModalEl.innerHTML = `<div class="piece-modal">
      <div class="admin-panel__header">
        <div class="admin-panel__title" id="clientFormModalTitle"></div>
        <button class="admin-panel__close" id="clientFormModalClose">${RS.icon("x")}</button>
      </div>
      <div class="admin-panel__body">
        <div class="admin-field">
          <label>Nombre</label>
          <input type="text" id="clientFormNameInput" />
        </div>
        <div class="admin-field">
          <label>Slug (para la URL)</label>
          <input type="text" id="clientFormSlugInput" autocomplete="off" spellcheck="false" />
        </div>
        <div class="admin-field">
          <label>Emoji de saludo (opcional)</label>
          <input type="text" id="clientFormEmojiInput" maxlength="4" placeholder="👋" />
        </div>
        <button class="btn btn--primary" id="clientFormSubmitBtn" style="width:100%; justify-content:center;"></button>
      </div>
    </div>`;
    document.body.appendChild(clientFormModalEl);
    clientFormModalEl.addEventListener("click", (e) => { if (e.target === clientFormModalEl) closeClientFormModal(); });
    clientFormModalEl.querySelector("#clientFormModalClose").addEventListener("click", closeClientFormModal);
  }

  function closeClientFormModal() {
    if (clientFormModalEl) clientFormModalEl.classList.remove("is-open");
  }

  // config: { mode: "create"|"edit", client: {_id, name, slug, greetingEmoji} (solo "edit"), onSaved }
  function openClientFormModal(config) {
    ensureClientFormModal();
    const isEdit = config.mode === "edit";
    const nameInput = clientFormModalEl.querySelector("#clientFormNameInput");
    const slugInput = clientFormModalEl.querySelector("#clientFormSlugInput");
    const emojiInput = clientFormModalEl.querySelector("#clientFormEmojiInput");
    const submitBtn = clientFormModalEl.querySelector("#clientFormSubmitBtn");
    const titleEl = clientFormModalEl.querySelector("#clientFormModalTitle");

    nameInput.value = (isEdit && config.client.name) || "";
    slugInput.value = (isEdit && config.client.slug) || "";
    emojiInput.value = (isEdit && config.client.greetingEmoji) || "";
    titleEl.innerHTML = isEdit
      ? `${RS.icon("pencil")} Editar cliente`
      : `${RS.icon("user-plus")} Nuevo cliente`;
    submitBtn.innerHTML = isEdit ? `${RS.icon("check")} Guardar` : `${RS.icon("plus")} Crear cliente`;

    // Autogenera el slug a partir del nombre mientras el admin no haya
    // tocado el campo de slug a mano — igual que createClientFlow()
    // hacía con los dos window.prompt() encadenados.
    let slugTouched = isEdit;
    slugInput.oninput = () => { slugTouched = true; };
    nameInput.oninput = () => {
      if (!slugTouched) slugInput.value = slugifyClientName(nameInput.value);
    };

    submitBtn.onclick = () => {
      const name = nameInput.value.trim();
      const slug = slugifyClientName(slugInput.value.trim());
      const greetingEmoji = emojiInput.value.trim();
      if (!name) { showToast("Ingresá un nombre", "error"); return; }
      if (!slug) { showToast("Ingresá un slug", "error"); return; }
      submitBtn.disabled = true;
      const action = isEdit
        ? RSStore.updateClientBasic(config.client._id, { name, slug, greeting_emoji: greetingEmoji })
        : RSStore.createClient({ name, slug });
      action
        .then((result) => {
          closeClientFormModal();
          showToast(isEdit ? "Cliente actualizado" : "Cliente creado");
          if (config.onSaved) config.onSaved(result);
        })
        .catch((e) => showToast(friendlyClientFormError(e), "error"))
        .finally(() => { submitBtn.disabled = false; });
    };

    clientFormModalEl.classList.add("is-open");
    RS.hydrateIcons();
  }

  /* ---------------------------------------------------------- */
  /* Modal liviano de proyecto (Dashboard, Fase 2): crear un      */
  /* proyecto nuevo para un cliente — mismo componente/patrón que */
  /* el modal de cliente, reemplaza los window.prompt() encadenados. */
  /* Editar un proyecto existente se sigue haciendo desde su propio  */
  /* panel admin (project.html?admin=true), no acá.                */
  /* ---------------------------------------------------------- */

  let projectFormModalEl = null;

  function ensureProjectFormModal() {
    if (projectFormModalEl) return;
    projectFormModalEl = document.createElement("div");
    projectFormModalEl.className = "piece-modal-overlay";
    projectFormModalEl.innerHTML = `<div class="piece-modal">
      <div class="admin-panel__header">
        <div class="admin-panel__title" id="projectFormModalTitle"></div>
        <button class="admin-panel__close" id="projectFormModalClose">${RS.icon("x")}</button>
      </div>
      <div class="admin-panel__body">
        <div class="admin-field">
          <label>Nombre del proyecto</label>
          <input type="text" id="projectFormNameInput" />
        </div>
        <div class="admin-field">
          <label>Slug (para la URL)</label>
          <input type="text" id="projectFormSlugInput" autocomplete="off" spellcheck="false" />
        </div>
        <button class="btn btn--primary" id="projectFormSubmitBtn" style="width:100%; justify-content:center;">${RS.icon("plus")} Crear proyecto</button>
      </div>
    </div>`;
    document.body.appendChild(projectFormModalEl);
    projectFormModalEl.addEventListener("click", (e) => { if (e.target === projectFormModalEl) closeProjectFormModal(); });
    projectFormModalEl.querySelector("#projectFormModalClose").addEventListener("click", closeProjectFormModal);
  }

  function closeProjectFormModal() {
    if (projectFormModalEl) projectFormModalEl.classList.remove("is-open");
  }

  // config: { clientId, clientName, onSaved }
  function openProjectFormModal(config) {
    ensureProjectFormModal();
    const nameInput = projectFormModalEl.querySelector("#projectFormNameInput");
    const slugInput = projectFormModalEl.querySelector("#projectFormSlugInput");
    const submitBtn = projectFormModalEl.querySelector("#projectFormSubmitBtn");
    const titleEl = projectFormModalEl.querySelector("#projectFormModalTitle");

    nameInput.value = "";
    slugInput.value = "";
    titleEl.innerHTML = `${RS.icon("folder-plus")} Nuevo proyecto para ${config.clientName}`;

    let slugTouched = false;
    slugInput.oninput = () => { slugTouched = true; };
    nameInput.oninput = () => {
      if (!slugTouched) slugInput.value = slugifyClientName(nameInput.value);
    };

    submitBtn.onclick = () => {
      const name = nameInput.value.trim();
      const slug = slugifyClientName(slugInput.value.trim());
      if (!name) { showToast("Ingresá un nombre", "error"); return; }
      if (!slug) { showToast("Ingresá un slug", "error"); return; }
      submitBtn.disabled = true;
      RSStore.createProject(config.clientId, { name, slug })
        .then((result) => {
          closeProjectFormModal();
          showToast("Proyecto creado");
          if (config.onSaved) config.onSaved(result);
        })
        .catch((e) => showToast(friendlyClientFormError(e), "error"))
        .finally(() => { submitBtn.disabled = false; });
    };

    projectFormModalEl.classList.add("is-open");
    RS.hydrateIcons();
  }

  function openClientLogoModal() {
    openImageModal({
      title: "Logo del cliente",
      bucket: "logos",
      storagePrefix: `client-logo-${window.CLIENT_DATA.client._id}`,
      set: (v) => { window.CLIENT_DATA.client.logoUrl = v; },
      onSaved: () => { RS.renderTopbar({ showBack: !!document.getElementById("projectHero") }); RS.hydrateIcons(); },
      removedMessage: "Logo quitado, volviendo al punto de marca",
    });
  }

  function openFaviconModal() {
    openImageModal({
      title: "Favicon del portal",
      bucket: "logos",
      storagePrefix: `favicon-${window.CLIENT_DATA.client._id}`,
      set: (v) => { window.CLIENT_DATA.client.faviconUrl = v; },
      onSaved: () => RS.applyBranding(),
      removedMessage: "Favicon quitado",
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
    // principio del boot() de la página (incluye el login real de
    // Supabase Auth si corresponde) — no se vuelve a pedir acá.

    // Delegado sobre #topbar (que nunca se reemplaza) en lugar del botón
    // en sí (que se recrea cada vez que se vuelve a dibujar el topbar).
    const topbarEl = document.getElementById("topbar");
    if (topbarEl && !topbarEl.dataset.adminBound) {
      topbarEl.dataset.adminBound = "true";
      topbarEl.addEventListener("click", (e) => {
        if (e.target.closest("#logoutBtn")) {
          RSStore.signOut().then(() => window.location.reload());
          return;
        }
        if (!e.target.closest("#adminToggle")) return;
        if (!window.RS_ADMIN_MODE) {
          toggleAdminMode().then(() => { if (window.RS_ADMIN_MODE) openPanel(); });
        } else {
          openPanel();
        }
      });
    }

    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (!window.RS_ADMIN_MODE) {
          toggleAdminMode().then(() => { if (window.RS_ADMIN_MODE) openPanel(); });
        } else {
          openPanel();
        }
      }
      if (e.key === "Escape") { closePanel(); closePieceModal(); closeImageModal(); closeListEditorModal(); closeLoginModal(false); }
    });

    if (document.getElementById("blocksContainer")) initBlockDragDrop();
    bindProjectPageEvents();

    if (window.RS_ADMIN_MODE) refreshPage();
    if (wantsAdminViaUrl() && window.RS_ADMIN_MODE) openPanel();
  }

  // Devuelve una Promise — boot() (index.html/project.html) espera a
  // que resuelva antes de dibujar nada, igual que antes esperaba a
  // que window.prompt() (síncrono) devolviera algo.
  // ?preview=1: "Vista previa" desde el Dashboard — un admin entra al
  // portal de un cliente para ver EXACTAMENTE lo que ve el cliente, sin
  // activar el panel admin, aunque su sesión real sea de admin. Se
  // resuelve antes que nada más porque, a diferencia de wantsAdminViaUrl(),
  // esto tiene que GANARLE a una sesión admin ya activa (que si no,
  // activaría el panel igual — ver comentario de detectAdminMode()).
  function wantsPreviewViaUrl() {
    return new URLSearchParams(window.location.search).get("preview") === "1";
  }

  function detectAdminMode() {
    return RSStore.getSession().then((hasSession) => {
      // Distinto de RS_ADMIN_MODE: esto marca "hay una sesión logueada"
      // (aunque sea de un cliente), para que render.js pueda ocultar el
      // botón Admin en ese caso sin afectar al visitante anónimo, que
      // todavía necesita verlo para poder loguearse como admin.
      window.RS_HAS_SESSION = hasSession;
      if (wantsPreviewViaUrl()) {
        setAdminMode(false);
        // El banner de "vista previa" solo tiene sentido para un admin
        // real (link enviado desde el Dashboard); si un cliente llegara
        // a tener ?preview=1 en su URL, no debe verse el banner ni el
        // link "Volver al Dashboard" (esa página no es para él).
        if (!hasSession) { window.RS_PREVIEW_MODE = false; return; }
        return RSStore.isCurrentUserAdmin().then((isAdmin) => { window.RS_PREVIEW_MODE = isAdmin; });
      }
      if (hasSession) {
        // Bug real encontrado 2026-07-14: getSession() solo dice "hay
        // sesión", no "es de un admin" — un cliente logueado (ej. tras
        // aceptar una invitación en el mismo navegador) activaba el
        // panel visualmente aunque el backend rechazara todo con 403.
        return RSStore.isCurrentUserAdmin().then((isAdmin) => setAdminMode(isAdmin));
      }
      if (wantsAdminViaUrl()) return tryActivateAdmin();
      setAdminMode(false);
    });
  }

  // buildPortalAccessSection/tryActivateAdmin/showToast se exponen
  // además para que dashboard.js los reutilice tal cual — el Dashboard
  // no reimplementa el login ni "Acceso al Portal", los toma prestados
  // de acá (única fuente de verdad para ambos).
  window.RSAdmin = { init, toggleAdminMode, detectAdminMode, buildPortalAccessSection, tryActivateAdmin, showToast, openClientFormModal, openProjectFormModal };
})();
