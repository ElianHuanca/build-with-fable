# Bitácora de progreso — Dengue Invaders 2D

Estado del MVP por fase, según el [plan de desarrollo](PLAN_DESARROLLO.md).
Última actualización: 2026-09-13.

| Fase | Nombre | Estado |
|---|---|---|
| 1 | Cimientos y guía de estilo | Hecha |
| 2 | El barrio | Hecha |
| 3 | Criaderos e interacción | Hecha |
| 4 | EliminationFX y audio | Hecha |
| 5 | HUD, misiones, popup, fin de nivel, guardado | Hecha |
| 6 | Menú, selección de nivel, modo foto | Hecha |
| 7 | Pulido, despliegue y demo | Hecha (falta activar Pages y video) |

---

## Fase 1 — Cimientos y guía de estilo · Hecha

**Qué se construyó**
- Proyecto Vite + Phaser 3.90, `src/main.js` con 960×540, `Scale.FIT`, física arcade, 3 punteros activos.
- Paleta oficial en `src/data/palette.js` (6 colores del mockup + derivados).
- `tools/gen-assets.mjs`: primer generador SVG → PNG con `sharp`; hoja del personaje (4 direcciones × 4 frames) y atlas JSON.
- `src/objects/Player.js`: movimiento en 8 direcciones, animaciones `walk_*` / `idle_*`, caja de colisión en los pies.
- `src/systems/Joystick.js`: joystick virtual propio (aparece donde se toca en la mitad izquierda).

**Archivos clave:** `src/main.js`, `src/data/palette.js`, `src/objects/Player.js`, `src/systems/Joystick.js`, `tools/gen-assets.mjs`, `public/assets/anim/`.

**Decisiones**
- Joystick propio de ~50 líneas en lugar del plugin virtual de Phaser (menos dependencias).
- Assets generados por script y versionados en `public/assets` para que el juego nunca dependa de un paso de build externo.

---

## Fase 2 — El barrio · Hecha

**Qué se construyó**
- `tools/gen-level.mjs`: barrio de 40×30 tiles con calles en cuadrícula (3 horizontales × 3 verticales de 2 tiles), manzanas con casas, jardines, muros, portones, plaza, zonas nombradas, spawn y validación automática.
- Tileset de suelo de 12 tiles (`tiles/tileset.png` + `tileset.json` con nombres) y sprites de escenario (`casa_a`, `casa_b`, `arbol`, `arbusto`, `planta`, `muro_h`, `muro_v`, `porton`, `tanque_techo`).
- `src/systems/LevelLoader.js`: construye el tilemap y los objetos desde el JSON, con catálogo `OBJECT_DEFS` (tamaño, caja de colisión, sólido/no sólido, capa superior).
- Cámara con límites del mapa siguiendo al jugador con suavizado.

**Archivos clave:** `tools/gen-level.mjs`, `src/levels/equipetrol.json`, `src/systems/LevelLoader.js`, `public/assets/tiles/`, `public/assets/sprites/`.

**Decisiones**
- Sin Tiled ni OpenStreetMap: el JSON propio es más simple y determinista (semilla fija `20260913`).
- Los objetos guardan `x,y` en píxeles; el formato se documenta en `ARQUITECTURA.md`.

---

## Fase 3 — Criaderos e interacción · Hecha

**Qué se construyó**
- `src/objects/Criadero.js`: estados `agua → detectado → limpiando → limpio`, halo pulsante al detectar, texturas `<tipo>_agua|_vacio|_limpio` con fallback a círculo de color.
- `src/systems/InteractionPrompt.js`: cartel "¡Criadero detectado!" con botón "E · Eliminar agua" (tecla y toque) y etiqueta flotante en el mundo.
- Detección por proximidad (`RADIO_DETECCION = 72 px`) al criadero no limpio más cercano.
- 5 criaderos × 3 estados + capa de agua `agua_<tipo>` generados por script.
- `src/data/facts.js`: 5 datos educativos con consejo y fuente (SEDES Santa Cruz).
- Bloqueo del jugador durante la limpieza, texto flotante "+50", contador provisional y mensaje provisional "¡Barrio protegido!".

**Archivos clave:** `src/scenes/GameScene.js`, `src/objects/Criadero.js`, `src/systems/InteractionPrompt.js`, `src/data/facts.js`.

---

## Fase 4 — EliminationFX y audio · Hecha

**Qué se construyó**
- `src/systems/EliminationFX.js` (`playElimination(scene, criadero)` → Promise): drenado 1500 ms con la capa de agua escalando en Y, splash de 30 gotas al 40 %, disolución con máscara de ruido 800 ms (fallback fade+scale en CANVAS), estado limpio con rebote y 12 chispas 400 ms. Total ≈ 3,3 s. Reentrada bloqueada por criadero.
- Emite `sfx`, `foto:antes` y `foto:despues` en la escena para el audio y el modo foto.
- `tools/gen-sfx.mjs`: síntesis de 7 SFX + música en loop como WAV sin dependencias (osciladores anti-click, RNG con semilla).
- `src/systems/AudioManager.js`: singleton con `init`, `bind(scene)`, `play`, `playMusic`, `stopMusic`, `setEnabled`; persiste en `localStorage` (`dengue.sonido`) y gestiona el desbloqueo de audio en móviles.
- `Criadero.clean()` ya invoca `playElimination`.

**Archivos clave:** `src/systems/EliminationFX.js`, `src/systems/AudioManager.js`, `tools/gen-sfx.mjs`, `public/assets/audio/`.

**Integración:** `BootScene` carga las 8 keys de audio, `AudioManager.init` en Boot y `bind`/`playMusic` en `GameScene`; el listener global `game.events('sfx')` cubre los menús.

**Pendientes conocidos**
- Validar la máscara bitmap en WebGL de móviles de gama baja.
- `MenuScene.sfx()` emite en `game.events` y además llama a `AudioManager.play`, por lo que el click suena dos veces (inaudible, pero conviene dejar una sola vía).

---

## Fase 5 — HUD, misiones, popup, fin de nivel y guardado · Hecha

**Qué se construyó**
- `src/scenes/HUDScene.js`: overlay con retrato, puntos, 3 estrellas, panel de misiones con casillas, barra "Barrio protegido %", zona actual, tiempo y dato educativo. Se alimenta del `registry` (`HUD_KEYS`) y reacciona a `changedata`.
- `src/systems/MissionManager.js`: 4 misiones secuenciales (recorrer 3 zonas → encontrar 3 criaderos → ayudar a la familia → barrio 100 %). Sin dependencia de Phaser.
- `src/systems/ScoreManager.js`: +50 por criadero, +25 de combo (< 20 s), estrellas por tiempo (3 ≤ 2:30, 2 ≤ 4:00, 1 por terminar).
- `src/scenes/PopupScene.js`: tarjeta educativa con sprite, dato, consejo, fuente y botón "¡Genial!"; emite `popup:cerrado`.
- `src/scenes/LevelEndScene.js`: banner, estrellas animadas una a una, resumen, mensaje del personaje, botones Continuar y Foto; emite `nivel:continuar` / `nivel:foto`.
- `src/systems/SaveSystem.js`: estrellas, mejor tiempo y mejores puntos por nivel en `localStorage` (`dengue.progreso`), con copia en memoria si el almacenamiento no está disponible.

**Archivos clave:** `src/scenes/HUDScene.js`, `src/scenes/PopupScene.js`, `src/scenes/LevelEndScene.js`, `src/systems/MissionManager.js`, `src/systems/ScoreManager.js`, `src/systems/SaveSystem.js`.

**Integración:** `GameScene` lanza `HUD`, escribe el registry, pausa durante `Popup`, duerme el HUD y lanza `LevelEnd` al terminar y guarda con `SaveSystem`. Las 8 escenas están registradas en `src/main.js` y `BootScene` carga toda la UI. Flujo completo verificado con Playwright sin errores de consola.

---

## Fase 6 — Menú, selección de nivel y modo foto · Hecha

**Qué se construyó**
- `src/scenes/MenuScene.js`: fondo, logo, JUGAR, Créditos (modal con atribuciones) y Configuración (sonido on/off). Exporta helpers `makeButton`, `openModal`, `sfx`, `leerSonido`, `escribirSonido`.
- `src/scenes/LevelSelectScene.js`: tarjetas Equipetrol (estrellas y mejor tiempo guardados) y Plan 3000 (candado), botón Volver y `Esc`. Inicia `Game` con `{ levelId }`.
- `src/data/levels.js`: catálogo `LEVELS` (`id`, `nombre`, `thumb`, `bloqueado`, `data`).
- `src/scenes/PhotoScene.js`: antes/después del último criadero (texturas `foto_antes` / `foto_despues`), composición de imagen, descarga, compartir con Web Share API y fallback de copia; emite `foto:cerrar`.
- Assets de menú: `img/logo.png`, `img/menu_bg.png`, `img/level_equipetrol.png`, `img/level_plan3000.png`, íconos `ui/icon_*`.

**Archivos clave:** `src/scenes/MenuScene.js`, `src/scenes/LevelSelectScene.js`, `src/scenes/PhotoScene.js`, `src/data/levels.js`, `public/assets/img/`.

**Decisiones**
- Los sonidos de UI del menú se emiten en `game.events` (global) además de `scene.events`, porque `AudioManager.bind` escucha solo la escena enlazada.
- La captura antes/después se toma desde `EliminationFX` con `foto:antes` / `foto:despues` para no acoplar `PhotoScene` al criadero.

**Integración:** `BootScene` inicia `Menu`; `GameScene` lee `levelId` de `levels.js`; `foto_antes`/`foto_despues` se capturan con `snapshotArea` ocultando HUD y cartel.

**Pendientes conocidos**
- Descarga de imagen en iOS Safari: se muestra en grande y se pide captura nativa (`PhotoScene.showBig`); probar en dispositivo real.
- Si el criadero está en el borde del mapa, la captura queda descentrada (se recorta al canvas).

---

## Fase 7 — Pulido, despliegue y demo · Hecha (parcial)

**Qué se construyó (este trabajo)**
- `README.md`, `docs/PROGRESO.md`, `docs/ARQUITECTURA.md`, `ATTRIBUTION.md`.
- `.github/workflows/deploy.yml`: build y publicación en GitHub Pages en cada push a `main`.
- `vite.config.js` con `base: './'` para funcionar en subruta.
- Pantalla de carga con barra en `BootScene` (ya existente).

**Pendientes conocidos**
- Activar Pages en el repositorio (Settings → Pages → Source: GitHub Actions) y verificar la URL pública.
- Pruebas en Chrome escritorio, Android Chrome e iOS Safari.
- Video de 60 s (las capturas ya están en `docs/capturas/`).
- Ajustar `license` en `package.json` (hoy dice ISC) según lo que se decida para el código.

---

## Sistemas → archivo → responsabilidad

| Sistema | Archivo | Responsable de |
|---|---|---|
| Arranque y carga | `src/scenes/BootScene.js` | Barra de carga, carga de atlas, tiles, sprites, UI, audio y JSON del nivel; animaciones del personaje |
| Configuración del juego | `src/main.js` | Tamaño 960×540, escalado, física, lista de escenas |
| Menú | `src/scenes/MenuScene.js` | Logo, JUGAR, créditos, sonido on/off; helpers de botón/modal/sfx |
| Selección de nivel | `src/scenes/LevelSelectScene.js` | Tarjetas por nivel, estrellas guardadas, bloqueo |
| Catálogo de niveles | `src/data/levels.js` | `LEVELS` y `getLevel(id)` |
| Juego | `src/scenes/GameScene.js` | Orquesta jugador, criaderos, detección, limpieza, misiones, puntaje, registry del HUD y fin de nivel |
| Carga del nivel | `src/systems/LevelLoader.js` | Tilemap + objetos desde JSON, colisiones, `zoneAt` |
| Generación del nivel | `tools/gen-level.mjs` | `src/levels/equipetrol.json` + validación |
| Jugador | `src/objects/Player.js` | Movimiento 8 direcciones, animaciones, bloqueo |
| Joystick | `src/systems/Joystick.js` | Entrada táctil, vector -1..1 |
| Criadero | `src/objects/Criadero.js` | Estados, halo de detección, `clean()` |
| Cartel de detección | `src/systems/InteractionPrompt.js` | "¡Criadero detectado!", botón E, etiqueta en el mundo |
| Animación de eliminación | `src/systems/EliminationFX.js` | Secuencia de 4 pasos, eventos `sfx` y `foto:*` |
| Audio | `src/systems/AudioManager.js` + `tools/gen-sfx.mjs` | Reproducción, música, mute persistente; síntesis de WAV |
| HUD | `src/scenes/HUDScene.js` | Puntos, estrellas, misiones, barra de barrio, dato educativo |
| Misiones | `src/systems/MissionManager.js` | Progreso secuencial de 4 misiones |
| Puntaje | `src/systems/ScoreManager.js` | Puntos, combo, estrellas por tiempo |
| Popup educativo | `src/scenes/PopupScene.js` | Tarjeta con dato SEDES, pausa del juego |
| Fin de nivel | `src/scenes/LevelEndScene.js` | Resumen, estrellas animadas, Continuar / Foto |
| Modo foto | `src/scenes/PhotoScene.js` | Antes/después, descarga y compartir |
| Guardado | `src/systems/SaveSystem.js` | Progreso por nivel en `localStorage` |
| Datos educativos | `src/data/facts.js` | 5 datos + consejos con fuente |
| Paleta | `src/data/palette.js` | Colores oficiales, `hex()` |
| Gráficos | `tools/gen-assets.mjs` | Todos los PNG de `public/assets/` |
| Despliegue | `.github/workflows/deploy.yml` | Build y publicación en GitHub Pages |
