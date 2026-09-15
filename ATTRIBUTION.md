# Créditos y atribuciones — Dengue Invaders 2D

## Gráficos

Todos los sprites, tiles, elementos de interfaz, logo, fondo de menú, retratos, miniaturas y
(v3) las ilustraciones de las 4 especies de mosquito, el rociador, la niebla, los íconos del
ciclo de vida, las insignias y las pestañas de la Biblioteca se generan proceduralmente en este repositorio con `tools/gen-assets.mjs` (SVG dibujado en
código, exportado a PNG con `sharp`) usando la paleta de `src/data/palette.js`. No se usan
imágenes de terceros. La guía de estilo está en `docs/ASSET_PROMPTS.md`.

Si se reemplazan por ilustraciones propias o generadas con IA, añade aquí su autoría y
licencia.

### Fotos reales de las 4 especies (Biblioteca SEDES, v3.1-v3.2)

En `public/assets/fotos/` se agregaron fotografías reales por especie de
`src/data/species.js` (campo `fotos`, un array con 2 ángulos cada una: lateral y superior/
postura característica) para que la ficha de la Biblioteca SEDES muestre al mosquito real en
vez del dibujo, y para que se puedan distinguir especies parecidas (sobre todo *Aedes aegypti*
vs *Aedes albopictus*, que se diferencian mejor de arriba por el dibujo del tórax: lira de dos
líneas en aegypti, una sola línea central en albopictus). La ilustración generada se mantiene
para los sprites de juego (enjambres, cámara IA, animaciones). Todas redimensionadas a 640 px
de ancho para el proyecto:

| Archivo | Especie mostrada | Ángulo | Fuente | Licencia | Fotógrafo/crédito |
|---|---|---|---|---|---|
| `mosq_aegypti_foto.jpg` | *Aedes aegypti* | Lateral (picando) | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Aedes_aegypti_CDC-Gathany.jpg) (CDC PHIL #9258) | Dominio público (obra del gobierno de EE. UU.) | James Gathany / CDC |
| `mosq_aegypti_foto2.jpg` | *Aedes aegypti* | Superior (dorso, lira del tórax) | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:W_MOSQUITO_AEDES_BACK-2.jpg) | CC BY-SA 4.0 | Fedaro (Fernando da Rosa) — especimen del programa de extensión de la Universidad de la República, Montevideo, Uruguay |
| `mosq_albopictus_foto.jpg` | *Aedes albopictus* | Lateral (picando) | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:CDC-Gathany-Aedes-albopictus-1.jpg) (CDC PHIL) | Dominio público (obra del gobierno de EE. UU.) | James Gathany / CDC |
| `mosq_albopictus_foto2.jpg` | *Aedes albopictus* | Superior (posado en pared, línea del tórax) | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Aedes_albopictus_on_the_wall_-_1.jpg) | CC BY-SA 4.0 | Kyu3a — Komaki, Aichi, Japón |
| `mosq_culex_foto.jpg` | *Culex quinquefasciatus* | Lateral (picando, en un dedo) | [CDC PHIL #1767](https://phil.cdc.gov/Details.aspx?pid=1767) | Dominio público (obra del gobierno de EE. UU.) | James Gathany / CDC-William Brogdon |
| `mosq_culex_foto2.jpg` | *Culex quinquefasciatus* | En una pared (color uniforme, sin rayas) | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Culex_quinquefasciatus_-_inat_83267718.jpg) | CC BY-SA 4.0 | Robert Webster, vía iNaturalist — Mayes County, Oklahoma, EE. UU. |
| `mosq_anopheles_foto.jpg` | *Anopheles albimanus* (vector de malaria de América Latina; la ficha describe el género *Anopheles*, no necesariamente *A. darlingi*) | Lateral | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Anopheles_albimanus_mosquito.jpg) (CDC PHIL #7861) | Dominio público (obra del gobierno de EE. UU.) | James Gathany / CDC |
| `mosq_anopheles_foto2.jpg` | *Anopheles albimanus* | Postura inclinada (clave para reconocerlo) | [CDC PHIL #7864](https://phil.cdc.gov/Details.aspx?pid=7864) | Dominio público (obra del gobierno de EE. UU.) | James Gathany / CDC |

Las fotos CC BY-SA 4.0 y CC BY se usan con atribución (esta tabla) según lo exige la
licencia; al modificarlas (recorte/compresión) esa condición de la licencia sigue vigente. Se
descartaron candidatas con licencia dudosa (p. ej. una foto de Culex en Flickr marcada "CC
BY 2.0" que llevaba un aviso de copyright visible de un tercero distinto del subidor) y una
foto de *Aedes aegypti* bajo GFDL 1.2 (licencia poco práctica para un solo archivo embebido).

Antes de uso público, verificar que las fotos sigan siendo apropiadas para el público
infantil objetivo (10 a 14 años) y, si se desea mostrar *Anopheles darlingi* en particular
en vez de *A. albimanus*, buscar fotos de dominio público de esa especie. No se encontraron
fotos de frente (de cara) con licencia libre para ninguna de las 4 especies; si aparecen más
adelante, se pueden sumar como tercer ángulo en `species.js` → `fotos`.

## Sonidos y música

Los 11 efectos (`step`, `detect`, `gluglu`, `pop`, `points`, `win`, `click`, `alert`, `spray`,
`motor`, `buzz`) y la pista `music.wav` se sintetizan en este repositorio con `tools/gen-sfx.mjs` (osciladores y ruido
en JavaScript puro, estilo retro inspirado en jsfxr). No se usan muestras de terceros.

## Datos educativos

Los textos de `src/data/facts.js` (datos y consejos sobre el mosquito *Aedes aegypti* por tipo
de criadero) se redactaron a partir de material de divulgación del **SEDES Santa Cruz**
(Servicio Departamental de Salud, Gobierno Autónomo Departamental de Santa Cruz, Bolivia).

**Aviso:** son cifras de referencia para un prototipo educativo. Antes de usar el juego con
público (escuelas, campañas, publicación) deben verificarse y, si corresponde, corregirse
contra las publicaciones oficiales vigentes del SEDES o del Ministerio de Salud y Deportes
de Bolivia.

### Especies y Biblioteca SEDES (v3)

El contenido de `src/data/species.js` (fichas de *Aedes aegypti*, *Aedes albopictus*, *Culex
quinquefasciatus* y *Anopheles darlingi*: cómo reconocerlos, qué transmiten, dónde crían, horario
de picadura, "señales" que muestra la cámara IA) y de `src/data/library.js` (ciclo de vida y
duración de cada etapa, síntomas y señales de alarma, prevención, mitos y verdades) fue
**redactado para este proyecto** en español, con su traducción al inglés, como divulgación
general para estudiantes de 10 a 14 años. Se basa en conocimiento de dominio público sobre
vectores del dengue tal como lo difunden el SEDES Santa Cruz y la OPS/OMS; **no reproduce texto
de ninguna publicación** ni cita cifras oficiales textuales.

Los porcentajes de confianza, las "señales detectadas" y la frecuencia con que aparece cada
especie en la **cámara con IA** son valores de una **simulación** (ver `docs/GDD.md` §12): no
son resultados de un modelo de reconocimiento ni datos epidemiológicos, y no deben presentarse
como tales.

**Antes de uso público**, este contenido debe revisarse con el SEDES Santa Cruz y/o contra las
guías vigentes de la OPS/OMS (dengue, chikungunya, zika, malaria) y del Ministerio de Salud y
Deportes de Bolivia, en especial: duración de las etapas del ciclo de vida, especies presentes
en la región, señales de alarma del dengue y recomendaciones de manejo (no automedicarse,
acudir al centro de salud). Al hacerlo, añade aquí la fuente y la fecha de revisión.

Las traducciones al inglés (`src/i18n/en.js`, `src/i18n/dict/*.js` y los campos `en` de los
datos) también se redactaron para el proyecto y deben revisarse con la misma pauta.

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
