/**
 * ============================================================
 * REELSUPRA — CAPA DE PERSISTENCIA (RSStore)
 * ============================================================
 * Único punto del proyecto que sabe DÓNDE se guardan los cambios
 * del modo admin. Nadie más llama a localStorage directamente —
 * admin.js solo conoce load() / save() / hydrate().
 *
 * Hoy (V1): localStorage, por navegador, sin backend.
 * El día que haga falta otro destino (GitHub, Supabase, un backend
 * propio), se reemplaza el contenido de ESTE archivo nada más. La
 * interfaz ya es async (devuelve Promises) aunque localStorage sea
 * síncrono, justamente para que ese cambio no toque admin.js.
 *
 * Limitación conocida de esta V1: save() guarda una foto completa
 * de CLIENT_DATA, y hydrate() la reemplaza entera al cargar. Si
 * js/data.js cambia después de que alguien guardó localmente en su
 * navegador, esa foto vieja gana — no hay merge inteligente. Ver
 * DOCUMENTACION/DECISIONES.md.
 * ============================================================
 */

window.RSStore = (() => {
  const KEY = "rsClientDataOverride";

  function load() {
    return Promise.resolve().then(() => {
      try {
        const raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        console.warn("RSStore: no se pudo leer el guardado local.", e);
        return null;
      }
    });
  }

  function save(data) {
    return Promise.resolve().then(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(data));
        return true;
      } catch (e) {
        console.warn("RSStore: no se pudo guardar.", e);
        return false;
      }
    });
  }

  function clear() {
    return Promise.resolve().then(() => {
      localStorage.removeItem(KEY);
    });
  }

  // Aplica el guardado local (si existe) sobre CLIENT_DATA. Se llama
  // una sola vez, al principio de boot(), antes de cualquier render.
  function hydrate() {
    return load().then((saved) => {
      if (saved) window.CLIENT_DATA = saved;
    });
  }

  return { load, save, clear, hydrate };
})();
