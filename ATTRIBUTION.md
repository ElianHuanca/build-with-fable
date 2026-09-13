# Créditos y atribuciones — Dengue Invaders 2D

## Gráficos

Todos los sprites, tiles, elementos de interfaz, logo, fondo de menú, retratos y miniaturas
se generan proceduralmente en este repositorio con `tools/gen-assets.mjs` (SVG dibujado en
código, exportado a PNG con `sharp`) usando la paleta de `src/data/palette.js`. No se usan
imágenes de terceros. La guía de estilo está en `docs/ASSET_PROMPTS.md`.

Si se reemplazan por ilustraciones propias o generadas con IA, añade aquí su autoría y
licencia.

## Sonidos y música

Los 7 efectos (`step`, `detect`, `gluglu`, `pop`, `points`, `win`, `click`) y la pista
`music.wav` se sintetizan en este repositorio con `tools/gen-sfx.mjs` (osciladores y ruido
en JavaScript puro, estilo retro inspirado en jsfxr). No se usan muestras de terceros.

## Datos educativos

Los textos de `src/data/facts.js` (datos y consejos sobre el mosquito *Aedes aegypti* por tipo
de criadero) se redactaron a partir de material de divulgación del **SEDES Santa Cruz**
(Servicio Departamental de Salud, Gobierno Autónomo Departamental de Santa Cruz, Bolivia).

**Aviso:** son cifras de referencia para un prototipo educativo. Antes de usar el juego con
público (escuelas, campañas, publicación) deben verificarse y, si corresponde, corregirse
contra las publicaciones oficiales vigentes del SEDES o del Ministerio de Salud y Deportes
de Bolivia.

## Barrio

El nivel "Equipetrol" es un barrio **ficticio** inspirado en la zona de Equipetrol de la
ciudad de Santa Cruz de la Sierra. No reproduce calles, manzanas ni viviendas reales y no
utiliza datos cartográficos de terceros (OpenStreetMap queda como fase futura, con
atribución ODbL cuando se incorpore).

## Software de terceros

| Componente | Uso | Licencia |
|---|---|---|
| [Phaser 3](https://phaser.io) (3.90) | Motor de juego | MIT |
| [Vite](https://vite.dev) | Empaquetado y servidor de desarrollo | MIT |
| [sharp](https://sharp.pixelplumbing.com) | Conversión SVG → PNG en `tools/gen-assets.mjs` (solo desarrollo) | Apache-2.0 |

## Despliegue

`.github/workflows/deploy.yml` usa las acciones oficiales `actions/checkout`,
`actions/setup-node`, `actions/configure-pages`, `actions/upload-pages-artifact` y
`actions/deploy-pages` (MIT).
