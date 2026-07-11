/**
 * ============================================================
 * REELSUPRA — RENDER ENGINE
 * ============================================================
 * Funciones de renderizado. Todo el texto viene de
 * window.CLIENT_DATA (data.js). admin.js decide cuándo estamos
 * en modo administrador (window.RS_ADMIN_MODE) y qué hacer con
 * los eventos de arrastre / edición; acá solo se dibuja.
 * ============================================================
 */

const RS = (() => {

  const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const WEEKDAYS = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

  const STATUS_LABEL = { active: "En producción", upcoming: "Próximo", review: "En revisión", done: "Finalizado" };
  const STATUS_CLASS = { active: "status-badge--active", upcoming: "status-badge--upcoming", review: "status-badge--review", done: "status-badge--upcoming" };
  const ROADMAP_TAG = { "in-progress": "En curso", upcoming: "Próxima etapa", done: "Completada" };

  // Estado de navegación del calendario (mes que se está mostrando).
  const calendarState = { year: null, month: null };

  function esc(str) {
    if (str === undefined || str === null) return "";
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
  }

  function icon(name, extraClass = "") {
    return `<i data-lucide="${name}" class="icon ${extraClass}"></i>`;
  }

  function isAdmin() {
    return !!window.RS_ADMIN_MODE;
  }

  function inferStatusTone(project) {
    return project.statusTone || "active";
  }

  function hexToRgba(hex, alpha) {
    const clean = String(hex).replace("#", "");
    const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
    const num = parseInt(full, 16);
    if (Number.isNaN(num)) return null;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Aplica el color de marca del cliente a las variables CSS que ya
  // maneja todo el sistema de diseño — no crea un sistema de theming
  // nuevo, solo pisa la variable existente en runtime.
  function applyTheme() {
    const color = window.CLIENT_DATA && window.CLIENT_DATA.client && window.CLIENT_DATA.client.primaryColor;
    if (!color) return;
    const dim = hexToRgba(color, 0.09);
    const root = document.documentElement.style;
    root.setProperty("--rs-red", color);
    if (dim) root.setProperty("--rs-red-dim", dim);
  }

  function parseISODate(str) {
    if (!str) return null;
    const [y, m, d] = str.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  function formatDateHuman(date) {
    if (!date) return "";
    return `${date.getDate()} de ${MONTHS[date.getMonth()].toLowerCase()}`;
  }

  /* ----------------------------------------------------------
     TOPBAR + ANNOUNCEMENT
     ---------------------------------------------------------- */

  function renderTopbar({ showBack = false } = {}) {
    const data = window.CLIENT_DATA;
    const el = document.getElementById("topbar");
    if (!el) return;

    const left = showBack
      ? `<a class="back-link" href="index.html">${icon("arrow-left")} Portal</a>`
      : `<div class="brand"><span class="brand__dot"></span>${esc(data.agency.name)}
           <span class="brand__client">${esc(data.client.name)}</span></div>`;

    const adminBadge = isAdmin()
      ? `<span class="admin-mode-badge">${icon("move")} Modo administrador — arrastrá los bloques para reordenar</span>`
      : "";

    el.innerHTML = `
      <div class="topbar__inner">
        ${left}
        <div style="display:flex; align-items:center; gap: var(--space-4);">
          ${adminBadge}
          <button class="admin-toggle" id="adminToggle" aria-label="Abrir modo administrador">
            ${icon("settings")} Admin
          </button>
        </div>
      </div>`;
  }

  function renderAnnouncement() {
    const data = window.CLIENT_DATA;
    const el = document.getElementById("announcement");
    if (!el) return;
    if (!data.announcement || !data.announcement.active) {
      el.style.display = "none";
      return;
    }
    el.style.display = "";
    el.innerHTML = `<div class="announcement__inner">${icon("info")}<span>${esc(data.announcement.text)}</span></div>`;
  }

  /* ----------------------------------------------------------
     INDEX PAGE
     ---------------------------------------------------------- */

  function renderHero() {
    const data = window.CLIENT_DATA;
    const el = document.getElementById("hero");
    if (!el) return;

    const coverEditBtn = isAdmin()
      ? `<button class="btn btn--ghost btn--sm cover-edit-btn" id="editCoverBtn">${icon("image-plus")} Portada</button>`
      : "";

    const cover = data.client.coverImage
      ? `<div class="hero__cover"><img src="${esc(data.client.coverImage)}" alt="" />${coverEditBtn}</div>`
      : isAdmin()
        ? `<div class="hero__cover hero__cover--empty">${coverEditBtn}</div>`
        : "";

    el.innerHTML = `
      ${cover}
      <div class="hero__eyebrow">Portal del cliente</div>
      <h1 class="hero__title">Bienvenido, ${esc(data.client.name)} ${data.client.greetingEmoji || ""}</h1>
      <p class="hero__message">${esc(data.client.welcomeMessage)}</p>`;
  }

  function projectAvatar(p, size = 26) {
    if (p.logoUrl) {
      return `<img src="${p.logoUrl}" alt="${esc(p.name)}" class="project-logo" style="width:${size}px;height:${size}px;" />`;
    }
    return `<span class="project-card__emoji" style="font-size:${size - 4}px;">${p.emoji || "📁"}</span>`;
  }

  function renderProjectGrid() {
    const data = window.CLIENT_DATA;
    const el = document.getElementById("projectGrid");
    if (!el) return;

    el.innerHTML = data.projects.map((p, i) => {
      const tone = inferStatusTone(p);
      return `
      <article class="project-card">
        <div class="project-card__top">
          ${projectAvatar(p, 30)}
          <span class="project-card__id">${esc(p.plan)} / ${String(i + 1).padStart(2, "0")}</span>
        </div>
        <div>
          <h2 class="project-card__name">${esc(p.name)}</h2>
          <div class="project-card__meta" style="margin-top: var(--space-3);">
            <span class="tag">${esc(p.sector)}</span>
            <span class="tag">${esc(p.language)}</span>
          </div>
        </div>
        <p class="project-card__objective">${esc(p.objective)}</p>
        <div class="project-card__footer">
          <span class="status-badge ${STATUS_CLASS[tone]}">
            <span class="status-badge__dot"></span>${esc(STATUS_LABEL[tone] || p.status)}
          </span>
          <a class="btn btn--primary" href="project.html?id=${encodeURIComponent(p.id)}">
            Ingresar al proyecto ${icon("arrow-right")}
          </a>
        </div>
      </article>`;
    }).join("");
  }

  /* ----------------------------------------------------------
     PROJECT LOOKUP
     ---------------------------------------------------------- */

  function getProjectFromURL() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const data = window.CLIENT_DATA;
    return data.projects.find((p) => p.id === id) || data.projects[0];
  }

  /* ----------------------------------------------------------
     BLOCK RENDER FUNCTIONS — cada una devuelve el HTML interno
     del bloque (sin el envoltorio de tarjeta, eso lo pone
     renderBlocks()).
     ---------------------------------------------------------- */

  function blockGoals(project) {
    return `<ul id="goalsList" class="check-list">${(project.goals || [])
      .map((g) => `<li>${icon("target")}<span>${esc(g)}</span></li>`).join("")}</ul>`;
  }

  function blockRoadmap(project) {
    return `<div class="roadmap">${(project.roadmap || []).map((r) => `
      <div class="roadmap__item roadmap__item--${r.status}">
        <span class="roadmap__dot"></span>
        <div class="roadmap__phase">${esc(r.phase)}</div>
        <div class="roadmap__detail">${esc(r.detail)}</div>
        <span class="roadmap__tag">${esc(ROADMAP_TAG[r.status] || r.status)}</span>
      </div>`).join("")}</div>`;
  }

  function blockNextSteps(project) {
    return `<ul class="check-list">${(project.nextSteps || [])
      .map((n) => `<li>${icon("arrow-right")}<span>${esc(n)}</span></li>`).join("")}</ul>`;
  }

  function blockPending(project) {
    return `<ul class="check-list">${(project.pendingMaterial || [])
      .map((n) => `<li>${icon("clock")}<span>${esc(n)}</span></li>`).join("")}</ul>`;
  }

  function blockResources(project) {
    return `<ul class="link-list">${(project.resources || [])
      .map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${icon("bookmark")}${esc(r.label)}</a></li>`).join("")}</ul>`;
  }

  function blockDocuments(project) {
    return `<ul class="link-list">${(project.documents || [])
      .map((d) => `<li><a href="${esc(d.url)}" target="_blank" rel="noopener">${icon("file-text")}${esc(d.label)}</a></li>`).join("")}</ul>`;
  }

  function blockLinks(project) {
    return `<ul class="link-list">${(project.links || [])
      .map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${icon("link")}${esc(l.label)}</a></li>`).join("")}</ul>`;
  }

  // ----- Piezas de contenido -----

  function blockContentPieces(project) {
    const pieces = project.contentPieces || [];
    const delivered = pieces.filter((p) => p.status === "delivered").length;

    const chips = pieces.map((p, i) => {
      const cls = p.status === "delivered" ? "content-piece--delivered" : "content-piece--pending";
      const clickable = isAdmin() ? `data-admin-edit-piece="${p.id}" role="button" tabindex="0"` : "";
      return `<div class="content-piece ${cls}" ${clickable} title="${esc(p.title || `Pieza ${i + 1}`)}">
        <span class="content-piece__num">${p.status === "delivered" ? icon("check") : i + 1}</span>
      </div>`;
    }).join("");

    // Próximas publicaciones: piezas con fecha, ordenadas.
    const withDate = pieces
      .filter((p) => p.publishDate)
      .map((p) => ({ ...p, dateObj: parseISODate(p.publishDate) }))
      .sort((a, b) => a.dateObj - b.dateObj);

    const upcomingList = withDate.length
      ? `<ul class="upcoming-list">${withDate.map((p) => `
          <li>
            <span class="calendar-date calendar-date--sm">${p.dateObj.getDate()}</span>
            <div class="upcoming-list__info">
              <div class="upcoming-list__title">${esc(p.title || "Video sin título")}</div>
              ${p.note ? `<div class="upcoming-list__note">${esc(p.note)}</div>` : ""}
            </div>
            <span class="tag">${esc(formatDateHuman(p.dateObj))}</span>
            ${p.videoUrl ? `<a class="btn btn--ghost btn--sm" href="${esc(p.videoUrl)}" target="_blank" rel="noopener">${icon("play")} Ver</a>` : ""}
          </li>`).join("")}</ul>`
      : `<p class="empty-hint">Todavía no hay fechas de publicación cargadas.</p>`;

    return `
      <div class="content-piece-head">
        <div class="content-grid">${chips}</div>
        <span class="content-piece-count">${delivered} de ${pieces.length} piezas entregadas</span>
      </div>
      ${upcomingList}`;
  }

  // ----- Bitácora -----

  function blockBitacora(project) {
    const entries = (project.bitacora || [])
      .map((e) => ({ ...e, dateObj: parseISODate(e.date) }))
      .filter((e) => e.dateObj)
      .sort((a, b) => b.dateObj - a.dateObj);

    if (!entries.length) return `<p class="empty-hint">Todavía no hay novedades registradas.</p>`;

    return `<ul class="upcoming-list">${entries.map((e) => `
      <li>
        <span class="calendar-date calendar-date--sm">${e.dateObj.getDate()}</span>
        <div class="upcoming-list__info">
          <div class="upcoming-list__title">${esc(e.text)}</div>
          <span class="upcoming-list__note">${formatDateHuman(e.dateObj)}</span>
        </div>
      </li>`).join("")}</ul>`;
  }

  // ----- Mejoras disponibles (Upsells) -----

  function blockUpsells(project) {
    const items = project.upsells || [];
    if (!items.length) return `<p class="empty-hint">No hay mejoras sugeridas por el momento.</p>`;

    return `<ul class="upsell-list">${items.map((u) => `
      <li class="upsell-item">
        <div class="upsell-item__info">
          <div class="upsell-item__title">${icon("sparkles")}${esc(u.title)}</div>
          <p class="upsell-item__desc">${esc(u.description)}</p>
        </div>
        ${u.ctaUrl ? `<a class="btn btn--ghost btn--sm" href="${esc(u.ctaUrl)}" target="_blank" rel="noopener">${esc(u.ctaLabel || "Consultar")}</a>` : ""}
      </li>`).join("")}</ul>`;
  }

  // ----- Calendario -----

  function getCalendarEvents(project) {
    const events = (project.calendar || []).map((c) => ({
      date: parseISODate(c.date), label: c.label, note: "", type: "reunion",
    }));

    (project.contentPieces || []).forEach((p) => {
      if (!p.publishDate) return;
      events.push({
        date: parseISODate(p.publishDate),
        label: p.title || "Publicación sugerida",
        note: p.note || "",
        type: "publicacion",
      });
    });

    return events.filter((e) => e.date);
  }

  function blockCalendar(project) {
    const events = getCalendarEvents(project);
    const today = new Date();

    if (calendarState.year === null) {
      // Arranca en el mes del primer evento futuro, si no hay, en el mes actual.
      const upcoming = events.filter((e) => e.date >= today).sort((a, b) => a.date - b.date)[0];
      const ref = upcoming ? upcoming.date : today;
      calendarState.year = ref.getFullYear();
      calendarState.month = ref.getMonth();
    }

    const year = calendarState.year;
    const month = calendarState.month;
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7; // lunes = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const eventsByDay = {};
    events.forEach((e) => {
      if (e.date.getFullYear() === year && e.date.getMonth() === month) {
        const d = e.date.getDate();
        (eventsByDay[d] = eventsByDay[d] || []).push(e);
      }
    });

    let cells = "";
    for (let i = 0; i < startOffset; i++) cells += `<div class="cal-cell cal-cell--empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const dayEvents = eventsByDay[d] || [];
      const isToday = year === today.getFullYear() && month === today.getMonth() && d === today.getDate();
      cells += `<div class="cal-cell ${isToday ? "cal-cell--today" : ""}">
        <span class="cal-cell__num">${d}</span>
        ${dayEvents.map((e) => `<span class="cal-event cal-event--${e.type}" title="${esc(e.note || "")}">${esc(e.label)}</span>`).join("")}
      </div>`;
    }

    return `
      <div class="cal-toolbar">
        <span class="cal-toolbar__month">${MONTHS[month]} ${year}</span>
        <div class="cal-toolbar__nav">
          <button class="cal-nav-btn" data-cal-nav="-1" aria-label="Mes anterior">${icon("chevron-left")}</button>
          <button class="cal-nav-btn" data-cal-nav="today" aria-label="Hoy">Hoy</button>
          <button class="cal-nav-btn" data-cal-nav="1" aria-label="Mes siguiente">${icon("chevron-right")}</button>
        </div>
      </div>
      <div class="cal-legend">
        <span><span class="cal-dot cal-dot--reunion"></span>Reunión</span>
        <span><span class="cal-dot cal-dot--publicacion"></span>Publicación sugerida</span>
      </div>
      <div class="cal-grid cal-grid--head">${WEEKDAYS.map((w) => `<span>${w}</span>`).join("")}</div>
      <div class="cal-grid">${cells}</div>`;
  }

  /* ----------------------------------------------------------
     BLOCK REGISTRY
     ---------------------------------------------------------- */

  const BLOCK_DEFS = {
    goals: { title: "Objetivos", icon: "target", render: blockGoals },
    roadmap: { title: "Hoja de ruta", icon: "git-branch", render: blockRoadmap },
    contentPieces: { title: "Piezas de contenido", icon: "film", render: blockContentPieces },
    calendar: { title: "Calendario", icon: "calendar", render: blockCalendar },
    nextSteps: { title: "Próximos pasos", icon: "arrow-right-circle", render: blockNextSteps },
    pendingMaterial: { title: "Material pendiente", icon: "hourglass", render: blockPending },
    resources: { title: "Recursos", icon: "bookmark", render: blockResources },
    documents: { title: "Documentos", icon: "file-text", render: blockDocuments },
    links: { title: "Links importantes", icon: "link", render: blockLinks },
    bitacora: { title: "Bitácora", icon: "notebook-pen", render: blockBitacora },
    upsells: { title: "Mejoras disponibles", icon: "sparkles", render: blockUpsells },
  };

  /* ----------------------------------------------------------
     PROJECT DETAIL PAGE
     ---------------------------------------------------------- */

  function renderProjectDetail() {
    const project = getProjectFromURL();
    if (!project) return;
    const tone = inferStatusTone(project);

    const heroEl = document.getElementById("projectHero");
    const logoAdmin = isAdmin()
      ? `<button class="logo-edit-btn" id="editLogoBtn" title="Cambiar logo">${icon("image-plus")}</button>`
      : "";

    heroEl.innerHTML = `
      <div class="project-hero__top">
        <span class="status-badge ${STATUS_CLASS[tone]}"><span class="status-badge__dot"></span>${esc(STATUS_LABEL[tone] || project.status)}</span>
        <span class="project-card__id">${esc(project.plan)}</span>
      </div>
      <div class="project-hero__title-row">
        <span class="project-hero__logo-wrap">${projectAvatar(project, 44)}${logoAdmin}</span>
        <h1 class="project-hero__title">${esc(project.name)}</h1>
      </div>
      <p class="project-hero__objective">${esc(project.objective)}</p>
      <div class="meta-row">
        <div class="meta-item"><div class="meta-item__label">Sector</div><div class="meta-item__value">${esc(project.sector)}</div></div>
        <div class="meta-item"><div class="meta-item__label">Idioma</div><div class="meta-item__value">${esc(project.language)}</div></div>
        <div class="meta-item"><div class="meta-item__label">Público</div><div class="meta-item__value">${esc(project.audience)}</div></div>
        <div class="meta-item"><div class="meta-item__label">Plan contratado</div><div class="meta-item__value">${esc(project.plan)} — ${esc(project.planDetail)}</div></div>
      </div>`;

    document.title = `${project.name} — Portal ${window.CLIENT_DATA.agency.name}`;
    renderBlocks(project);
  }

  function renderBlocks(project) {
    const container = document.getElementById("blocksContainer");
    if (!container) return;
    const admin = isAdmin();
    const blocks = project.blocks && project.blocks.length ? project.blocks : Object.keys(BLOCK_DEFS).map((id) => ({ id, visible: true }));

    container.innerHTML = blocks
      .filter((b) => admin || b.visible)
      .map((b) => {
        const def = BLOCK_DEFS[b.id];
        if (!def) return "";
        const hiddenClass = !b.visible ? "block-card--hidden" : "";
        return `
        <section class="block-card ${hiddenClass}" data-block-id="${b.id}" ${admin ? 'draggable="true"' : ""}>
          <header class="block-card__head">
            ${admin ? `<span class="drag-handle" title="Arrastrar para reordenar">${icon("grip-vertical")}</span>` : ""}
            <h3 class="block-card__title">${icon(def.icon)}${def.title}</h3>
            ${admin ? `<button class="block-visibility-toggle" data-toggle-block="${b.id}" title="${b.visible ? "Ocultar del cliente" : "Mostrar al cliente"}">${icon(b.visible ? "eye" : "eye-off")}</button>` : ""}
          </header>
          <div class="block-card__body">${def.render(project)}</div>
        </section>`;
      }).join("");

    hydrateIcons();
  }

  function navigateCalendar(delta) {
    if (delta === "today") {
      calendarState.year = null;
      calendarState.month = null;
    } else {
      calendarState.month += delta;
      if (calendarState.month < 0) { calendarState.month = 11; calendarState.year--; }
      if (calendarState.month > 11) { calendarState.month = 0; calendarState.year++; }
    }
    renderProjectDetail();
  }

  function hydrateIcons() {
    if (window.lucide) window.lucide.createIcons();
  }

  return {
    esc, icon, isAdmin, applyTheme,
    renderTopbar, renderAnnouncement, renderHero, renderProjectGrid,
    renderProjectDetail, renderBlocks, navigateCalendar,
    getProjectFromURL, hydrateIcons, projectAvatar,
    BLOCK_DEFS, STATUS_LABEL,
  };
})();
