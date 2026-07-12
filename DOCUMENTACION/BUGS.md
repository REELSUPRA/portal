# Bugs

Bugs conocidos. Formato: estado, descripción, dónde, desde cuándo.

## Abiertos

_Ninguno conocido al 2026-07-11._

## Resueltos

- **2026-07-12 — Logos/portada "no aparecen o se rompen" en mobile.**
  Causa real: `openImageModal` guardaba el archivo subido tal cual en
  base64 (`FileReader.readAsDataURL`), sin redimensionar. Una foto de
  celular sin comprimir pesa varios MB en base64 — supera la cuota de
  `localStorage` (más chica en mobile), `RSStore.save()` fallaba en
  silencio, y la imagen no persistía tras recargar. Fix: `js/admin.js`
  redimensiona al lado más largo (1280px, PNG si el original es PNG
  por transparencia, JPEG el resto) antes de guardar. Verificado: una
  imagen sintética de 3.9MB quedó en ~192KB tras el fix, sin pérdida
  visual.
- **2026-07-12 — Un guardado fallido se marcaba como exitoso.**
  `saveChanges()` limpiaba el estado "sin guardar" (y cerraba la barra)
  incluso cuando `RSStore.save()` devolvía `false` — el cambio se
  perdía sin aviso real y `beforeunload` dejaba de proteger. Fix: solo
  se limpia el estado si el guardado fue exitoso. Verificado
  forzando una excepción en `localStorage.setItem`: la barra permanece
  abierta.
- **2026-07-12 — Badge "Modo administrador" se deformaba en un óvalo en
  mobile.** `.admin-mode-badge` (pill con `border-radius: 999px`) se
  comprimía dentro de un contenedor flex sin wrap, forzando el texto a
  envolverse en varias líneas angostas — con esa forma, el radio
  redondo se veía como un óvalo/círculo superpuesto al topbar. Fix:
  `.topbar__inner` permite wrap en mobile (el badge pasa a su propia
  fila) y el badge usa un radio normal + `white-space: normal` en vez
  de forzar la forma de pill. De paso, el texto del badge en
  `index.html` (donde no hay bloques para arrastrar) deja de mostrar la
  instrucción de drag&drop de `project.html`.

## Notas de verificación

- 2026-07-11: verificación end-to-end (Chromium headless) de
  `index.html`, `project.html` (ambos proyectos) y modo admin en ambas
  páginas. Sin errores de JS ni de consola.
- 2026-07-12: regresión responsive (Chromium headless, Playwright) en
  Desktop (1440×900), iPhone SE, iPhone 13, Pixel 7 e iPad — `index`,
  `project` (público y admin), panel admin, editor genérico de listas.
  Sin errores de consola, sin requests fallidos, sin overflow
  horizontal en ningún viewport. Capturas guardadas fuera del repo
  (carpeta de trabajo de la sesión).
