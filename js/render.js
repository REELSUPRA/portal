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

  const STATUS_LABEL = {
    active: "En producción",
    "pending-approval": "Pendiente aprobación",
    planning: "Planificación",
    upcoming: "Próximo",
    review: "En revisión",
    done: "Finalizado",
  };
  const STATUS_CLASS = {
    active: "status-badge--active",
    "pending-approval": "status-badge--review",
    planning: "status-badge--planning",
    upcoming: "status-badge--upcoming",
    review: "status-badge--review",
    done: "status-badge--upcoming",
  };
  const ROADMAP_TAG = { "in-progress": "En curso", upcoming: "Próxima etapa", done: "Completada" };
  const BITACORA_TYPE = {
    milestone: { icon: "flag" },
    delivery: { icon: "film" },
    material: { icon: "inbox" },
    note: { icon: "message-square" },
  };

  // Presets de accesos rápidos (Header Inteligente). Íconos elegidos
  // entre los ya usados y confirmados en este proyecto — evita
  // depender de glifos de marca que Lucide puede no incluir según
  // versión del CDN. El color es un default; item.color lo anula.
  const QUICKLINK_TYPES = {
    whatsapp: { icon: "message-circle", color: "#25D366" },
    drive: { icon: "folder", color: "#4285F4" },
    instagram: { icon: "at-sign", color: "#C13584" },
    youtube: { icon: "play-circle", color: "#FF0000" },
    facebook: { icon: "users", color: "#1877F2" },
    tiktok: { icon: "music-2", color: "#010101" },
    calendar: { icon: "calendar-days", color: "#0a0a0a" },
    custom: { icon: "link", color: "#e02020" },
  };

  // Theme Builder — esquema declarativo. Agregar una variable de tema
  // nueva es agregar una entrada acá; admin.js genera el control
  // (color/select/font/range) y applyTheme() la aplica. No hace falta
  // escribir UI nueva para cada campo.
  const THEME_SCHEMA = [
    { group: "Colores", key: "primaryColor", label: "Color principal", cssVar: "--rs-red", type: "color", default: "#e02020" },
    { group: "Colores", key: "secondaryColor", label: "Color secundario", cssVar: "--rs-secondary", type: "color", default: "#0a0a0a" },
    { group: "Colores", key: "backgroundColor", label: "Color de fondo", cssVar: "--rs-background", type: "color", default: "#ffffff" },
    { group: "Colores", key: "cardColor", label: "Color de tarjetas", cssVar: "--rs-card", type: "color", default: "#ffffff" },
    { group: "Colores", key: "buttonColor", label: "Color de botones", cssVar: "--rs-button", type: "color", default: "#0a0a0a" },
    { group: "Colores", key: "textPrimaryColor", label: "Color de texto principal", cssVar: "--rs-text-primary", type: "color", default: "#0a0a0a" },
    { group: "Colores", key: "textSecondaryColor", label: "Color de texto secundario", cssVar: "--rs-gray-500", type: "color", default: "#6e6e73" },
    { group: "Colores", key: "borderColor", label: "Color de bordes", cssVar: "--rs-gray-100", type: "color", default: "#e9e9eb" },
    { group: "Colores", key: "successColor", label: "Color de éxito", cssVar: "--status-success", type: "color", default: "#1fb463" },
    { group: "Colores", key: "warningColor", label: "Color de advertencia", cssVar: "--status-warning", type: "color", default: "#d69e2e" },
    { group: "Colores", key: "errorColor", label: "Color de error", cssVar: "--status-error", type: "color", default: "#e5484d" },
    { group: "Tipografía", key: "fontFamily", label: "Fuente principal", cssVar: "--font-sans", type: "font", default: "DM Sans", options: ["DM Sans", "Inter", "Poppins", "Manrope"] },
    { group: "Tipografía", key: "titleSize", label: "Tamaño del título", cssVar: "--rs-font-size-title", type: "range", unit: "px", min: 28, max: 56, step: 1, default: 46 },
    { group: "Tipografía", key: "subtitleSize", label: "Tamaño de subtítulos", cssVar: "--rs-font-size-subtitle", type: "range", unit: "px", min: 14, max: 28, step: 1, default: 20 },
    { group: "Tipografía", key: "bodySize", label: "Tamaño del texto", cssVar: "--rs-font-size-body", type: "range", unit: "px", min: 13, max: 19, step: 1, default: 16 },
    { group: "Tipografía", key: "titleWeight", label: "Peso de títulos", cssVar: "--rs-font-weight-title", type: "select", options: ["400", "500", "600", "700", "800"], default: "700" },
    { group: "Tipografía", key: "bodyWeight", label: "Peso del cuerpo", cssVar: "--rs-font-weight-body", type: "select", options: ["400", "500", "600"], default: "400" },
    { group: "Tipografía", key: "lineHeight", label: "Altura de línea", cssVar: "--rs-line-height", type: "range", unit: "", min: 1.2, max: 1.9, step: 0.05, default: 1.5 },
    { group: "Tipografía", key: "letterSpacing", label: "Espaciado de títulos", cssVar: "--rs-letter-spacing", type: "range", unit: "em", min: -0.04, max: 0.04, step: 0.005, default: -0.02 },
  ];

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

  // Progreso general del proyecto = piezas de contenido entregadas.
  // Un solo cálculo, reutilizado por el bloque de piezas, la tarjeta
  // del índice y el hero del detalle — evita tres versiones del mismo
  // porcentaje que puedan desincronizarse.
  function contentProgress(project) {
    const pieces = project.contentPieces || [];
    const delivered = pieces.filter((p) => p.status === "delivered").length;
    const total = pieces.length;
    const percent = total ? Math.round((delivered / total) * 100) : 0;
    return { delivered, total, percent };
  }

  function progressBar(percent, size = "md") {
    return `<div class="progress-bar progress-bar--${size}">
      <div class="progress-bar__track"><div class="progress-bar__fill" style="width:${percent}%"></div></div>
      <span class="progress-bar__label">${percent}%</span>
    </div>`;
  }

  // Etapas del roadmap ya completadas — reutilizado por el Header
  // Inteligente. No es un dato aparte: se deriva de project.roadmap,
  // así que editarlo desde el editor genérico de listas ya lo actualiza.
  function roadmapSummary(project) {
    const roadmap = project.roadmap || [];
    return { done: roadmap.filter((r) => r.status === "done").length, total: roadmap.length };
  }

  function relativeDays(date) {
    const diff = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86400000);
    if (diff <= 0) return "hoy";
    if (diff === 1) return "hace 1 día";
    return `hace ${diff} días`;
  }

  // Última novedad, última entrega y próxima reunión — las tres se
  // derivan de bitacora/calendar (ya editables desde el editor
  // genérico de listas), no son campos manuales aparte que puedan
  // desincronizarse.
  function projectActivity(project) {
    const bitacora = (project.bitacora || [])
      .map((e) => ({ ...e, dateObj: parseISODate(e.date) }))
      .filter((e) => e.dateObj)
      .sort((a, b) => b.dateObj - a.dateObj);

    const today = new Date();
    const nextMeeting = (project.calendar || [])
      .map((e) => ({ ...e, dateObj: parseISODate(e.date) }))
      .filter((e) => e.dateObj && e.dateObj >= today)
      .sort((a, b) => a.dateObj - b.dateObj)[0] || null;

    return {
      lastUpdate: bitacora[0] || null,
      lastDelivery: bitacora.find((e) => e.type === "delivery") || null,
      nextMeeting,
    };
  }

  function quickLinksRow(project) {
    const links = project.links || [];
    if (!links.length) return "";
    return `<div class="quicklinks-row">${links.map((l) => {
      const preset = QUICKLINK_TYPES[l.type] || QUICKLINK_TYPES.custom;
      const color = l.color || preset.color;
      const bg = hexToRgba(color, 0.12) || "transparent";
      const border = hexToRgba(color, 0.35) || color;
      return `<a class="quicklink-pill" href="${esc(l.url)}" target="_blank" rel="noopener" style="color:${esc(color)}; background:${esc(bg)}; border-color:${esc(border)};">${icon(l.icon || preset.icon)}<span>${esc(l.label)}</span></a>`;
    }).join("")}</div>`;
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

  // Recorre THEME_SCHEMA y pisa cada variable CSS con el valor guardado
  // en client.theme (o su default si no fue personalizado). Agregar una
  // variable de tema nueva no toca esta función — solo THEME_SCHEMA.
  function applyTheme() {
    const theme = (window.CLIENT_DATA && window.CLIENT_DATA.client && window.CLIENT_DATA.client.theme) || {};
    const root = document.documentElement.style;

    THEME_SCHEMA.forEach((item) => {
      const raw = theme[item.key];
      const value = raw === undefined || raw === null || raw === "" ? item.default : raw;
      if (value === undefined || value === null || value === "") return;

      if (item.key === "fontFamily") {
        root.setProperty(item.cssVar, `"${value}", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`);
        return;
      }

      root.setProperty(item.cssVar, item.unit ? `${value}${item.unit}` : String(value));

      if (item.cssVar === "--rs-red") {
        const dim = hexToRgba(value, 0.09);
        if (dim) root.setProperty("--rs-red-dim", dim);
      }
    });
  }

  // Favicon dinámico — separado de applyTheme() porque no es una
  // variable CSS, es un atributo de un <link> del <head>.
  function applyBranding() {
    const client = (window.CLIENT_DATA && window.CLIENT_DATA.client) || {};
    const favicon = document.getElementById("favicon");
    if (favicon) favicon.href = client.faviconUrl || "data:,";
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

    const brandMark = data.client.logoUrl
      ? `<img src="${esc(data.client.logoUrl)}" alt="" class="brand__logo" />`
      : `<span class="brand__dot"></span>`;

    const left = showBack
      ? `<a class="back-link" href="index.html">${icon("arrow-left")} Portal</a>`
      : `<div class="brand">${brandMark}${esc(data.agency.name)}
           <span class="brand__client">${esc(data.client.name)}</span></div>`;

    const adminBadge = isAdmin()
      ? `<span class="admin-mode-badge">${icon("move")} ${showBack ? "Modo administrador — arrastrá los bloques para reordenar" : "Modo administrador activo"}</span>`
      : "";

    el.innerHTML = `
      <div class="topbar__inner">
        ${left}
        <div class="topbar__actions">
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
      const { total, percent } = contentProgress(p);
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
        <span class="status-badge ${STATUS_CLASS[tone]}">
          <span class="status-badge__dot"></span>${esc(STATUS_LABEL[tone] || p.status)}
        </span>
        ${total ? progressBar(percent, "sm") : ""}
        <div class="project-card__footer">
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

  // Cada link se presenta como botón premium, tarjeta o enlace simple
  // según links[].style — reutiliza .btn y .side-card ya existentes,
  // .link-card es la única clase chica nueva.
  function blockLinks(project) {
    const links = project.links || [];
    if (!links.length) return `<p class="empty-hint">No hay links cargados todavía.</p>`;

    const buttons = links.filter((l) => l.style === "button");
    const cards = links.filter((l) => l.style === "card");
    const simple = links.filter((l) => !l.style || l.style === "link");

    const buttonsHtml = buttons.length
      ? `<div class="link-buttons">${buttons.map((l) => `
          <a class="btn btn--primary" href="${esc(l.url)}" target="_blank" rel="noopener">${icon(l.icon || "link")}${esc(l.label)}</a>`).join("")}</div>`
      : "";

    const cardsHtml = cards.length
      ? `<div class="link-cards">${cards.map((l) => `
          <a class="link-card" href="${esc(l.url)}" target="_blank" rel="noopener">
            <span class="link-card__icon">${icon(l.icon || "link")}</span>
            <span class="link-card__label">${esc(l.label)}</span>
            ${icon("arrow-up-right", "link-card__arrow")}
          </a>`).join("")}</div>`
      : "";

    const simpleHtml = simple.length
      ? `<ul class="link-list">${simple.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${icon(l.icon || "link")}${esc(l.label)}</a></li>`).join("")}</ul>`
      : "";

    return `${buttonsHtml}${cardsHtml}${simpleHtml}`;
  }

  // ----- Piezas de contenido -----

  function blockContentPieces(project) {
    const pieces = project.contentPieces || [];
    const { delivered } = contentProgress(project);

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

  // La Bitácora reutiliza el mismo componente visual de timeline que
  // ya existe para el Roadmap (línea + punto) — solo agrega un ícono
  // por tipo de evento en vez del estado in-progress/upcoming/done.
  function blockBitacora(project) {
    const entries = (project.bitacora || [])
      .map((e) => ({ ...e, dateObj: parseISODate(e.date) }))
      .filter((e) => e.dateObj)
      .sort((a, b) => b.dateObj - a.dateObj);

    if (!entries.length) return `<p class="empty-hint">Todavía no hay novedades registradas.</p>`;

    return `<div class="roadmap">${entries.map((e) => {
      const type = BITACORA_TYPE[e.type] ? e.type : "note";
      return `
      <div class="roadmap__item roadmap__item--${type}">
        <span class="roadmap__dot"></span>
        <div class="roadmap__phase">${icon(BITACORA_TYPE[type].icon)}${esc(e.text)}</div>
        <span class="roadmap__tag">${esc(formatDateHuman(e.dateObj))}</span>
      </div>`;
    }).join("")}</div>`;
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
    // "links" ya no se dibuja como bloque aparte (ver defaultBlockOrder
    // en data.js) — se integró al Header Inteligente como accesos
    // rápidos. Se deja la entrada acá porque el editor genérico de
    // listas (RS.LIST_SCHEMAS) lee título/ícono de este registro.
    links: { title: "Accesos rápidos", icon: "zap", render: blockLinks },
    bitacora: { title: "Bitácora", icon: "notebook-pen", render: blockBitacora },
    upsells: { title: "Mejoras disponibles", icon: "sparkles", render: blockUpsells },
  };

  // Editor genérico de listas — esquema declarativo por tipo de dato.
  // admin.js lee esto (más título/ícono de BLOCK_DEFS, sin duplicarlos)
  // para generar un único editor CRUD reutilizado por los 8 bloques de
  // lista. Agregar un bloque de lista nuevo en el futuro = una entrada
  // acá (+ una en BLOCK_DEFS para el render de solo lectura) — no hace
  // falta escribir un editor nuevo.
  const LIST_SCHEMAS = {
    roadmap: {
      fields: [
        { key: "phase", label: "Fase", type: "text" },
        { key: "detail", label: "Detalle", type: "textarea" },
        { key: "status", label: "Estado", type: "select", options: ["in-progress", "upcoming", "done"] },
      ],
      newItem: () => ({ phase: "", detail: "", status: "upcoming" }),
      itemLabel: (item) => item.phase || "Nueva fase",
    },
    bitacora: {
      fields: [
        { key: "date", label: "Fecha", type: "date" },
        { key: "type", label: "Tipo", type: "select", options: ["milestone", "delivery", "material", "note"] },
        { key: "text", label: "Texto", type: "text" },
      ],
      newItem: () => ({ date: "", type: "note", text: "" }),
      itemLabel: (item) => item.text || "Nueva novedad",
    },
    calendar: {
      fields: [
        { key: "date", label: "Fecha", type: "date" },
        { key: "label", label: "Descripción", type: "text" },
      ],
      newItem: () => ({ date: "", label: "" }),
      itemLabel: (item) => item.label || "Nuevo evento",
    },
    resources: {
      fields: [
        { key: "label", label: "Nombre", type: "text" },
        { key: "url", label: "URL", type: "text" },
      ],
      newItem: () => ({ label: "", url: "" }),
      itemLabel: (item) => item.label || "Nuevo recurso",
    },
    documents: {
      fields: [
        { key: "label", label: "Nombre", type: "text" },
        { key: "url", label: "URL", type: "text" },
      ],
      newItem: () => ({ label: "", url: "" }),
      itemLabel: (item) => item.label || "Nuevo documento",
    },
    pendingMaterial: {
      primitive: true,
      fields: [{ key: "value", label: "Descripción", type: "text" }],
      newItem: () => "",
      itemLabel: (item) => item || "Sin descripción",
    },
    nextSteps: {
      primitive: true,
      fields: [{ key: "value", label: "Descripción", type: "text" }],
      newItem: () => "",
      itemLabel: (item) => item || "Sin descripción",
    },
    upsells: {
      fields: [
        { key: "title", label: "Título", type: "text" },
        { key: "description", label: "Descripción", type: "textarea" },
        { key: "ctaLabel", label: "Texto del botón", type: "text" },
        { key: "ctaUrl", label: "Link", type: "text" },
      ],
      newItem: () => ({ title: "", description: "", ctaLabel: "Consultar", ctaUrl: "" }),
      itemLabel: (item) => item.title || "Nueva mejora",
    },
    links: {
      fields: [
        { key: "label", label: "Nombre", type: "text" },
        { key: "url", label: "URL", type: "text" },
        { key: "type", label: "Tipo", type: "select", options: Object.keys(QUICKLINK_TYPES) },
        { key: "icon", label: "Ícono (opcional, lucide.dev/icons — vacío usa el del tipo)", type: "text" },
        { key: "color", label: "Color (opcional, anula el del tipo)", type: "color" },
      ],
      newItem: () => ({ label: "", url: "", type: "custom", icon: "", color: "" }),
      itemLabel: (item) => item.label || "Nuevo acceso",
    },
  };

  /* ----------------------------------------------------------
     PROJECT DETAIL PAGE
     ---------------------------------------------------------- */

  function renderProjectDetail() {
    const project = getProjectFromURL();
    if (!project) return;
    const tone = inferStatusTone(project);
    const contentProgressBlock = contentProgress(project);
    const roadmapStats = roadmapSummary(project);
    const pendingCount = (project.pendingMaterial || []).length;
    const activity = projectActivity(project);

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
      </div>
      <div class="smart-header">
        ${quickLinksRow(project)}
        ${contentProgressBlock.total ? `
          <div class="smart-header__progress-label">Progreso del proyecto</div>
          ${progressBar(contentProgressBlock.percent, "lg")}` : ""}
        <div class="smart-header__stats">
          <div class="smart-stat"><div class="smart-stat__value">${roadmapStats.done}/${roadmapStats.total}</div><div class="smart-stat__label">Etapas completadas</div></div>
          <div class="smart-stat"><div class="smart-stat__value">${pendingCount}</div><div class="smart-stat__label">Material pendiente</div></div>
        </div>
        <div class="smart-header__activity">
          ${activity.lastUpdate
            ? `<div class="activity-chip">${icon("clock")}<span>Última actualización <strong>${esc(relativeDays(activity.lastUpdate.dateObj))}</strong> — ${esc(activity.lastUpdate.text)}</span></div>`
            : `<div class="activity-chip">${icon("clock")}<span>Todavía no hay novedades en la bitácora</span></div>`}
          ${activity.lastDelivery
            ? `<div class="activity-chip">${icon("film")}<span>Última entrega: <strong>${esc(formatDateHuman(activity.lastDelivery.dateObj))}</strong></span></div>`
            : ""}
          ${activity.nextMeeting
            ? `<div class="activity-chip">${icon("calendar")}<span>Próxima reunión: <strong>${esc(formatDateHuman(activity.nextMeeting.dateObj))}</strong> — ${esc(activity.nextMeeting.label)}</span></div>`
            : `<div class="activity-chip">${icon("calendar")}<span>Sin próximas reuniones agendadas</span></div>`}
        </div>
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
    esc, icon, isAdmin, applyTheme, applyBranding,
    renderTopbar, renderAnnouncement, renderHero, renderProjectGrid,
    renderProjectDetail, renderBlocks, navigateCalendar,
    getProjectFromURL, hydrateIcons, projectAvatar,
    BLOCK_DEFS, STATUS_LABEL, THEME_SCHEMA, LIST_SCHEMAS,
  };
})();
