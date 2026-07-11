/**
 * ============================================================
 * REELSUPRA — CLIENT DATA
 * ============================================================
 * ÚNICO archivo que necesitas editar para reutilizar el portal
 * con un cliente nuevo. No toques HTML, CSS ni el resto del JS.
 *
 * NOVEDADES de esta versión:
 *  - logoUrl: imagen del proyecto (reemplaza al emoji si existe).
 *    Se carga desde el panel admin (sube una imagen -> queda en
 *    base64 acá mismo) o pegando directamente una URL de imagen.
 *  - contentPieces: cada video del plan mensual, con su fecha
 *    sugerida de publicación y su link. La fecha se carga UNA
 *    sola vez acá: el calendario la lee automáticamente, no hace
 *    falta cargarla de nuevo en "calendar".
 *  - blocks: el orden (y visibilidad) de los módulos de la
 *    página de este proyecto. Se reordena arrastrando en modo
 *    administrador; cada proyecto guarda su propio orden.
 * ============================================================
 */

// Orden por defecto de los módulos reordenables de un proyecto.
// (El encabezado y la ficha del proyecto siempre van fijos arriba).
function defaultBlockOrder() {
  return [
    { id: "goals", visible: true },
    { id: "roadmap", visible: true },
    { id: "contentPieces", visible: true },
    { id: "calendar", visible: true },
    { id: "nextSteps", visible: true },
    { id: "pendingMaterial", visible: true },
    { id: "resources", visible: true },
    { id: "documents", visible: true },
    { id: "links", visible: true },
  ];
}

window.CLIENT_DATA = {

  agency: {
    name: "ReelSupra",
    tagline: "Sistemas de contenido para marcas que escalan",
  },

  client: {
    name: "Juan Guzmán",
    greetingEmoji: "⚡",
    welcomeMessage:
      "Este es tu portal ReelSupra. Acá vas a encontrar el estado de cada proyecto, " +
      "qué sigue, y todo el material y los recursos que necesitás tener a mano — " +
      "sin buscar en chats ni carpetas sueltas.",
  },

  announcement: {
    active: true,
    text:
      "Juan viaja del 4 al 11 de este mes. Durante ese período se trabaja con " +
      "material ya grabado para ambos proyectos.",
  },

  projects: [
    {
      id: "jga-realtor",
      emoji: "🏡",
      logoUrl: null, // Ej: "https://..." o base64 subido desde el panel admin
      name: "JGA Group Services LLC",
      sector: "Real Estate",
      language: "Español",
      audience: "Comunidad latina en Florida",
      plan: "RS-08",
      planDetail: "8 videos mensuales",
      status: "En producción",
      statusTone: "active",

      objective:
        "Posicionar la marca personal de Juan como realtor de referencia para la " +
        "comunidad latina en Florida, generando autoridad y consultas calificadas.",

      goals: [
        "Generar autoridad en el nicho inmobiliario",
        "Generar consultas de clientes potenciales",
        "Mostrar cierres de ventas reales",
        "Posicionar la marca personal de Juan",
      ],

      roadmap: [
        {
          phase: "Fase 1 — Producción con material existente",
          status: "in-progress",
          detail: "Cierres de ventas, propiedades y contenido ya grabado (4–11 del mes, viaje de Juan).",
        },
        {
          phase: "Fase 2 — Producción regular",
          status: "upcoming",
          detail: "8 videos mensuales según plan RS-08, grabación y edición en ciclo continuo.",
        },
        {
          phase: "Fase 3 — Optimización de embudo",
          status: "upcoming",
          detail: "Ajuste de landing page y automatizaciones según resultados del primer mes.",
        },
      ],

      // Cada pieza es un video del plan mensual. "publishDate" alimenta
      // automáticamente el módulo Calendario — no se carga dos veces.
      contentPieces: [
        {
          id: "cp1", title: "Cierre de venta — Propiedad Doral", status: "delivered",
          publishDate: "2026-07-08", videoUrl: "https://drive.google.com/", note: "Publicar con caption de autoridad.",
        },
        { id: "cp2", title: "", status: "pending", publishDate: "2026-07-11", videoUrl: "", note: "" },
        { id: "cp3", title: "", status: "pending", publishDate: "", videoUrl: "", note: "" },
        { id: "cp4", title: "", status: "pending", publishDate: "", videoUrl: "", note: "" },
        { id: "cp5", title: "", status: "pending", publishDate: "", videoUrl: "", note: "" },
        { id: "cp6", title: "", status: "pending", publishDate: "", videoUrl: "", note: "" },
        { id: "cp7", title: "", status: "pending", publishDate: "", videoUrl: "", note: "" },
        { id: "cp8", title: "", status: "pending", publishDate: "", videoUrl: "", note: "" },
      ],

      nextSteps: [
        "Seleccionar clips de cierres y propiedades ya grabados",
        "Editar primer lote de contenido para la semana del viaje",
        "Definir calendario de publicación con Juan",
      ],

      pendingMaterial: [
        "Confirmación de propiedades a destacar este mes",
        "Testimonios de clientes recientes (si están disponibles)",
      ],

      resources: [
        { label: "Guion base para redes", url: "#" },
        { label: "Banco de música con licencia", url: "#" },
        { label: "Guía de hashtags — nicho inmobiliario Florida", url: "#" },
      ],

      documents: [
        { label: "Propuesta y alcance RS-08", url: "#" },
        { label: "Brief de marca — JGA Realtor", url: "#" },
      ],

      links: [
        { label: "Carpeta de material en bruto", url: "#" },
        { label: "Calendario editorial compartido", url: "#" },
      ],

      // Solo reuniones u otros eventos manuales. Las publicaciones
      // sugeridas se agregan solas desde contentPieces.
      calendar: [
        { date: "2026-07-04", label: "Inicio de viaje de Juan" },
        { date: "2026-07-11", label: "Regreso de Juan" },
        { date: "2026-07-15", label: "Revisión mensual de resultados" },
      ],

      blocks: defaultBlockOrder(),
    },

    {
      id: "jga-closets",
      emoji: "🚪",
      logoUrl: null,
      name: "JGA Closet Upgrade",
      sector: "Closets personalizados",
      language: "Inglés",
      audience: "Propietarios de vivienda en EE.UU.",
      plan: "RS-08",
      planDetail: "8 videos mensuales",
      status: "En producción",
      statusTone: "active",

      objective:
        "Posicionar a JGA Closet Upgrade como referencia en instalación de closets " +
        "personalizados, mostrando transformaciones reales que generen confianza y clientes.",

      goals: [
        "Mostrar transformaciones antes y después",
        "Generar confianza en el proceso de instalación",
        "Conseguir clientes nuevos",
      ],

      roadmap: [
        {
          phase: "Fase 1 — Producción con material existente",
          status: "in-progress",
          detail: "B-roll, instalaciones, before & after y detalles de procesos ya grabados.",
        },
        {
          phase: "Fase 2 — Narración en inglés",
          status: "upcoming",
          detail:
            "Evaluación de clonación de voz de Juan (IA) para narración en inglés. " +
            "Si la calidad no es profesional, se usará música, subtítulos y texto en pantalla.",
        },
        {
          phase: "Fase 3 — Producción regular",
          status: "upcoming",
          detail: "8 videos mensuales según plan RS-08.",
        },
      ],

      contentPieces: [
        {
          id: "cp1", title: "Before & after — Walk-in closet", status: "delivered",
          publishDate: "2026-07-09", videoUrl: "https://drive.google.com/", note: "Subtítulos en inglés.",
        },
        { id: "cp2", title: "", status: "pending", publishDate: "2026-07-14", videoUrl: "", note: "" },
        { id: "cp3", title: "", status: "pending", publishDate: "", videoUrl: "", note: "" },
        { id: "cp4", title: "", status: "pending", publishDate: "", videoUrl: "", note: "" },
        { id: "cp5", title: "", status: "pending", publishDate: "", videoUrl: "", note: "" },
        { id: "cp6", title: "", status: "pending", publishDate: "", videoUrl: "", note: "" },
        { id: "cp7", title: "", status: "pending", publishDate: "", videoUrl: "", note: "" },
        { id: "cp8", title: "", status: "pending", publishDate: "", videoUrl: "", note: "" },
      ],

      nextSteps: [
        "Seleccionar mejor material de before & after disponible",
        "Probar clonación de voz en inglés y evaluar calidad",
        "Definir plan B de subtítulos si la narración no es viable",
      ],

      pendingMaterial: [
        "Fotos o video adicional de proyectos recientes",
        "Confirmación de qué instalaciones se pueden mostrar públicamente",
      ],

      resources: [
        { label: "Guion base en inglés", url: "#" },
        { label: "Banco de música con licencia", url: "#" },
        { label: "Referencias de edición before & after", url: "#" },
      ],

      documents: [
        { label: "Propuesta y alcance RS-08", url: "#" },
        { label: "Brief de marca — JGA Closet Upgrade", url: "#" },
      ],

      links: [
        { label: "Carpeta de material en bruto", url: "#" },
        { label: "Calendario editorial compartido", url: "#" },
      ],

      calendar: [
        { date: "2026-07-04", label: "Inicio de viaje de Juan" },
        { date: "2026-07-11", label: "Regreso de Juan" },
        { date: "2026-07-15", label: "Revisión mensual de resultados" },
      ],

      blocks: defaultBlockOrder(),
    },
  ],
};
