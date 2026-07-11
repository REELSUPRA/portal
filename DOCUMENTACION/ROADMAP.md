# Roadmap

Última actualización: 2026-07-11. Ver alcance congelado en
[ALCANCE.md](ALCANCE.md) — este roadmap no lo expande, lo ejecuta.

## V1 — Entrega a Juan Guzmán

### Portal del Cliente

- [x] Bienvenida
- [x] Lista de proyectos
- [x] Estado del proyecto
- [x] Objetivos
- [x] Roadmap del proyecto
- [x] Indicador visual de piezas contratadas (sin miniaturas)
- [x] Calendario
- [x] Recursos
- [x] Documentos
- [x] Links rápidos
- [x] Próximos pasos
- [x] Material pendiente
- [x] Bitácora
- [x] Mejoras disponibles (Upsells)

### Panel Administrador

- [x] Proyectos: alta manual (vía `data.js`), edición de campos básicos
- [x] Organización: orden y visibilidad de módulos por proyecto (drag&drop)
- [x] Edición rápida: piezas de contenido, logo, textos básicos, switch
      de aviso superior
- [x] Clientes — modelo "un deployment por cliente" (ver
      [DECISIONES.md](DECISIONES.md)); gestión de cliente vía panel
      lateral existente

### Antes de dar la V1 por cerrada

- [ ] Completar datos reales de Juan Guzmán (`resources`, `documents`,
      `links` en `data.js` tienen placeholders `url: "#"` — depende de
      material que solo la agencia/cliente puede proveer)
- [ ] Revisión visual final en mobile (hay media queries, falta
      verificación manual en dispositivo real)
- [ ] Definir dónde se aloja el remoto de git (sin decidir todavía)

## Después de la V1 (no se construye ahora)

Preparado en arquitectura, no implementado — ver
[ALCANCE.md](ALCANCE.md) para el porqué:

- CRM
- Facturación
- Métricas / analítica
- Automatizaciones
- IA
- Integraciones avanzadas

Cuando llegue el momento, la primera pregunta es siempre: ¿existe ya una
herramienta externa que resuelve esto? Si la respuesta es sí, se enlaza
(módulo de acceso rápido), no se construye.
