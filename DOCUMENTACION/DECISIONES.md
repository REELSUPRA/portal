# Decisiones de arquitectura

Registro simplificado de decisiones relevantes: qué se decidió, por qué,
y qué queda abierto. Se agrega una entrada por decisión importante, no
por cada cambio (eso va en [CHANGELOG.md](CHANGELOG.md)).

---

## 2026-07-11 — Consolidación de estructura del proyecto

**Contexto:** existían dos copias del proyecto (`PORTALCLIENTE` plano en
la raíz, sin `index.html` ni `_redirects`, y `PORTALCLIENTE V2` con la
estructura completa dentro de un zip). Verificado por hash que el
contenido compartido era idéntico — no había divergencia de código.

**Decisión:** usar V2 como base, mover su contenido a la raíz, eliminar
los archivos sueltos redundantes.

**Por qué:** V2 tenía la estructura completa y coincidía con lo
documentado en el README original; la raíz estaba incompleta (le
faltaba `index.html` y `_redirects`, sin los cuales el sitio no
funciona como se describe).

---

## 2026-07-11 — Inicialización de control de versiones

**Contexto:** no había ningún control de versiones; la confusión entre
"ACTUAL" y "V2" hizo evidente el riesgo de perder trabajo sin
historial.

**Decisión:** `git init` local, commit baseline con la estructura
consolidada.

**Por qué:** es la salvaguarda mínima antes de seguir modificando
código. Sin remoto todavía — no se decidió dónde alojarlo.

---

## 2026-07-11 — Bloques nuevos vía el registro existente, no un subsistema nuevo

**Contexto:** el alcance de la V1 pide dos módulos nuevos en el Portal
del Cliente: Bitácora y Mejoras disponibles (Upsells).

**Decisión:** implementarlos como dos entradas más en `BLOCK_DEFS`
(`js/render.js`) + dos campos nuevos en el modelo de datos
(`bitacora`, `upsells`), reutilizando los patrones visuales existentes
(`upcoming-list` para bitácora, `link-list`/`btn` para upsells).

**Por qué:** el sistema de bloques ya resuelve orden, visibilidad y
layout de forma genérica. Construir algo aparte para estos dos módulos
hubiera duplicado esa lógica — va en contra de la filosofía
"centralizar sin duplicar" aplicada también al propio código, no solo
al producto.

---

## 2026-07-11 — Resuelto: un cliente por deployment

**Contexto:** el alcance de la V1 pide que el Panel Administrador
gestione "Clientes" (plural). La arquitectura actual es un deployment
por cliente (ver [ARQUITECTURA.md](ARQUITECTURA.md)) — no existía un
selector de cliente ni un modelo de datos que contemplara más de un
cliente por instancia. Se presentaron dos opciones (mantener el modelo
actual vs. rediseñar a multi-cliente en un solo deployment).

**Decisión:** mantener **un cliente por deployment**. "Gestión de
clientes" en el Panel Administrador significa editar los datos del
cliente de ese sitio (nombre, mensaje de bienvenida, aviso superior) —
funcionalidad que ya existía en el panel lateral (`js/admin.js`,
sección "Cliente"). No se rediseña el modelo de datos.

**Por qué:** la V1 es para un solo cliente (Juan Guzmán); un modelo
multi-cliente es trabajo y riesgo de arquitectura innecesarios para ese
objetivo, y contradice "no funcionalidades complejas". Si ReelSupra
suma clientes, cada uno tiene su propio deployment (ya documentado en
el README original como forma de reutilización).

**Consecuencia:** se agregó al panel el único control que faltaba para
que la sección "Cliente" fuera completa: un switch para activar/
desactivar el aviso superior (antes solo se podía editar el texto, no
mostrarlo/ocultarlo sin tocar `data.js`).

**Si en el futuro se necesita multi-cliente real:** queda documentada
la opción B descartada acá — rediseñar `CLIENT_DATA` como lista de
clientes, agregar ruteo (`?client=X&project=Y`) y un listado/selector en
el admin. No se construye hasta que haya una razón concreta.

---

## 2026-07-11 — Gate de contraseña para el admin (no autenticación real)

**Contexto:** el plan de UX Premium pedía separar admin/cliente. Full
login con credenciales por rol es multi-tenant real — fuera de alcance
de esta V1 (ver arriba). Se necesitaba algo intermedio para "evitar que
un cliente entre por accidente".

**Decisión:** un gate liviano — `agency.adminPassphrase` en
`data.js`, verificado con `window.prompt()` antes de activar
`RS_ADMIN_MODE`, una vez por sesión de navegador
(`sessionStorage.rsAdminAuthed`).

**Por qué:** cero infraestructura nueva, cero dependencias. Resuelve el
problema real planteado (acceso accidental) sin simular una seguridad
que no existe — la contraseña vive en un archivo JS servido a
cualquiera, así que **no protege contra un acceso intencional**. Esto
se documenta explícitamente en el código y se comunica al cliente para
no generar una falsa sensación de seguridad.

**Pendiente si se necesita seguridad real:** login con backend/
identidad real — eso sí es un cambio de arquitectura, no se hace en la
V1.

---

## 2026-07-11 — Persistencia del orden de bloques: localStorage (confirmado)

**Contexto:** el orden/visibilidad de módulos por proyecto solo vivía
en memoria — se perdía al recargar.

**Decisión:** confirmado usar `localStorage` (por navegador, sin
backend) — no se implementa todavía (queda para la Fase 5 del plan UX
Premium), pero la decisión de *cómo* resolverlo está tomada: no se
introduce backend/base de datos para esto en la V1.
