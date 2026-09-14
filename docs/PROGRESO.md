# Bitácora de progreso — Dengue Invaders 2D

Estado del MVP por fase, según el [plan de desarrollo](PLAN_DESARROLLO.md).
El plan de la v2 ("Agente SEDES") está en [PLAN_V2_JUGABILIDAD.md](PLAN_V2_JUGABILIDAD.md) y el de
la v3 ("Biblioteca, cámara IA, visibilidad, inglés") en [PLAN_V3_BIBLIOTECA_IA.md](PLAN_V3_BIBLIOTECA_IA.md).
Última actualización: 2026-09-14.

| Fase | Nombre | Estado |
|---|---|---|
| 1 | Cimientos y guía de estilo | Hecha |
| 2 | El barrio | Hecha |
| 3 | Criaderos e interacción | Hecha |
| 4 | EliminationFX y audio | Hecha |
| 5 | HUD, misiones, popup, fin de nivel, guardado | Hecha |
| 6 | Menú, selección de nivel, modo foto | Hecha |
| 7 | Pulido, despliegue y demo | Hecha (falta activar Pages y video) |
| v2 · Ola 1 / Agente A | Layout responsivo + menús | Hecha |
| v2 · Ola 1 / Agentes B-H | HUD, brotes, minimapa, estación/camioneta, assets v2, contenido, controles v2 | Hecha |
| v2 · Ola 2 | Integración en GameScene + documentación | Hecha |
| v2 · Ola 3 | QA vertical/horizontal, video demo v2 | No iniciada |
| v3 · Ola 1 / Agentes A–E | Biblioteca SEDES, cámara IA (demo), enjambres y fumigación, visibilidad, assets v3 | Hecha (commit `9ab1d93`) |
| v3 · Ola 2 — inglés y documentación | Hecha |
| v3 · Cierre — QA ES/EN en vertical, horizontal y escritorio | Hecha (video v3 pendiente) |

---

## v3 — Biblioteca, cámara IA, visibilidad, inglés

Plan: [PLAN_V3_BIBLIOTECA_IA.md](PLAN_V3_BIBLIOTECA_IA.md). Reglas de juego nuevas en
[GDD.md](GDD.md) §11–15; contratos técnicos en [ARQUITECTURA.md](ARQUITECTURA.md) §2.7.
Regla del usuario: **no se hace push hasta terminar todo**; se registra aquí cada ola.

### Ola 1 — funcionalidades · Hecha

Cinco agentes en paralelo sobre archivos disjuntos, integrados en el commit `9ab1d93`
("v3 wave 1"). Verificado con `node --check` y arranque en el navegador (Menu → Biblioteca,
LevelSelect → Game → C/cámara → Library desde la estación) sin errores de consola.

| # | Agente | Archivos | Qué quedó |
|---|---|---|---|
| A | Biblioteca | `src/scenes/LibraryScene.js`, `src/data/library.js`, `src/systems/Badges.js`, botón en `src/scenes/MenuScene.js`, fila de insignias en `src/scenes/LevelSelectScene.js` | Escena `Library` con 5 pestañas (Mosquitos, Ciclo de vida, Síntomas, Prevención, Mitos), carrusel (flechas, teclado, deslizar), 6 mitos que se voltean con un toque, 4 insignias persistidas (`dengue.insignias`) y bonus de estudio +50 (`Badges.bonusPendiente()` / `consumirBonus()`, consumido por `GameScene.create()`) |
| B | Cámara IA | `src/scenes/CameraScene.js`, `src/systems/CameraFX.js`, `src/data/species.js` | Escena `Camera`: visor con marco y retícula → flash → análisis ~2,2 s (escáner, puntos de referencia, barra de confianza, consola) → tarjeta de resultado (especie, confianza 87–98 %, señales, recomendación) con etiqueta **DEMO**; álbum en `dengue.album`; emite `camera:especie` / `camera:cerrar` |
| C | Mosquitos y fumigación | `src/objects/Brote.js`, `src/systems/FumigationFX.js` | `Brote` pasa a ser un `Container` con 8/14/22 mosquitos individuales (`mosq_<especie>_mini`) que orbitan y vibran, tope global de 70 sprites; fumigación con rociador en la mano (o en el tanque de la camioneta), cono de niebla, mosquitos que caen uno a uno desde el 40 % del progreso, gotas y pulso verde; `cancelFumigation` / `fumigationProgress` |
| D | Visibilidad y enganches | `src/scenes/GameScene.js`, `src/scenes/HUDScene.js`, `src/systems/TouchControls.js`, `src/systems/InteractionPrompt.js`, `src/systems/CameraZoom.js`, `src/systems/Compass.js` | `aplicarMargenCamara()` (límites de cámara ampliados 150/250 px en vertical táctil), `actualizarEvitar()` cada 100 ms → `HUD.evitar(rects)` (paneles al 25 % de alpha) y minimapa al 35 %; cartel de detección y banner de tips en el lado opuesto al objetivo (`prompt.setLado`, `hud.setLadoDato`); panel de misiones plegable en vertical; botón CÁMARA táctil y tecla `C` (`abrirCamara()`); `E`/ACCIÓN en la estación abre la Biblioteca (`abrirBiblioteca()`); `pausaSuave()` / `reanudar()` para los overlays |
| E | Assets v3 | `tools/gen-assets.mjs` (`buildV3`), `public/assets/sprites/`, `public/assets/ui/` | 4 especies grandes y mini (`mosq_<id>`, `mosq_<id>_mini`), `rociador`, `niebla`, `ciclo_huevo|larva|pupa|adulto`, `insignia_explorador|detective|guardian|fotografo|bloqueada`, `icon_camera_big`, `icon_library`, `icon_lang`, `tab_*` |

En la misma ola se sentó el núcleo de i18n (`src/i18n/index.js`, `es.js`, `en.js`) y el catálogo
`src/data/species.js` con textos `{ es, en }`, que la Ola 2 completa.

### Ola 2 — inglés, QA y documentación · En curso

| # | Agente | Entregable | Estado |
|---|---|---|---|
| F1 | i18n menús y flujo | `src/i18n/dict/menus.js` (Boot, Menu, LevelSelect, Popup, LevelEnd, Photo, Configuración) y reemplazo de textos en esas escenas; selector ES/EN en el menú y en Configuración | En curso |
| F2 | i18n juego | Diccionario de `GameScene`/`HUDScene`/`TouchControls`/`InteractionPrompt`/`AlertToast` (avisos, tips del HUD, botones) | En curso |
| G | i18n datos | `src/data/tips.js`, `facts.js`, `quiz.js` a `{ es, en }`; biblioteca y especies ya nacieron bilingües | En curso |
| H | QA | Flujo completo en ES y EN, vertical (Pixel 5) y escritorio; correcciones | Pendiente |
| I | Documentación | Esta bitácora, `GDD.md`, `ARQUITECTURA.md`, `README.md`, `ATTRIBUTION.md`, sección "Estado" del plan v3 | Hecha (esta entrega) |

### Decisiones

- **Cámara IA simulada, con etiqueta DEMO.** No hay ningún modelo de visión: la especie sale del
  brote fotografiado (`brote.especieId`) o, si no hay brote a menos de 160 px, de
  `especieAleatoria()` con los pesos de `species.js` (Aedes aegypti 55 %). La confianza (87–98 %)
  y los puntos de referencia son pseudoaleatorios con semilla estable por foto. La pantalla lo
  aclara con la etiqueta "DEMO" y la documentación lo repite en cada lugar donde se menciona.
- **Dos cámaras para el zoom** (`CameraZoom.js`): la principal hace zoom al mundo (~9 tiles de
  ancho en vertical, ~15 en horizontal) y una segunda `uiCam` sin zoom dibuja todo lo que tenga
  `scrollFactor 0` (joystick, botones, minimapa, cartel, avisos). Así los controles no se
  escalan con el mundo y `worldToScreen()` da coordenadas de pantalla fiables para "evitar".
- **Los paneles del HUD se apartan (alpha) en vez de reubicarse.** Se descartó mover los paneles
  cuando tapan al jugador o a un brote: reubicarlos cada 100 ms genera saltos y rompe la memoria
  espacial del jugador. En cambio, `HUD.evitar(rects)` baja el panel al 25 % con un tween de
  150 ms y lo restaura al 90 % al despejarse; el minimapa hace lo mismo al 35 %. Solo el cartel de
  detección y el banner de tips cambian de lado (arriba/abajo), porque son transitorios.
- **i18n con diccionarios parciales fusionados.** `src/i18n/index.js` carga `./dict/*.js` con
  `import.meta.glob(..., { eager: true })` y hace `Object.assign` sobre `es.js`/`en.js`. Cada
  agente de la Ola 2 agrega su propio archivo en `src/i18n/dict/` sin tocar los de los demás
  (evita conflictos entre agentes en paralelo). Los datos (`species.js`, `library.js`, y en la
  Ola 2 `tips/facts/quiz`) usan objetos `{ es, en }` leídos con `tx()`/`txList()` en vez de claves.
- **Fumigar con `E` es "mantener"; con el botón del cartel es un toque.** `accionInicio()` /
  `accionFin()` (tecla `E` y botón ACCIÓN táctil) empiezan la fumigación y soltar la cancela
  (`cancelFumigation`, los mosquitos ya caídos no vuelven); el clic en el botón del cartel de
  detección (`intentarLimpiar()`) la deja correr sola. Esto reemplaza la decisión de la v2 ("un
  solo toque") documentada en GDD §3.
- **Insignias y álbum en `localStorage`**, siguiendo el patrón de `SaveSystem` (copia en memoria
  si el almacenamiento falla): `dengue.insignias`, `dengue.album`, `dengue.lang`.

### Pendientes

- QA final de la Ola 2 en ES y EN (vertical y escritorio): textos que se salen de los paneles en
  inglés, cambio de idioma en caliente en `Game`/`HUD` (hoy solo `LibraryScene` escucha `lang`).
- Los avisos de `GameScene` (`abrirCamara`, `onEspecieIdentificada`, bonus de estudio) siguen en
  español fijo hasta que F2 los pase por `t()`; `onEspecieIdentificada` usa `nombre.es`.
- Video demo v3 y capturas nuevas (Biblioteca, cámara IA, enjambre grande, vertical).
- **Push al cierre**, por pedido del usuario: un commit por ola en local y push solo cuando
  termine la Ola 2 y el QA; luego publicar el enlace de demo actualizado.
- Herencia de v2 sin resolver: `MissionManager` sigue sin misiones de brotes/estación (ver v2 ·
  Ola 2), y el video/QA de la v2 · Ola 3 queda absorbido por el QA de la v3.

---

## v2 · Ola 1 — Agente A: Layout responsivo + menús · Hecha

**Qué se construyó**
- `src/main.js`: `Scale.RESIZE` (el lienzo ocupa toda la ventana en vez del 960×540 con letterbox de v1).
- `src/systems/Layout.js`: helper de anclas, márgenes seguros, ancho de panel y factor de escala de UI (ya existía del commit anterior; sin cambios).
- `src/scenes/BootScene.js`, `src/scenes/MenuScene.js`, `src/scenes/LevelSelectScene.js`: reconstruyen su layout con `Layout.onResize` cada vez que cambia el tamaño de ventana u orientación, en vez de calcular posiciones una sola vez en `create()`. `MenuScene` apila CRÉDITOS/CONFIGURACIÓN en columna cuando está en vertical; `LevelSelectScene` pasa de fila a columna y escala las tarjetas para que quepan.
- `index.html` / `main.js`: se quitó el overlay "Gira tu dispositivo" y `instalarAvisoRotacion()` — v2 es mobile-first vertical, ya no tiene sentido bloquear el juego en ese modo.

**Verificado en el navegador (Playwright/preview):** Menu → LevelSelect → Game sin errores de consola en escritorio (≈629×598), vertical de celular (375×812) y horizontal de celular (812×375).

**Archivos clave:** `src/main.js`, `src/systems/Layout.js`, `src/scenes/BootScene.js`, `src/scenes/MenuScene.js`, `src/scenes/LevelSelectScene.js`, `index.html`.

**Fuera de alcance a propósito (de otros agentes de la Ola 1):** `GameScene`, `HUDScene`, `PopupScene`, `LevelEndScene`, `PhotoScene`, `InteractionPrompt`, `TouchControls`, `Joystick` siguen sin adaptar al nuevo tamaño de lienzo — hoy usan lo que había en v1. Todavía no existen `Brote.js`, `OutbreakManager.js`, `EpidemicMeter.js`, `FumigationFX.js`, `Minimap.js`, `Compass.js`, `AlertToast.js`, `Estacion.js`, `Vehiculo.js`, `src/data/tips.js` ni `src/data/quiz.js`.

**Pendiente conocido:** en esta máquina, `npm install` deja incompleto el binding nativo de `rolldown` (bug de npm con dependencias opcionales, ver [npm/cli#4828](https://github.com/npm/cli/issues/4828)); hubo que instalar `@rolldown/binding-win32-x64-msvc` a mano. Además Node es 20.14.0 y Vite 8 pide 20.19+/22.12+ (funciona igual, solo tira un warning).

---

## v2 · Ola 1 — Agente B: HUD y overlays responsivos · Hecha

**Qué se construyó**
- `src/scenes/HUDScene.js`: nuevo panel "Riesgo de epidemia" (barra roja/amarilla, `registry` key `epidemia`, pulso continuo por encima de 60 %, aviso "¡El barrio está en riesgo!"), colocado bajo el panel "Barrio protegido" en vertical y al lado en horizontal si hay sitio (`posicionarEpidemia`). `mostrarDato(texto, ms)` para los tips cortos de concientización, con panel propio abajo al centro.
- `src/scenes/PopupScene.js` y `src/scenes/PhotoScene.js`: ya usaban `Layout.onResize`/`Layout.panelWidth` de la Ola 1 previa; se mantienen sin cambios de fondo, solo se verificaron contra el nuevo tamaño de HUD.
- `src/scenes/LevelEndScene.js`: pantalla de resumen rehecha con cinta de color según `resultado` (`'completo'|'tiempo'|'epidemia'`, con textos y colores propios por caso), sección "Aprendiste hoy" (3 datos de `facts.js` al azar) y una pregunta de `quiz.js` con bonus visual +100 (no toca `SaveSystem` ni el registry, solo el texto del resumen). Todo el contenido se arma a un ancho de referencia (560 px) y se escala para cualquier tamaño de lienzo, igual que las tarjetas de `LevelSelectScene`.
- `src/systems/InteractionPrompt.js`: modo `sinBoton` (activo cuando `esModoTactil`): el cartel de detección muestra "Toca el botón de acción" en vez del botón "E · Eliminar agua", porque ese botón ahora vive en `TouchControls`.

**Archivos clave:** `src/scenes/HUDScene.js`, `src/scenes/PopupScene.js`, `src/scenes/LevelEndScene.js`, `src/scenes/PhotoScene.js`, `src/systems/InteractionPrompt.js`.

**Decisiones**
- El medidor de epidemia se dibuja como un segundo panel independiente del de "Barrio protegido" (mismo patrón visual) en vez de fusionarlos, para que ambos se lean como barras separadas con su propio color/urgencia.
- El bonus del quiz de `LevelEndScene` es puramente visual (solo cambia `puntosMostrados` en pantalla): no se reescribe en `registry` ni se guarda con `SaveSystem`, para no alterar el puntaje ya persistido al terminar la jornada.

**Pendientes conocidos:** sin verificación manual en dispositivo real de que el panel de epidemia y el de "Barrio protegido" no se superpongan en anchos intermedios entre vertical y horizontal (solo se revisó el código, no se corrió el juego).

---

## v2 · Ola 1 — Agente C: Brotes y fumigación · Hecha

**Qué se construyó**
- `src/objects/Brote.js`: sprite de brote con 3 niveles (`pequeño → medio → grande`, a los 20 s y 40 s más respectivamente), textura `mosquito_<nivel>` con fallback (círculo rojo + "!" dibujado con Graphics). `fumigar(opts)` delega toda la animación en `FumigationFX.playFumigation` y devuelve una Promise; reentrada bloqueada. Emite `'crecio'` y `'fumigado'` en el propio objeto.
- `src/systems/OutbreakManager.js`: hace aparecer un brote cada 25–40 s (al azar), 70 % de las veces cerca (80–160 px) de un criadero aún sucio y 30 % en un punto al azar del mapa; mantiene `this.activos` y notifica con `onChange(activos)` en cada aparición, crecimiento o fumigación.
- `src/systems/EpidemicMeter.js`: sin dependencia de Phaser. `tick(deltaMs, {brotesActivos, criaderosSucios})` sube el valor (0.4/0.8/1.5 por segundo según el nivel de cada brote activo, +0.05 por criadero sucio); `registrarFumigado(nivel)` baja 8/12/18 según el nivel; `registrarLimpieza()` baja 3. Valor clampeado 0..100.
- `src/systems/FumigationFX.js`: nube de partículas `spray` (o círculo celeste pulsante de fallback) alrededor del brote mientras este se desvanece en 2,5 s a pie o 1,5 s con `rapido: true` (camioneta); al terminar marca `brote.state = 'fumigado'` y emite el evento — nunca rechaza la Promise, incluso si algo falla a mitad de camino.

**Archivos clave:** `src/objects/Brote.js`, `src/systems/OutbreakManager.js`, `src/systems/EpidemicMeter.js`, `src/systems/FumigationFX.js`.

**Decisiones**
- El mockup (`PLAN_V2_JUGABILIDAD.md` 1.3) pedía "mantener presionado el botón de acción 2,5 s" para fumigar; en cambio se implementó como un solo toque que dispara `FumigationFX` (igual que `Criadero.clean()` para los criaderos), porque es el patrón de entrada que ya existía y `Brote.fumigar()` no tiene forma de leer "mantener presionado" sin rehacer `TouchControls`/teclado. La duración de 2,5 s / 1,5 s se conserva igual, solo cambia el gesto de entrada.
- `EpidemicMeter` es una clase plana (sin Phaser), igual que `MissionManager`/`ScoreManager`, para poder testear la lógica de subida/bajada sin una escena.

**Pendientes conocidos:** sin verificar en WebGL de gama baja el rendimiento de `scene.add.particles` para la nube de espray (mismo pendiente que ya existía para `EliminationFX`).

---

## v2 · Ola 1 — Agente D: Minimapa y brújula · Hecha

**Qué se construyó**
- `src/systems/Minimap.js`: minimapa fijo arriba a la derecha (96 px en vertical, 140 px en horizontal, debajo del panel "Barrio protegido" del HUD), redibujado con Graphics cada frame a partir de `getEntities()` (jugador blanco, estación azul, vehículo verde, criaderos sucios amarillo, brotes rojo parpadeante). Proyección lineal de `physics.world.bounds` al cuadro del minimapa.
- `src/systems/Compass.js`: flecha amarilla que orbita al jugador (radio 56 px) apuntando al brote activo más cercano; se oculta si no hay ninguno.
- `src/systems/AlertToast.js`: banner ancho arriba de la pantalla para avisos de brote ("¡Brote en Manzana 5! Fumígalo antes de que crezca."), con ícono (`alert` o fallback dibujado), tween de entrada desde arriba y sfx `'alert'`. Cola de un solo mensaje: una segunda llamada mientras hay uno visible reemplaza el texto y reinicia el timer, en vez de encolar.

**Archivos clave:** `src/systems/Minimap.js`, `src/systems/Compass.js`, `src/systems/AlertToast.js`.

**Decisiones**
- El minimapa redibuja con Graphics en cada `update()` en vez de usar un `RenderTexture` (como sugería el plan): con el número de entidades de un nivel (5 criaderos, unos pocos brotes) no hace falta la textura intermedia y así se evita gestionar su limpieza entre frames.

**Pendientes conocidos:** ninguno detectado al leer el código; falta la verificación visual en dispositivo real (Ola 3).

---

## v2 · Ola 1 — Agente E: Estación y camioneta · Hecha

**Qué se construyó**
- `src/objects/Estacion.js`: edificio fijo (textura `estacion` o fallback dibujado con Graphics), cuerpo estático sin collider; `cerca(player, radio = 90)` para saber si el jugador está a distancia de interactuar.
- `src/objects/Vehiculo.js`: camioneta que nace estacionada junto a la estación; `subir(player)`/`bajar(x, y)` la hacen seguir al jugador cada frame o quedarse estacionada; cambia de textura según la dirección del jugador (`vehiculo_<down|up|left|right>`, con fallback).
- `tools/gen-level.mjs`: agrega el campo `estacion: {x, y}` al nivel, buscando un tile libre de pasto o vereda a 3–14 tiles del spawn (relajando la distancia máxima y luego la mínima si no encuentra candidato), sin solapar objetos ni patios reservados para criaderos; la validación del generador ahora también comprueba la estación (dentro del mapa, sobre suelo válido, sin solapes, no demasiado cerca del spawn).

**Archivos clave:** `src/objects/Estacion.js`, `src/objects/Vehiculo.js`, `tools/gen-level.mjs`, `src/levels/equipetrol.json` (regenerado, ahora con `estacion`).

**Decisiones**
- La camioneta no tiene cuerpo físico propio: mientras el jugador está "montado" simplemente sigue su posición cada frame (`Vehiculo.update()`), y es `GameScene` quien aplica el factor de velocidad ×2 al jugador (`Player.setVehiculoFactor`). Evita duplicar colisiones entre jugador y camioneta.

**Pendientes conocidos:** ninguno.

---

## v2 · Ola 1 — Agente F: Assets v2 · Hecha

**Qué se construyó**
- `tools/gen-assets.mjs`: agrega `buildVehiculo()` (camioneta blanca con tanque de fumigación, 4 direcciones, 80×56), `buildEstacion()` (edificio con garaje y cartel "SEDES", 160×128), `buildBrotes()` (nubes de 2/3/4 mosquitos con aura roja de alarma creciente, 40/56/72 px) y `buildSpray()` (círculo de espray celeste, 32×32). El personaje del sprite sheet ya incluía el chaleco naranja de agente SEDES y la mochila fumigadora desde la Fase 1, así que no hizo falta tocar `characterSVG`.
- Todos los PNG quedaron versionados en `public/assets/sprites/` (`vehiculo_down|up|left|right.png`, `estacion.png`, `mosquito_pequeno|medio|grande.png`, `spray.png`).

**Archivos clave:** `tools/gen-assets.mjs`, `public/assets/sprites/`.

**Decisiones:** ninguna fuera del plan; se siguió el mismo patrón SVG → `sharp` → PNG que el resto del generador.

**Pendientes conocidos:** ninguno.

---

## v2 · Ola 1 — Agente G: Contenido educativo y audio · Hecha

**Qué se construyó**
- `src/data/tips.js`: mensajes cortos de concientización agrupados por acción (`fumigar`, `estacion`, `brote`), mostrados con `hud.mostrarDato()` o combinados en el primer `AlertToast` de brote.
- `src/data/quiz.js`: 8 preguntas de opción múltiple (con explicación) basadas en `facts.js`, usadas por `LevelEndScene` (una al azar por jornada).
- `tools/gen-sfx.mjs`: 4 efectos nuevos sintetizados (`alert.wav` dos tonos ascendentes repetidos, `spray.wav` niebla filtrada con silbido, `motor.wav` arranque grave con vibrato, `buzz.wav` zumbido agudo con trémolo), mismo enfoque sin dependencias que los 7 SFX de la Fase 4.
- `src/systems/AudioManager.js`: agrega `'alert'`, `'spray'`, `'motor'`, `'buzz'` a la lista `SFX` y sus volúmenes por key (`buzz` a 0.4, el resto al volumen por defecto).

**Archivos clave:** `src/data/tips.js`, `src/data/quiz.js`, `tools/gen-sfx.mjs`, `src/systems/AudioManager.js`, `public/assets/audio/`.

**Decisiones:** ninguna fuera del plan.

**Pendientes conocidos:** ninguno.

---

## v2 · Ola 1 — Agente H: Controles táctiles v2 · Hecha

**Qué se construyó**
- `src/systems/TouchControls.js`: agrega el botón VEHÍCULO (ícono de camioneta, azul) junto a ACCIÓN/LUPA/CORRER/PAUSA; solo expone el botón y dispara `onVehiculo()` — es `GameScene` quien decide si el jugador está lo bastante cerca de la estación o de la camioneta para subir. El botón ACCIÓN (mismo que la tecla `E`) ahora también dispara `fumigarBrote()` cuando hay un brote activo y no un criadero.
- `src/objects/Player.js`: `setVehiculoFactor(f)` (multiplicador de velocidad al subir a la camioneta, ×2) y el sprint (`setSprint`, energía 0..1) ya existentes de la Ola 1 previa, sin cambios de fondo.

**Archivos clave:** `src/systems/TouchControls.js`, `src/objects/Player.js`.

**Decisiones:** el botón VEHÍCULO no valida cercanía por sí mismo (a diferencia de LUPA/CORRER, que sí saben si hay un criadero activo): delega esa decisión en el callback `onVehiculo` de `GameScene.toggleVehiculo()`, para no duplicar el radio de detección en dos archivos.

**Pendientes conocidos:** falta el joystick/`Joystick.js` de la Ola 1 Agente A tal cual, sin cambios para esta ola (no le hacía falta ninguno).

---

## v2 · Ola 2 — Agente I: Integración del ciclo en GameScene · Hecha

**Qué se construyó**
1. **Jornada de 4 min**: `JORNADA_SEG = 240`; `update()` calcula los segundos restantes y los escribe en `registry 'tiempo'`. Al llegar a 0 llama `finDeNivel('tiempo')`.
2. **Estación y camioneta**: `this.estacion`/`this.vehiculo` nacen en `data.estacion` (con fallback a `level.spawn` si el nivel aún no trae ese campo). `toggleVehiculo()` (tecla `V` y botón `VEHÍCULO` de `TouchControls`) sube/baja según cercanía a la estación o a la propia camioneta; aplica `player.setVehiculoFactor(2|1)` y reproduce el sfx `'motor'` al subir. Tip de `TIPS.estacion` la primera vez que el jugador vuelve a la estación tras haber salido.
3. **Brotes**: `OutbreakManager` alimentado con los criaderos y los límites del nivel, actualizado cada frame. `actualizarDeteccion()` prioriza el criadero cercano sobre un brote activo (solo busca brote si no hay criadero en rango). `intentarLimpiar()` es ahora un dispatcher entre `limpiarCriadero()` (criaderos, sin cambios de fondo) y `fumigarBrote()` (brotes, nuevo): suma 75/90/100 puntos según el nivel del brote, baja el medidor de epidemia y muestra un tip de `TIPS.fumigar`. Los avisos de brote nuevo usan `AlertToast` (`onBroteNuevo`), detectando brotes realmente nuevos con un `WeakSet` para no repetir el aviso en cada crecimiento.
4. **Medidor de epidemia**: `epidemicMeter.tick()` cada frame con los brotes activos y los criaderos sucios; se escribe en `registry 'epidemia'`; a partir de 60 se marca `superoUmbral = true` (afecta las estrellas); al llegar a 100 se llama `finDeNivel('epidemia')`.
5. **`finDeNivel(resultado)`**: acepta `'completo' | 'tiempo' | 'epidemia'`. Estrellas: 0 si hubo epidemia; si no, 1 por terminar, 2 si el medidor nunca superó el umbral de riesgo, 3 si además se limpiaron todos los criaderos (reemplaza el cálculo anterior por tiempo de `ScoreManager.calcularEstrellas`, que queda en el archivo sin uso).
6. **Minimapa/brújula**: instanciados con `getEntities`/el brote activo más cercano (`broteMasCercano()`), actualizados cada frame.
7. `outbreakManager`, `minimap`, `compass` y `alertToast` se destruyen en el `shutdown` de la escena, junto con lo que ya se limpiaba antes.
8. El minimapa, la flecha de la brújula y el toast de alerta se agregan a la lista de overlays que `capturar()` oculta para las fotos antes/después, igual que ya se hacía con el HUD, el cartel de detección y el joystick.

**Archivos clave:** `src/scenes/GameScene.js`, `src/scenes/BootScene.js` (agrega `SPRITES_V2` y las 4 keys de audio nuevas a `SFX_FILES`, sin tocar `create()`).

**Decisiones que se desvían del plan original**
- El mockup pide "mantener presionada la tecla E 2,5 s" para fumigar un brote; `fumigarBrote()` usa un solo toque (mismo patrón que `limpiarCriadero()`), porque `FumigationFX.playFumigation()` ya controla toda la duración internamente (ver Ola 1 · Agente C) y no expone un modo "mantener presionado".
- No se implementó el "zoom de cámara por orientación" que menciona `PLAN_V2_JUGABILIDAD.md` (Ola 2 / Agente I): no estaba en los puntos concretos encargados a este agente y quedó pendiente.
- El aviso de "primer brote de la partida" combina el tip tutorial de `TIPS.brote[0]` con el aviso normal de zona en un solo `AlertToast.mostrar()` (en vez de mostrarlos uno tras otro), porque `AlertToast` reemplaza el mensaje visible en vez de encolar dos.
- **`MissionManager` no se tocó.** El plan (`PLAN_V2_JUGABILIDAD.md`, fila "Ola 2 / Agente I") menciona "misiones v2" como parte del entregable, pero las 4 misiones siguen siendo las de la Fase 5 (recorrer 3 zonas, encontrar 3 criaderos, ayudar a la familia, barrio 100 %): no hay ninguna misión relacionada con brotes, la estación o la camioneta. Es una brecha real entre el plan y lo implementado, no solo una omisión de este resumen.

**No se pudo verificar** (no se corrió el juego, según las instrucciones de la tarea): el layout visual del minimapa/brújula/alerta en pantalla real, el comportamiento en móvil táctil, ni que `node tools/gen-level.mjs` / los scripts de assets sigan siendo válidos de punta a punta. Se verificó sintaxis con `node --check` y que `git status` solo marcara `GameScene.js` y `BootScene.js` como modificados por este agente.

---

## v2 · Ola 2 — Agente J: Documentación · Hecha

**Qué se construyó**
- Se actualizó esta bitácora (`docs/PROGRESO.md`), `docs/ARQUITECTURA.md` y `README.md` para reflejar el v2 tal como quedó en el código (no el plan original), y se creó `docs/GDD.md` con las reglas de juego de la jornada v2.

**Archivos clave:** `docs/PROGRESO.md`, `docs/ARQUITECTURA.md`, `README.md`, `docs/GDD.md`.

**Decisiones:** se documentó una sección por agente de la Ola 1 (B–H) en vez de una sola sección combinada, para que cada fila de la tabla de agentes tenga su propio detalle verificable, igual que ya existía para el Agente A.

**Pendientes conocidos / inconsistencias detectadas para revisión:**
- `MissionManager` (Fase 5) no incluye ninguna misión de brotes/estación/camioneta pese a que el plan las menciona para esta ola (ver Agente I arriba).
- El plan (`PLAN_V2_JUGABILIDAD.md`, sección 1.5) describe un popup (modal, como `PopupScene`) para "la primera vez en la estación"; lo implementado es un tip de `TIPS.estacion` mostrado en el HUD (`hud.mostrarDato`, no modal, no pausa el juego).
- Fumigar un brote no requiere "mantener presionado" 2,5 s como describe el plan: es un solo toque/tecla, y la duración la controla `FumigationFX` internamente (ver Agente I).
- La Ola 3 (QA vertical Pixel 5, QA horizontal/escritorio, video demo v2) no tiene ningún artefacto nuevo: `docs/demo/` y `docs/capturas/` siguen siendo los de la Fase 7 (v1); no hay build ni enlace público actualizado para v2.

---

## v2 · Ola 3 — QA y video demo v2 · No iniciada

Ninguno de los 3 entregables de esta ola (QA vertical en Pixel 5, QA horizontal/escritorio, video demo v2 y publicación) tiene evidencia en el repositorio: `docs/demo/dengue-invaders-demo.webm` y las capturas de `docs/capturas/` son las mismas de la Fase 7 (v1, 960×540 con letterbox), no hay capturas nuevas del layout `Scale.RESIZE` en vertical/horizontal, y no se registró ninguna corrección de QA. Queda pendiente por completo.

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
| Brote de mosquitos (v2) | `src/objects/Brote.js` | Niveles pequeño/medio/grande, timers de crecimiento, `fumigar()` |
| Aparición de brotes (v2) | `src/systems/OutbreakManager.js` | Cuándo y dónde aparece cada brote, lista `activos` |
| Medidor de epidemia (v2) | `src/systems/EpidemicMeter.js` | Sube/baja el riesgo 0..100 según brotes y criaderos sucios |
| Animación de fumigar (v2) | `src/systems/FumigationFX.js` | Partículas de espray, desvanecido del brote, evento `fumigado` |
| Minimapa (v2) | `src/systems/Minimap.js` | Puntos de jugador/estación/criaderos/brotes/vehículo, proyección lineal |
| Brújula (v2) | `src/systems/Compass.js` | Flecha alrededor del jugador hacia el brote activo más cercano |
| Aviso de brote (v2) | `src/systems/AlertToast.js` | Banner superior con cola de un mensaje |
| Estación SEDES (v2) | `src/objects/Estacion.js` | Edificio fijo, `cerca(player, radio)` |
| Camioneta (v2) | `src/objects/Vehiculo.js` | Subir/bajar, sigue al jugador, velocidad ×2 |
| Contenido educativo (v2) | `src/data/tips.js`, `src/data/quiz.js` | Tips por acción y preguntas de opción múltiple del resumen |
| Controles táctiles (v2) | `src/systems/TouchControls.js` | Botones ACCIÓN/LUPA/CORRER/VEHÍCULO/PAUSA, `PauseMenu` |
| Layout responsivo (v2) | `src/systems/Layout.js` | Anclas, márgenes seguros, ancho de panel, `Scale.RESIZE` |
| Biblioteca SEDES (v3) | `src/scenes/LibraryScene.js`, `src/data/library.js` | Pestañas, carrusel de tarjetas, mitos que se voltean, marca tarjetas leídas |
| Insignias (v3) | `src/systems/Badges.js` | 4 insignias, tarjetas leídas y bonus de estudio en `localStorage 'dengue.insignias'` |
| Cámara IA — demo (v3) | `src/scenes/CameraScene.js`, `src/systems/CameraFX.js` | Visor, análisis simulado, resultado, álbum `'dengue.album'`; flash, escáner, puntos, retícula |
| Especies (v3) | `src/data/species.js` | Catálogo `{ es, en }` de 4 mosquitos, `especieAleatoria()` con pesos |
| i18n (v3) | `src/i18n/index.js`, `es.js`, `en.js`, `dict/*.js` | `t/tx/txList`, `setLang`, `'dengue.lang'`, evento `game.events 'lang'` |
| Zoom con dos cámaras (v3) | `src/systems/CameraZoom.js` | `applyCameraZoom`, `uiCam` sin zoom para la UI, `worldToScreen` |
| Enjambres (v3) | `src/objects/Brote.js` | Container con 8/14/22 mosquitos por nivel, `especieId`, `cancelarFumigacion()` |
| Fumigación v3 | `src/systems/FumigationFX.js` | Rociador, cono de niebla, caída uno a uno, `cancelFumigation`, `fumigationProgress` |
| Visibilidad (v3) | `src/scenes/GameScene.js`, `src/scenes/HUDScene.js` | `aplicarMargenCamara`, `actualizarEvitar` → `HUD.evitar`, cartel/banner en el lado opuesto, misiones plegables |


## v3 — Cierre (2026-09-14)

**QA final** (Playwright, Pixel 5 vertical 393×851 solo toques; horizontal 851×393; escritorio 1280×720 y 1920×1080; español e inglés): flujo completo sin errores de consola en las seis configuraciones.

**Correcciones del cierre**
- LevelEnd vertical: overlays del juego ya no "sangran" entre estrellas y resumen; panel de resumen más alto; overlay más opaco para leer el quiz; arrastre vertical cuando no cabe (851×393).
- Cartel de brote dice "Mantén el botón de acción" (fumigar es mantener).
- Cámara IA: el flash ya no queda opaco tras disparar en dispositivos lentos; visor en horizontal sin solapes.
- Cartel de detección solo se apoya bajo el banner de alerta si cabe sin tapar el objetivo; banner oculto al terminar la jornada.
- Modo foto en horizontal: botón de descarga reubicado.
- Logo sin lema horneado: "¡Juntos contra el dengue!" ahora es texto traducible del menú.

**Pendientes menores conocidos**
- LevelEnd a 720p se escala pequeño (quiz legible pero chico); Biblioteca en 1920×1080 no escala hacia arriba.
- Rendimiento medido solo con render por software (swiftshader, ~11 fps base); en GPU real no se espera problema.
- Video demo v3 (`npm run demo:video` graba el flujo v1; falta un guion v3).
