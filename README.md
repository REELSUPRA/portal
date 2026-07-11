# Portal del Cliente — ReelSupra

Sitio estático, sin backend ni base de datos, listo para subir a Netlify (arrastrar la carpeta o conectar el repo).

## Estructura

```
index.html         Bienvenida + selector de proyectos
project.html        Detalle de un proyecto (?id=slug-del-proyecto)
css/styles.css       Todo el sistema de diseño
js/data.js           ÚNICO archivo a editar por cliente
js/render.js         Motor de renderizado (no tocar)
js/admin.js          Panel de modo administrador (no tocar)
_redirects           Redirect de Netlify para la ruta /admin
```

## Modo administrador

Se abre de tres formas:
- Visitando `tudominio.com/admin`
- Agregando `?admin=true` a cualquier URL del portal
- Presionando `Ctrl/Cmd + Shift + A`

Con el modo activo, en la página de un proyecto podés:

- **Reordenar los módulos arrastrándolos** — tomá el ícono ⠿ que aparece a la
  izquierda del título de cada módulo y soltalo donde quieras. El orden se
  guarda por proyecto: acomodar el portal de Juan no afecta a otros clientes.
- **Ocultar un módulo puntual** con el ícono de ojo, sin borrar los datos.
- **Editar cada pieza de contenido** (los casilleros numerados del módulo
  "Piezas de contenido"): clic en el número y se abre un formulario para
  cargar título, estado, fecha sugerida de publicación, link al video y una
  nota. La fecha se refleja sola en el Calendario del proyecto — no hace
  falta cargarla dos veces.
- **Cambiar el logo del proyecto**: clic en el ícono pequeño sobre el
  emoji/logo del encabezado. Podés subir una imagen (queda guardada como
  parte de los datos) o pegar una URL. "Quitar logo" vuelve al emoji.
- **Editar textos generales** (nombre del cliente, mensaje de bienvenida,
  aviso superior, nombre/estado/objetivo de cada proyecto) desde el panel
  lateral, con el botón Admin de la barra superior.

Nada de esto se guarda en un servidor: vive en la sesión del navegador. Para
que los cambios queden permanentes, usá **Exportar JSON** (en el panel
lateral) y reemplazá el contenido del objeto `CLIENT_DATA` dentro de
`js/data.js`, luego volvé a subir la carpeta a Netlify.

## Cómo reutilizar esto con un cliente nuevo

1. Duplicá la carpeta completa.
2. Abrí `js/data.js` y reemplazá `client` y `projects` con los datos del
   nuevo cliente. No hace falta tocar ningún otro archivo.
3. Cada proyecto nuevo necesita su propio arreglo `blocks` — copiá el de un
   proyecto existente (define el orden y la visibilidad de sus módulos).
4. (Opcional) Cambiá el acento de color en `css/styles.css`, variable
   `--rs-red`, si ese cliente necesita otro color de marca.
5. Subí la carpeta a Netlify.

## Agregar un proyecto nuevo

En `js/data.js`, copiá un objeto completo dentro del arreglo `projects`,
cambiá el `id` (debe ser único) y completá los campos, incluyendo
`contentPieces` (una entrada por video del plan mensual) y `blocks`
(el orden de módulos, podés copiar `defaultBlockOrder()`). Aparece
automáticamente en el portal y genera su propia página de detalle en
`project.html?id=ese-id`.
