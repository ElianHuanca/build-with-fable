# Dengue Invaders 2D

Prototipo web educativo en 2D (vista superior) para estudiantes de Santa Cruz, Bolivia.
El jugador es un **agente del SEDES** en un barrio ficticio inspirado en Equipetrol, con una
**jornada de 4 minutos**: debe detectar y eliminar los criaderos del mosquito *Aedes aegypti*
(llanta, tanque, balde, botella, florero) y, además, fumigar los **brotes de mosquitos** que van
apareciendo con el tiempo antes de que crezcan. Una **estación SEDES** con camioneta de
fumigación (subirse duplica la velocidad y fumiga más rápido) y un **medidor de riesgo de
epidemia** en el HUD suben la presión: si el medidor llega al 100 % la jornada termina con una
pantalla de "epidemia declarada" y un mensaje de concientización, en vez de un "game over" duro.
Cada criadero limpio y cada brote fumigado muestran un dato educativo y suman puntos; al terminar
la jornada, el resumen agrega 3 datos aprendidos y una pregunta de opción múltiple, y si se
limpió todo se puede compartir una foto antes/después.

**Novedades de la v3** (en cierre, ver [docs/PROGRESO.md](docs/PROGRESO.md)):

- **Biblioteca SEDES**: en la estación (o desde el menú) se abren tarjetas de aprendizaje con 5
  pestañas — 4 especies de mosquito, ciclo de vida, síntomas, prevención y mitos que se voltean —,
  4 insignias que se guardan en el dispositivo y un bonus de +50 puntos en la siguiente jornada
  por leer 5 tarjetas nuevas.
- **Cámara con IA (demo simulada)**: tecla `C` o botón CÁMARA; fotografía un enjambre, "analiza"
  la imagen y muestra la especie, su confianza y las señales que la distinguen, y la guarda en un
  álbum. **No hay ningún modelo de reconocimiento real**: la especie y la confianza se sortean
  (la pantalla lo marca como DEMO). Sirve para enseñar qué mirar en un mosquito, no para
  identificarlo de verdad.
- **Enjambres y fumigación**: los brotes son enjambres de 8/14/22 mosquitos que orbitan y vibran;
  al fumigar el agente saca el rociador, un cono de niebla avanza y los mosquitos caen uno a uno.
  Con `E`/ACCIÓN hay que mantener presionado (soltar cancela).
- **El HUD no tapa la acción**: la cámara deja margen para el HUD y los controles, los paneles se
  atenúan cuando cubren al jugador o a un brote, y el cartel de detección se pone del lado opuesto.
- **Español e inglés**, con selector en el menú y en Configuración (se guarda en el dispositivo).

Corre 100 % en el navegador (escritorio y móvil), sin backend ni base de datos:
el progreso, las insignias, el álbum y el idioma se guardan en `localStorage`. Construido con
[Phaser 3.90](https://phaser.io) y [Vite](https://vite.dev).

## Captura

![Vista principal del juego](docs/capturas/juego.png)

| Menú | Selección | Detección | Popup | Fin de nivel | Modo foto |
|---|---|---|---|---|---|
| ![](docs/capturas/menu.png) | ![](docs/capturas/seleccion.png) | ![](docs/capturas/deteccion.png) | ![](docs/capturas/popup.png) | ![](docs/capturas/fin_nivel.png) | ![](docs/capturas/modo_foto.png) |

## Video demo

Recorrido completo de ~60 s: menú, selección de nivel, caminata por el barrio, animación de
eliminación de un criadero, popup educativo, fin de nivel con estrellas y modo foto.

- [docs/demo/dengue-invaders-demo.webm](docs/demo/dengue-invaders-demo.webm) (VP8, 960×540)
- [docs/demo/poster.png](docs/demo/poster.png) (fotograma del segundo 10)

[![Video demo](docs/demo/poster.png)](docs/demo/dengue-invaders-demo.webm)

Se regenera con `npm run build && npm run demo:video` (`tools/record-demo.mjs`, requiere
Playwright con Chromium; si hay `ffmpeg` con libx264 en el PATH también produce un `.mp4`).

## Cómo correrlo

Requiere Node.js 20 o superior.

```bash
npm install          # instala phaser, vite y sharp
npm run gen:assets   # genera sprites, tileset, UI, logo y miniaturas en public/assets/
npm run gen:level    # genera el barrio en src/levels/equipetrol.json (valida el mapa)
npm run gen:sfx      # sintetiza los .wav de efectos y música en public/assets/audio/
npm run dev          # servidor de desarrollo (http://localhost:5173, accesible en la red local)
npm run build        # build de producción en dist/
npm run preview      # sirve dist/ para probar el build
```

Los assets generados están versionados en el repositorio, así que `npm install` y
`npm run dev` bastan para jugar. Los tres scripts `gen:*` solo hacen falta si se
cambia la paleta, el mapa o los sonidos.

## Controles

| Acción | Escritorio | Móvil |
|---|---|---|
| Moverse (8 direcciones) | `WASD` o flechas | Joystick táctil: toca y arrastra en la mitad izquierda de la pantalla |
| Eliminar agua del criadero (un toque) / fumigar el brote detectado (**mantener presionado**; soltar cancela) / abrir la Biblioteca en la estación | `E` | Botón ACCIÓN |
| Cámara con IA (demo): fotografiar el brote cercano o lo que hay alrededor del agente | `C` | Botón CÁMARA (sobre la lupa) |
| Correr (sprint, se agota y recarga) | `Shift` | Botón CORRER |
| Subir/bajar de la camioneta de fumigación | `V` | Botón VEHÍCULO |
| Pausa | `Esc` | Botón PAUSA |
| Biblioteca: cambiar de tarjeta / voltear un mito / cerrar | `←` `→` / `Espacio` o `Enter` / `Esc` | Deslizar / tocar la tarjeta / botón Volver |
| Cámara: disparar / cerrar | `Espacio` o `Enter` / `Esc` | Botones en pantalla |
| Volver / cerrar | `Esc` (selección de nivel), `Enter` (menú → jugar) | Botones en pantalla |

## Idiomas

Español e inglés. Al abrir por primera vez se usa el idioma del navegador (`en*` → inglés, el resto
→ español); después se puede cambiar con el botón ES/EN del menú principal o en Configuración, y la
elección queda guardada (`localStorage 'dengue.lang'`). Los textos de interfaz viven en
`src/i18n/` (diccionarios `es.js`/`en.js` más parciales en `src/i18n/dict/`) y los datos educativos
llevan ambos idiomas dentro de cada objeto (`{ es, en }`). Si falta una traducción se muestra el
español.

## Estructura de carpetas

```
build-with-fable/
├── index.html                 # contenedor #game, viewport móvil
├── package.json               # scripts dev/build/preview/gen:*
├── vite.config.js             # base: './' (funciona en subrutas como GitHub Pages)
├── .github/workflows/deploy.yml  # despliegue automático a GitHub Pages
├── docs/
│   ├── PLAN_DESARROLLO.md     # plan del MVP (v1) por etapas
│   ├── PLAN_V2_JUGABILIDAD.md # plan del v2 "Agente SEDES" (jornada, brotes, móvil vertical)
│   ├── PLAN_V3_BIBLIOTECA_IA.md # plan del v3 (biblioteca, cámara IA, visibilidad, inglés) con su estado
│   ├── GDD.md                 # reglas de juego: jornada v2 (§1–10) y biblioteca, cámara, enjambres, visibilidad, idiomas (§11–15)
│   ├── PROGRESO.md            # bitácora de avance por fase y por ola (v2, v3)
│   ├── ARQUITECTURA.md        # escenas, eventos, contratos, formato de nivel y keys (v3 en §2.7)
│   ├── ASSET_PROMPTS.md       # guía de estilo y prompts para ilustraciones
│   ├── capturas/              # capturas para este README
│   └── referencias/           # plan original
├── tools/
│   ├── gen-assets.mjs         # SVG → PNG de personaje, criaderos, camioneta, estación, brotes, UI y v3 (especies, rociador, ciclo, insignias)
│   ├── gen-level.mjs          # genera y valida src/levels/equipetrol.json (incluye la estación, v2)
│   └── gen-sfx.mjs            # sintetiza los WAV (sin dependencias)
├── public/assets/
│   ├── anim/                  # player.png + player.json (atlas 4 direcciones × 4 frames)
│   ├── sprites/               # criaderos, escenario, partículas, camioneta, brotes (v2), especies mosq_*, rociador, niebla (v3)
│   ├── tiles/                 # tileset.png + tileset.json (nombres de tile)
│   ├── ui/                    # panel, botones, estrellas, barra, íconos, retratos; v3: ciclo_*, insignia_*, tab_*, icon_camera_big/library/lang
│   ├── img/                   # logo, fondo del menú, miniaturas de nivel
│   └── audio/                 # step, detect, gluglu, pop, points, win, click, alert, spray, motor, buzz, music (.wav)
└── src/
    ├── main.js                # configuración de Phaser (Scale.RESIZE, mobile first, arcade)
    ├── scenes/                # Boot, Menu, LevelSelect, Game, HUD, Popup, LevelEnd, Photo, y v3: Library, Camera
    ├── objects/               # Player.js, Criadero.js, Brote.js (v3: Container de enjambre), Estacion.js, Vehiculo.js
    ├── systems/               # EliminationFX, AudioManager, MissionManager, ScoreManager,
    │                          # SaveSystem, LevelLoader, InteractionPrompt, Layout, TouchControls,
    │                          # Joystick, v2: OutbreakManager, EpidemicMeter, FumigationFX,
    │                          # Minimap, Compass, AlertToast, y v3: Badges, CameraFX, CameraZoom
    ├── data/                  # palette.js, facts.js, levels.js, tips.js, quiz.js, y v3: species.js, library.js
    ├── i18n/                  # index.js (t/tx/txList, setLang), es.js, en.js, dict/*.js (parciales fusionados)
    └── levels/                # equipetrol.json (generado, incluye la estación)
```

Detalles de escenas, eventos y formatos en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).
Estado del proyecto en [docs/PROGRESO.md](docs/PROGRESO.md).

## Regenerar assets y nivel

- **Gráficos** (`npm run gen:assets`): `tools/gen-assets.mjs` dibuja cada pieza como SVG
  usando `src/data/palette.js` y la exporta a PNG con `sharp`. Si cambias un color de la
  paleta, vuelve a correrlo y todos los sprites quedan coherentes.
- **Nivel** (`npm run gen:level`): `tools/gen-level.mjs` construye el barrio de 40×30 tiles
  con una semilla fija (mapa determinista), coloca casas, muros, árboles, zonas, spawn y
  5 criaderos, y valida el resultado (criaderos en patios, sin solapes, distancia mínima).
  Si la validación falla el script termina con error y explica el motivo.
- **Sonido** (`npm run gen:sfx`): `tools/gen-sfx.mjs` sintetiza 7 efectos y una pista de
  música en loop como WAV 22 050 Hz mono, 16 bits. Es reproducible (RNG con semilla).

## Reemplazar los assets generados por ilustraciones propias

El código nunca depende del contenido de un PNG, solo de su **nombre y tamaño**. Para
usar ilustraciones propias (dibujadas a mano o generadas con IA):

1. Lee la guía de estilo y la lista de prompts en [docs/ASSET_PROMPTS.md](docs/ASSET_PROMPTS.md).
2. Exporta la imagen con **el mismo nombre de archivo y las mismas dimensiones** que el
   generado (por ejemplo `public/assets/sprites/llanta_agua.png`, 64×64; `img/logo.png`;
   `ui/retrato.png`, 128×128; `img/level_equipetrol.png`, 256×160).
3. Cópiala encima del archivo en `public/assets/...`. No hace falta tocar código.
4. Evita volver a correr `npm run gen:assets` sin respaldo: sobrescribe todo lo que genera.

Casos especiales: la hoja del personaje (`anim/player.png`) debe respetar el atlas
`anim/player.json` (frames `down_0..3`, `up_0..3`, `left_0..3`, `right_0..3` de 64×64), y el
tileset (`tiles/tileset.png`) el orden de nombres de `tiles/tileset.json`.

## Despliegue en GitHub Pages

El workflow [.github/workflows/deploy.yml](.github/workflows/deploy.yml) compila y publica
`dist/` en cada push a `main` (o manualmente desde la pestaña *Actions*). Para activarlo
una sola vez en el repositorio:

1. Ve a **Settings → Pages**.
2. En **Build and deployment → Source** elige **GitHub Actions**.
3. Haz push a `main` (o ejecuta *Deploy to GitHub Pages* con *Run workflow*).

Como `vite.config.js` usa `base: './'`, el build funciona en cualquier subruta
(`https://<usuario>.github.io/build-with-fable/`).

## Licencia de datos y créditos

- Los datos educativos de `src/data/facts.js` se redactaron a partir de material de
  divulgación del **SEDES Santa Cruz** (Servicio Departamental de Salud). Son cifras de
  referencia para un prototipo: **verifícalas con la fuente oficial antes de usar el juego
  con público**.
- El contenido de especies y de la Biblioteca (`src/data/species.js`, `src/data/library.js`) y
  sus traducciones se redactaron para este proyecto como divulgación general; deben revisarse
  con el SEDES / OPS antes de uso público. Los resultados de la cámara con IA son una
  simulación, no datos reales.
- El barrio es ficticio, inspirado en Equipetrol; no representa calles ni viviendas reales.
- Gráficos y sonidos: generados proceduralmente en este repositorio (`tools/`).
- Motor y herramientas: Phaser 3 (MIT), Vite (MIT), sharp (Apache-2.0).

Créditos completos en [ATTRIBUTION.md](ATTRIBUTION.md).
