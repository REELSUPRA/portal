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

## Pendiente — Multi-cliente en el Panel Administrador

**Contexto:** el alcance de la V1 pide que el Panel Administrador
gestione "Clientes" (plural). La arquitectura actual es un deployment
por cliente (ver [ARQUITECTURA.md](ARQUITECTURA.md)) — no existe hoy un
selector de cliente ni un modelo de datos que contemple más de un
cliente por instancia.

**Por qué está abierta:** resolver esto en cualquier dirección es un
cambio de arquitectura de fondo:

- **Opción A — mantener un deployment por cliente.** "Gestión de
  clientes" en el admin se reduce a editar los datos del cliente actual
  (ya cubierto). Más simple, consistente con cómo está armado hoy y con
  el README original. Escala mal si ReelSupra termina con muchos
  clientes y quiere administrarlos desde un solo lugar.
- **Opción B — un deployment multi-cliente.** Requiere rediseñar el
  modelo de datos (`CLIENT_DATA` pasa a ser una lista de clientes),
  ruteo (`?client=X&project=Y`), y un nivel de navegación nuevo en el
  admin. Más alineado con "gestión de clientes" tomado literalmente,
  pero es trabajo considerable y no es necesario para entregar la V1 a
  Juan Guzmán (un solo cliente).

**Estado:** no resuelto. Señalado explícitamente para decisión del
responsable del producto antes de construir nada en esa dirección.
