# Arquitectura — Dengue Invaders 2D

Referencia técnica de escenas, eventos, formatos y keys. Complementa a
[PLAN_DESARROLLO.md](PLAN_DESARROLLO.md), [PLAN_V2_JUGABILIDAD.md](PLAN_V2_JUGABILIDAD.md),
[PROGRESO.md](PROGRESO.md) y [GDD.md](GDD.md).

## 1. Escenas y flujo

```mermaid
flowchart TD
    Boot[Boot<br/>carga assets + anims] --> Menu
    Menu -->|JUGAR / Enter| LevelSelect
    LevelSelect -->|Volver / Esc| Menu
    LevelSelect -->|"start('Game', { levelId })"| Game
    Game -.->|"launch('HUD')"| HUD[HUD overlay]
    Game -.->|"launch('Popup', { type })"| Popup
    Popup -->|"popup:cerrado"| Game
    Game -.->|"launch('LevelEnd', {...})"| LevelEnd
    LevelEnd -->|"nivel:continuar"| Menu
    LevelEnd -->|"nivel:foto"| Photo
    Photo -->|"foto:cerrar"| LevelEnd
    Menu -.->|"launch('Library', { desde: 'menu' })"| Library[Library v3]
    Library -->|"game.events 'library:cerrar'"| Menu
    Game -.->|"E en la estación → launch('Library', { desde: 'estacion' })"| Library
    Library -->|"library:cerrar"| Game
    Game -.->|"C / botón CÁMARA → launch('Camera', { brote, especieId, snapshotKey })"| Camera[Camera v3]
    Camera -->|"camera:especie / camera:cerrar"| Game
```

| Key | Clase | Tipo | Archivo |
|---|---|---|---|
| `Boot` | `BootScene` | Secuencial | `src/scenes/BootScene.js` |
| `Menu` | `MenuScene` | Secuencial | `src/scenes/MenuScene.js` |
| `LevelSelect` | `LevelSelectScene` | Secuencial | `src/scenes/LevelSelectScene.js` |
| `Game` | `GameScene` | Principal | `src/scenes/GameScene.js` |
| `HUD` | `HUDScene` | Overlay paralelo a `Game` | `src/scenes/HUDScene.js` |
| `Popup` | `PopupScene` | Overlay modal (pausa `Game`) | `src/scenes/PopupScene.js` |
| `LevelEnd` | `LevelEndScene` | Overlay modal | `src/scenes/LevelEndScene.js` |
| `Photo` | `PhotoScene` | Overlay modal | `src/scenes/PhotoScene.js` |
| `Library` | `LibraryScene` | v3: overlay modal (desde `Menu` o `Game`, pausa suave) | `src/scenes/LibraryScene.js` |
| `Camera` | `CameraScene` | v3: overlay modal sobre `Game` (pausa suave) | `src/scenes/CameraScene.js` |

Los overlays se lanzan con `this.scene.launch(key, data)` desde `Game` y se cierran con
`this.scene.stop()` desde sí mismos, emitiendo un evento en la escena `Game`
(`this.scene.get('Game').events.emit(...)`). Todas las escenas deben estar registradas en
el arreglo `scene` de `src/main.js`.

Bucle de `GameScene.update()` (v2): `player.move(joystick.update())` → `vehiculo.update()` →
`zoneAt()` para la zona actual → cuenta atrás de la jornada (`JORNADA_SEG = 240` s; a 0 llama
`finDeNivel('tiempo')`) → `outbreakManager.update()` y `epidemicMeter.tick()` (a 100 llama
`finDeNivel('epidemia')`) → `actualizarDeteccion()` (criadero no limpio más cercano dentro de
`Criadero.RADIO_DETECCION`, o si no hay ninguno, un brote activo dentro de `RADIO_DETECCION_BROTE`
— el criadero siempre tiene prioridad; v3: si tampoco hay brote y la estación está cerca, el cartel
pasa a modo "estación") → `actualizarEstacionTip()` → `minimap.update()` / `compass.update()` →
tecla `E` / botón ACCIÓN: `JustDown` → `accionInicio()` (criadero → `limpiarCriadero()`; brote →
`fumigarBrote(b, { mantener: true })`; estación → `abrirBiblioteca()`), `JustUp` → `accionFin()`
(cancela la fumigación mantenida); el botón del cartel (ratón) llama `intentarLimpiar()` (sin
mantener) → tecla `V` / botón VEHÍCULO → `toggleVehiculo()` → tecla `C` / botón CÁMARA →
`abrirCamara()`. Aparte del bucle, un `time.addEvent` cada `EVITAR_MS = 100` ms corre
`actualizarEvitar()` (v3, ver 2.7). Ver "Sistemas v2" (2.6) para brotes, epidemia, estación y
camioneta, y "Sistemas v3" (2.7) para biblioteca, cámara, zoom, visibilidad e i18n.

## 2. Contratos

### 2.1 Registry del HUD

`HUDScene` lee el `registry` global al crearse y escucha `changedata`. `GameScene` escribe
con `this.registry.set(key, value)`. Keys exportadas como `HUD_KEYS`:

| Key | Tipo | Significado |
|---|---|---|
| `puntos` | `number` | Puntaje actual (al subir, el texto parpadea) |
| `estrellas` | `0..3` | Estrellas proyectadas |
| `limpios` | `number` | Criaderos limpios |
| `total` | `number` | Criaderos del nivel |
| `progreso` | `0..1` | Barra "Barrio protegido" (si no se define, usa `limpios/total`) |
| `zona` | `string` | Nombre de la zona actual (`level.zones[i].name`) |
| `misiones` | `{id, texto, hecho, progreso}[]` | Salida de `MissionManager.lista()` (sin cambios en v2: sigue siendo las 4 misiones de la Fase 5, sin ninguna de brotes/estación/camioneta) |
| `tiempo` | `number` (segundos) | v2: segundos **restantes** de la jornada de 240 s (antes era transcurrido); se muestra como `mm:ss` |
| `epidemia` | `0..100` | v2: valor de `EpidemicMeter`, dibujado como barra roja/amarilla; a partir de 60 el HUD muestra "¡El barrio está en riesgo!" y pulsa |

Método público adicional: `hud.mostrarDato(texto, ms = 4000)` para el dato educativo breve.
El HUD deja libre el centro superior (x 350–610, y 20–120) para el cartel de detección.

### 2.2 Eventos de escena

Todos se emiten en `scene.events` de **`Game`** salvo que se indique.

| Evento | Payload | Lo emite | Lo consume |
|---|---|---|---|
| `sfx` | `name` (`'step'`, `'detect'`, `'gluglu'`, `'pop'`, `'points'`, `'win'`, `'click'`, más v2: `'alert'`, `'spray'`, `'motor'`, `'buzz'`) | EliminationFX, Popup, LevelEnd, Photo, Menu, y v2: `AlertToast` (`'alert'`), `FumigationFX` (`'spray'`), `GameScene.toggleVehiculo` (`'motor'`), `Brote.crecer` (`'buzz'`) | `AudioManager.bind(scene)` → `AudioManager.play(name)` |
| `sfx` en `game.events` | `name` | `sfx()` de `MenuScene.js` (Menu y LevelSelect) | AudioManager debe escuchar también el emisor global |
| `foto:antes` | `criadero` | `playElimination` antes de drenar | GameScene: capturar textura `foto_antes` |
| `foto:despues` | `criadero` | `playElimination` al terminar | GameScene: capturar textura `foto_despues` |
| `popup:cerrado` | `type` del criadero | PopupScene al cerrar | GameScene: reanudar el juego |
| `nivel:continuar` | datos del fin de nivel | LevelEndScene, botón Continuar | GameScene: volver a `Menu` / `LevelSelect` |
| `nivel:foto` | datos del fin de nivel | LevelEndScene, botón Foto | GameScene: `launch('Photo', { antes, despues })` |
| `foto:cerrar` | — | PhotoScene al cerrar | GameScene: reabrir `LevelEnd` o seguir el flujo |
| `cleaned` (en el objeto) | `criadero` | `Criadero` al terminar de limpiarse | GameScene, MissionManager |
| `library:cerrar` (v3) | — | `LibraryScene.cerrar()`: siempre en `game.events`; además en `Game.events` si `desde === 'estacion'` | `MenuScene` (reanuda el menú), `GameScene.cerrarBiblioteca()` (escucha ambos: `reanudar()` + tip de la estación) |
| `camera:especie` (v3) | `{ id, confianza, nueva }` | `CameraScene` al guardar en el álbum | `GameScene.onEspecieIdentificada()`: otorga `Badges 'fotografo'`, `registry 'mensaje'`, aviso al reanudar |
| `camera:cerrar` (v3) | — | `CameraScene.close()` | `GameScene.cerrarCamara()` → `scene.stop('Camera')` + `reanudar()` |
| `sfx:loop` / `sfx:stop` (v3) | `name` (`'spray'`, `'motor'`) | `FumigationFX` (spray), `GameScene.actualizarMotor()` (motor) | `AudioManager.bind` → `playLoop` / `stopLoop` |
| `lang` en `game.events` (v3) | `'es' \| 'en'` | `setLang()` de `src/i18n/index.js` (requiere `bindGame(game)` en `main.js`) | Escenas que redibujan textos en caliente (hoy `LibraryScene`; F1/F2 agregan el resto) |

Datos de lanzamiento de overlays:

```js
this.scene.launch('Popup',    { type: 'llanta' });
this.scene.launch('LevelEnd', { puntos, limpios, total, tiempo, estrellas, nivelId, nivelNombre, resultado });
this.scene.launch('Photo',    { antes: 'foto_antes', despues: 'foto_despues' });
// v3
this.scene.launch('Library',  { desde: 'menu' | 'estacion', tab?: 'mosquitos' | 'ciclo' | 'sintomas' | 'prevencion' | 'mitos' });
this.scene.launch('Camera',   { brote: Brote | null, especieId: string | null, snapshotKey: 'cam_snap' | null });
```

`Library`: `desde` decide a quién avisar al cerrar (ver `library:cerrar`); `tab` abre una pestaña
concreta (por defecto la primera). `Camera`: `brote` es el brote fotografiado (a < 160 px,
`RADIO_FOTO_BROTE`) o `null`; `especieId` fija la especie del resultado (si es `null` se sortea con
`especieAleatoria()`); `snapshotKey` es la textura de 256×256 capturada por `GameScene.capturar()`
(si no existe, la escena dibuja una muestra propia).

`resultado` (v2, nuevo): `'completo' | 'tiempo' | 'epidemia'` — cómo terminó la jornada (ver 2.6).
`LevelEndScene` usa el valor para elegir el color/título de la cinta y el mensaje del bocadillo;
por defecto `'completo'` si se omite, para no romper llamadas antiguas.

### 2.3 Sistemas sin Phaser

- `MissionManager({ total, misionFamilia })`: `onZona(nombre)`, `onCriaderoLimpio(criadero)`,
  `onChange(cb)`, `lista()` → arreglo para el registry `misiones`. Objetivos: 3 zonas, 3 criaderos.
- `ScoreManager`: `addCriadero(now)` → `{puntos, bonus, combo, total}`; `progreso(limpios, total)`;
  `calcularEstrellas(segundos, completo)`. Constantes: +50, combo +25 dentro de 20 s,
  3 estrellas ≤ 150 s, 2 estrellas ≤ 240 s.
- `SaveSystem` (`saveSystem` instancia compartida): `getNivel(id)` →
  `{estrellas, mejorTiempo, mejorPuntos}`, `guardarNivel(id, {estrellas, tiempo, puntos})`, `reset()`.
  Clave `dengue.progreso`. El sonido usa la clave `dengue.sonido` (`'1'`/`'0'`).
- `EpidemicMeter` (v2): `tick(deltaMs, {brotesActivos, criaderosSucios})`, `registrarFumigado(nivel)`,
  `registrarLimpieza()`, `onChange(cb)`. Ver 2.6 para las tasas de subida/bajada.
- `Badges` (v3, `src/systems/Badges.js`, objeto singleton sin Phaser): ver 2.7.
- `i18n` (v3, `src/i18n/index.js`): ver 2.7.

Claves de `localStorage` en uso: `dengue.progreso` (SaveSystem), `dengue.sonido` (AudioManager),
`dengue.touch` (forzar modo táctil), y v3: `dengue.insignias` (Badges), `dengue.album`
(CameraScene), `dengue.lang` (i18n). Todas toleran almacenamiento inaccesible (copia en memoria).

### 2.4 UI táctil

- `src/data/ui.js`: `MIN_TOUCH = 64` px de escena (≈ 44 CSS px en un teléfono en horizontal con
  `Scale.FIT`) y `touchSize(w, h)`. Todo botón (`makeButton` de Menu/LevelSelect, Popup, LevelEnd,
  Photo y el "Eliminar agua" de `InteractionPrompt`) usa `setSize(...touchSize(w, h))` antes de
  `setInteractive()`: el área táctil puede ser mayor que el dibujo.
- Objetos fijos a la cámara que reciben input deben tener `scrollFactor 0` **también en el hijo
  interactivo** (`container.setScrollFactor(0, 0, true)`): el hit test de Phaser usa el scrollFactor
  del propio objeto, no el del contenedor padre.
- `Joystick`: solo responde a toques en la mitad izquierda **y por debajo del 40 % de la altura**
  (deja libre el panel de misiones del HUD), e ignora toques que caen sobre un objeto interactivo.
- Aviso "Gira tu dispositivo": overlay DOM `#rotate` en `index.html`, controlado desde `src/main.js`
  solo en dispositivos táctiles cuando la ventana es más alta que ancha (botón "Jugar así de todos modos").

### 2.5 Controles táctiles

Estilo Brawl Stars, solo en **modo táctil**: `esModoTactil(game)` (`src/data/ui.js`) usa
`game.device.input.touch` y se puede forzar con `localStorage 'dengue.touch'` = `'1'` / `'0'`
(pruebas, laptops táctiles). En escritorio no se dibuja ninguno: WASD/flechas, `E`, `Shift` (sprint)
y `Esc` (menú de pausa).

| Control | Archivo | Posición (escena 960×540) | Comportamiento |
|---|---|---|---|
| Joystick fijo | `Joystick.js` (`modo: 'fijo'`) | base en (110, alto − 110), siempre visible | Se activa con un toque a ≤ 90 px de la base o en la zona x < 45 %, y > 45 %; la base no se mueve, el knob se desplaza desde el punto de toque (clamp al radio) y vuelve con tween al soltar. `modo: 'flotante'` conserva el joystick anterior (escritorio). |
| ACCIÓN | `TouchControls.js` | (ancho − 100, alto − 100), r 46 | Misma función que `E` (`GameScene.intentarLimpiar`). Estados `apagado` (gris, alpha 0.4) / `activo` (amarillo + anillo pulsante) / `ocupado` (alpha 0.6) según `{ activo, limpiando }` que GameScene pasa en `touch.update()`. El cartel de `InteractionPrompt` se crea con `{ sinBoton: true }`: muestra "Toca el botón de acción" en lugar del botón. |
| LUPA | `TouchControls.js` | (ancho − 190, alto − 130), r 30 | Con criadero activo → `HUD.mostrarDato(FACTS[type].dato)`; sin activo → flecha alrededor del jugador hacia `GameScene.criaderoMasCercano()` y "Criadero a N m" (N = distancia/64) durante 2 s. Recarga 3 s (gris). |
| CORRER | `TouchControls.js` | (ancho − 100, alto − 200), r 30 | Sprint mientras se mantiene presionado: `Player.setSprint(bool)`, velocidad ×1.6, `player.energia` 0..1 se agota en 3 s y recarga en 4 s (anillo de energía alrededor del botón). `Shift` hace lo mismo en escritorio. |
| PAUSA | `TouchControls.js` + `PauseMenu` | (ancho − 30, 30), r 22 | Abre `PauseMenu` ("Continuar", "Sonido ON/OFF" vía `AudioManager.setEnabled`, "Salir al menú"). En modo táctil el HUD corre el panel "Barrio protegido" 60 px a la izquierda (`OFFSET_PAUSA_TACTIL`). |

`PauseMenu` existe en ambos modos (Esc lo abre y lo cierra): pausa suave dentro de `GameScene`
(`physics.pause()`, HUD oculto, reloj congelado con `tiempoInicio += delta`, `update()` retorna
temprano mientras `pausa.abierta`). Todos los botones tienen hit area ≥ `MIN_TOUCH`,
`setScrollFactor(0, 0, true)`, animación de "press" (scale 0.92) y emiten `sfx 'click'`. La
limpieza en curso deshabilita los botones y el joystick ignora toques sobre cualquier botón
(`over`). `TouchControls.overlays()` devuelve los objetos que `capturar()` oculta en las fotos.

### 2.6 Sistemas v2 (jornada del Agente SEDES)

El bucle base (criaderos, misiones, puntaje, popup educativo) no cambió; v2 le suma una jornada
con presión de tiempo, brotes de mosquitos, un medidor de epidemia y una estación con camioneta.
Constantes clave, todas en `GameScene.js` salvo que se indique: `JORNADA_SEG = 240` (duración de
la jornada, en segundos), `RADIO_DETECCION_BROTE = 90` px, `UMBRAL_RIESGO = 60` (también duplicada
en `HUDScene.js` para el pulso visual), `PUNTOS_BROTE = { pequeno: 75, medio: 90, grande: 100 }`.

- **`Brote`** (`src/objects/Brote.js`): sprite con `nivel` (`'pequeno'|'medio'|'grande'`) y `state`
  (`'activo'|'fumigando'|'fumigado'`). Crece solo con `time.delayedCall` (20 s a `medio`, 40 s más
  a `grande`); textura `mosquito_<nivel>` con fallback (círculo rojo + "!"). `fumigar({rapido})` →
  `Promise<Brote>`, reentrada bloqueada, delega toda la animación en `FumigationFX.playFumigation`.
  Emite `'crecio'` y `'fumigado'` en sí mismo.
- **`OutbreakManager`** (`src/systems/OutbreakManager.js`): `new OutbreakManager(scene, {criaderos,
  bounds})`; `.update(time, delta)` cada frame decide cuándo aparece el próximo brote (25–40 s al
  azar); `elegirPosicion()` — 70 % cerca (80–160 px) de un criadero aún sucio, 30 % al azar dentro
  de `bounds`. `.activos` es la lista viva; `.onChange(cb)` se dispara con `cb(this.activos)` al
  aparecer, crecer o fumigarse un brote.
- **`EpidemicMeter`** (`src/systems/EpidemicMeter.js`, sin Phaser): `.valor` 0..100. `tick(deltaMs,
  {brotesActivos, criaderosSucios})` sube `0.4|0.8|1.5` por segundo según el nivel de cada brote
  activo (pequeño/medio/grande) más `0.05` por segundo por cada criadero sucio.
  `registrarFumigado(nivel)` baja `8|12|18`; `registrarLimpieza()` baja `3` de golpe.
  `onChange(cb)` → `cb(valor, this)`.
- **`FumigationFX`** (`src/systems/FumigationFX.js`): `playFumigation(scene, brote, {rapido})` →
  `Promise<void>`. Nube de partículas `spray` (o círculo celeste pulsante de fallback) mientras el
  propio brote se desvanece (`alpha 1→0`) durante `FUMIGATION_DURATIONS.normal = 2500` ms a pie o
  `.rapido = 1500` ms en la camioneta (`enVehiculo`); al terminar marca `brote.state = 'fumigado'`
  y emite `'fumigado'` en el brote — nunca rechaza, incluso si la animación falla a mitad de camino.
  Emite `sfx 'spray'` al empezar.
- **`Minimap`** (`src/systems/Minimap.js`): `new Minimap(scene, {getEntities})` donde `getEntities()`
  devuelve `{player, estacion, criaderos, brotes, vehiculo}`; redibuja con Graphics cada
  `.update()` proyectando linealmente `physics.world.bounds` a un cuadro fijo arriba a la derecha
  (96 px en vertical, 140 px en horizontal, debajo del panel "Barrio protegido" del HUD).
- **`Compass`** (`src/systems/Compass.js`): `.update(target)` — flecha que orbita al jugador
  (radio 56 px) apuntando a `target` (`{x,y}`, normalmente el brote activo más cercano); oculta si
  `target` es `null`.
- **`AlertToast`** (`src/systems/AlertToast.js`): `.mostrar(texto, ms = 3000)` banner ancho arriba
  de la pantalla con tween de entrada/salida y `sfx 'alert'`; cola de un solo mensaje (una segunda
  llamada mientras hay uno visible reemplaza el texto y reinicia el timer, no encola).
- **`Estacion`** (`src/objects/Estacion.js`): edificio fijo, sin collider; `cerca(player, radio =
  90)`.
- **`Vehiculo`** (`src/objects/Vehiculo.js`): `subir(player)` / `bajar(x, y)`; mientras está
  montado sigue al jugador cada frame en `.update()` (sin cuerpo físico propio, decorativo);
  `cerca(player, radio = 90)`; `setDireccion(dir)` cambia la textura `vehiculo_<dir>`.
- **Estación/camioneta en `GameScene`**: `toggleVehiculo()` (tecla `V` o botón VEHÍCULO) exige
  estar cerca de la estación o de la camioneta para subir; al subir aplica
  `player.setVehiculoFactor(2)` (velocidad ×2, ver `Player.js`) y pasa `rapido: true` a
  `Brote.fumigar()`. Al volver a la estación tras haber salido, se muestra una vez el tip de
  `TIPS.estacion` (`src/data/tips.js`) — no es un popup modal como el de los criaderos, solo un
  `hud.mostrarDato()`.
- **Fin de jornada**: `GameScene.finDeNivel(resultado)` acepta `'completo'` (todos los criaderos
  limpios), `'tiempo'` (se acabaron los 240 s) o `'epidemia'` (el medidor llegó a 100). Estrellas:
  0 si `resultado === 'epidemia'`; si no, 1 por terminar, 2 si el medidor nunca llegó a
  `UMBRAL_RIESGO`, 3 si además `limpios >= total`. `LevelEndScene` cambia el color/título de la
  cinta y el mensaje del bocadillo según `resultado` (ver 2.2).
- **Contenido educativo v2**: `src/data/tips.js` (mensajes cortos por categoría: `fumigar`,
  `estacion`, `brote`, mostrados con `hud.mostrarDato()`) y `src/data/quiz.js` (8 preguntas de
  opción múltiple con explicación, usadas por `LevelEndScene` — una al azar, bonus visual +100 que
  no se guarda en `SaveSystem` ni en el registry).
- **Brecha conocida con el plan**: `MissionManager` (Fase 5) no se modificó para v2 — sigue
  ofreciendo las mismas 4 misiones de siempre (recorrer 3 zonas, encontrar 3 criaderos, ayudar a
  la familia, barrio 100 %), sin ninguna misión de brotes, estación o camioneta pese a que
  `PLAN_V2_JUGABILIDAD.md` la menciona para esta ola. Ver `docs/PROGRESO.md` (v2 · Ola 2).

### 2.7 Sistemas v3 (biblioteca, cámara IA, zoom, visibilidad, i18n)

Constantes clave en `GameScene.js`: `MARGEN_CAM = { tactilVertical: {top 150, bottom 250},
tactilHorizontal: {100, 120}, escritorio: {100, 60} }` (px de pantalla), `EVITAR_MS = 100`,
`ALPHA_MINIMAPA_EVITAR = 0.35`, `RADIO_FOTO_BROTE = 160`, `CAM_SNAP = 'cam_snap'` (256×256). En
`HUDScene.js`: `ALPHA_PANEL = 0.9`, `ALPHA_EVITAR = 0.25`, `MISIONES_DESPLEGADAS_MS = 3000`.

- **`LibraryScene`** (`src/scenes/LibraryScene.js`, key `Library`): lee `LIBRARY_TABS` e
  `INSIGNIAS` de `src/data/library.js`. Estado: `tabIdx`, `cardIdx[]` (una posición por
  pestaña), `mitoLado` (`'mito'|'verdad'`). Entrada: flechas laterales, `←/→`, deslizar (umbral
  `SWIPE = 50` px sobre `cardBounds`), toque corto/`Espacio`/`Enter` → `voltear()`, `Esc` → `cerrar()`.
  Al mostrar una tarjeta llama `Badges.marcarLeida(id)` y celebra las insignias devueltas.
  Escucha `game.events 'lang'` y redibuja. Texturas opcionales (`icon_book`, `mosq_*`, `ciclo_*`,
  `insignia_*`, `tab_*`, sprites de criaderos) con fallback dibujado. Reutiliza `makeButton` y
  `sfx` de `MenuScene.js`.
- **`src/data/library.js`**: `LIBRARY_TABS[] = { id, nombre {es,en}, icono, tarjetas[] }`; tipos
  de tarjeta `'especie'` (derivada de `SPECIES`), `'ciclo'` (`etapa`, `corte`), `'info'`
  (`texto`, `chips`), `'mito'` (`mito`, `verdad`). Exporta `ALL_CARD_IDS`, `SPECIES_CARD_IDS`
  (`esp_<id>`), `CARD_IDS_BY_TAB` e `INSIGNIAS[] = { id, icono, color, glifo, nombre, desc }`.
- **`Badges`** (`src/systems/Badges.js`): `lista()`, `tiene(id)`, `otorgar(id) → bool`,
  `tarjetasLeidas` (Set), `marcarLeida(id) → { nueva, ganadas[] }`, `bonusPendiente() → 50|0`
  (≥ `BONUS_TARJETAS = 5` tarjetas nuevas desde la última jornada), `consumirBonus()`, `reset()`.
  Reglas: `explorador` = 5 leídas; `detective` = las 4 `SPECIES_CARD_IDS`; `guardian` =
  `ALL_CARD_IDS`; `fotografo` lo otorga `GameScene.onEspecieIdentificada`. Persistencia en
  `localStorage 'dengue.insignias'` como `{ ganadas[], leidas[], nuevasDesdeJornada }`.
  `GameScene.create()` consume el bonus y lo suma con `sumarPuntos()` a los 700 ms.
- **`src/data/species.js`**: `SPECIES[] = { id, nombre, apodo, cientifico, color, sprite,
  spriteMini, frecuencia, reconocer {es[],en[]}, transmite, cria, horario, dato, senales }`;
  `speciesById(id)`, `especieAleatoria(rnd = Math.random)` (sorteo ponderado por `frecuencia`:
  aegypti 0.55, albopictus 0.2, culex 0.18, anopheles 0.07). Lo usan `Brote` (especie del
  enjambre), `CameraScene` y la Biblioteca.
- **`CameraScene`** (`src/scenes/CameraScene.js`, key `Camera`): fases `'visor' → 'analisis' →
  'resultado'` (`ANALISIS_MS = 2200`). Especie y confianza (`87 + floor(rnd()*12)`) se fijan con
  un `mulberry(seed)` estable por foto. `leerAlbum()` (estático) / guardar → `localStorage
  'dengue.album'` (array JSON de ids) y emite `camera:especie`. `Esc`/`Espacio`/`Enter`. Si
  `snapshotKey` no existe, `crearMuestra()` dibuja un fondo verde con un enjambre a un
  `RenderTexture` `'cam_snap_demo'`. **No hay modelo de IA**: es una simulación con etiqueta DEMO.
- **`CameraFX`** (`src/systems/CameraFX.js`): `flash(scene, ms)`, `scanner(scene, rect, ms,
  {passes}) → {obj, stop}`, `landmarks(scene, rect, labels, {seed, delay, gap}) → Container`,
  `reticle(scene, x, y, size)`, `frameCorners(scene, rect, len, thick)`; exporta también
  `mulberry(seed)` (PRNG). Todos devuelven objetos de escena que el llamador destruye.
- **Cámara en `GameScene`**: `abrirCamara()` (tecla `C` o `TouchControls.onCamara`) → si el brote
  más cercano está a < `RADIO_FOTO_BROTE` se centra en él, si no en el jugador → `pausaSuave('camara')`
  → `capturar(CAM_SNAP, centro)` → `launch('Camera', …)`. `cerrarCamara()` para y `reanudar()`.
  `pausaSuave(que)` / `reanudar()`: `physics.pause()`, jugador en idle, motor apagado, cartel,
  joystick, botones y HUD ocultos; `overlayAbierto = 'camara'|'biblioteca'` bloquea entradas y
  `teclasBloqueadasHasta` evita rebotes 300 ms tras reanudar; `mensajePendiente` se muestra al
  volver. `abrirBiblioteca()` / `cerrarBiblioteca()` siguen el mismo patrón (y al cerrar muestra el
  tip de la estación).
- **`CameraZoom`** (`src/systems/CameraZoom.js`): `applyCameraZoom(scene)` se llama una vez al
  final de `GameScene.create()`; crea `scene.uiCam` (segunda cámara, zoom 1, scroll 0) y reparte
  el display list por `cameraFilter`: todo objeto con `scrollFactor` 0 en ambos ejes es UI y lo
  dibuja solo `uiCam`; el resto solo la principal (con zoom `zoomPara(w, h)`: ~9 tiles de ancho en
  vertical, ~15 en horizontal, clamp `[0.7, 1.6]`, `TILE = 64`). Los objetos creados después se
  clasifican en el siguiente `POST_UPDATE`; `scene.marcarCamara(go, esUI)` reclasifica a mano.
  `worldToScreen(scene, x, y)` proyecta con el zoom de la principal alrededor de su centro — es la
  fórmula que usan `actualizarEvitar()`, el cartel y `capturar()`.
- **Margen de cámara**: `aplicarMargenCamara()` (en `create()` tras el zoom y en cada
  `Layout.onResize`) hace `cam.setBounds(0, -top/z, nivelW, nivelH + (top+bottom)/z)` con el
  `MARGEN_CAM` del modo actual, así el jugador se mantiene en la franja libre entre HUD y controles.
- **Paneles que se apartan**: `GameScene.actualizarEvitar()` (cada `EVITAR_MS`) arma `rects[]` en
  px de pantalla (jugador 56×72, brotes `width+16`, criadero activo 72×72, solo si no hay overlay
  ni pausa) y llama **`HUD.evitar(rects)`**: por cada panel de `panelesRect()` (retrato/jugador,
  línea de misión, misiones, barrio, epidemia, centro) que cruce algún rect, `atenuarPanel(obj,
  true)` (tween a `ALPHA_EVITAR` 0.25 en 150 ms — `EVITAR_MS` del HUD; detiene el pulso de epidemia) y lo restaura a
  `ALPHA_PANEL` al despejarse; `evitados` (Map) evita re-tweens. El minimapa se atenúa aparte
  (`ALPHA_MINIMAPA_EVITAR`). Después decide el lado del cartel/banner: `prompt.setLado('arriba'|
  'abajo')` y `hud.setLadoDato(lado, topeAbajo)` según si el objetivo (`activo`, `broteActivo` o
  la estación) está en la mitad superior o inferior. `HUD.desplegarMisiones()` /
  `plegarMisiones()` (vertical): la línea de misión es interactiva y despliega la lista 3 s.
- **`Brote` como Container** (`src/objects/Brote.js`): `extends Phaser.GameObjects.Container`;
  hijos: `halo` y `nube` (imágenes con textura suave generada `Brote.nubeTexture`) más
  `mosquitos[]` (`mosq_<especieId>_mini` 24×24 o fallback Graphics). `MOSQUITOS_POR_NIVEL = {8,
  14, 22}`, `RADIO_POR_NIVEL = {22, 32, 44}`, `MAX_MOSQUITOS_TOTAL = 70` (contador estático
  `Brote.totalMosquitos`), `MIN_MOSQUITOS = 4`, `FACTOR_FUMIGACION.grande = 1.5`. Propiedades:
  `nivel`, `state`, `especieId`, `agitacion` (0..1, la sube FumigationFX). Métodos: `fumigar({
  rapido }) → Promise<boolean>`, `cancelarFumigacion()`, `programarCrecimiento()` (se reprograma
  tras cancelar). Se actualiza en `scene.events UPDATE` (órbita, vibración, orientación). Sigue
  emitiendo `'crecio'` y `'fumigado'`. Como es un Container, `body`/`width` no vienen de un sprite:
  `GameScene` usa `b.width || 80` para el rect de "evitar".
- **`FumigationFX` v3**: `playFumigation(scene, brote, { rapido, factor, conVehiculo }) →
  Promise<boolean>` (true completada, false cancelada; nunca rechaza), `cancelFumigation(brote)`,
  `fumigationProgress(brote)`. Texturas: `rociador` (fallback `fb_rociador`), `niebla` → `spray` →
  disco generado, `drop`. `INICIO_CAIDA = 0.4`, `NIEBLA_POR_SEGUNDO = 72`. Emite `sfx:loop`/`sfx:stop`
  `'spray'`.
- **i18n** (`src/i18n/index.js`): `t(key, params)` (interpola `{n}`; cae a `es` y luego a la clave),
  `tx({es,en}|string)`, `txList({es:[],en:[]}|[])`, `getLang()`, `setLang('es'|'en')` (guarda
  `dengue.lang` y emite `game.events 'lang'`), `bindGame(game)` (en `main.js`). Diccionarios: base
  `es.js`/`en.js` más **parciales** `src/i18n/dict/*.js` (cada uno exporta `es` y `en` planos),
  fusionados con `import.meta.glob('./dict/*.js', { eager: true })` + `Object.assign` — una clave
  repetida gana la del archivo que se carga después, así que cada equipo usa prefijos propios
  (`menu.`, `cfg.`, `hud.`, `game.`, `lib.`, `cam.`). Idioma inicial: `localStorage` →
  `navigator.language` (`en*` → `'en'`) → `'es'`. Los datos usan `{ es, en }` con `tx/txList`,
  no claves.
- **Controles v3**: `TouchControls` agrega el botón CÁMARA (`onCamara`, sobre la lupa; ícono
  `icon_camera` o fallback dibujado) y pasa ACCIÓN por `accionInicio`/`accionFin` para el
  "mantener"; `InteractionPrompt` gana el modo `'estacion'` ("Biblioteca") y `setLado()`.

## 3. Formato de nivel (`src/levels/equipetrol.json`)

Generado por `tools/gen-level.mjs`, consumido por `LevelLoader.buildLevel(scene, level)`.
Coordenadas en **píxeles** (tile de 64 px). Se carga en el cache como `level_equipetrol`.

```jsonc
{
  "name": "Equipetrol",
  "width": 40, "height": 30, "tile": 64,
  "ground": [["pasto", "vereda", "calle", ...], ...],   // height filas × width nombres de tile
  "objects": [{ "type": "casa_a", "x": 64, "y": 128 }, ...], // esquina superior izquierda del sprite
  "spawn": { "x": 864, "y": 864 },
  "zones": [{ "name": "Manzana 1", "x": 0, "y": 0, "w": 320, "h": 192 }, ...],
  "criaderos": [{ "type": "llanta", "x": 864, "y": 1376 }, ...],   // centro del sprite, 5 tipos distintos
  "mision_familia": { "type": "tanque", "x": 224, "y": 1376 },     // debe coincidir con un criadero
  "estacion": { "x": 992, "y": 736 }                               // v2: estación SEDES + camioneta
}
```

`estacion` (v2, nuevo): centro del edificio. `tools/gen-level.mjs` lo coloca en un tile libre de
pasto o vereda a 3–14 tiles del spawn (relajando la distancia si no hay candidato), sin solapar
objetos ni patios reservados para criaderos. Si el JSON del nivel no trae este campo, `GameScene`
usa `level.spawn` como posición de respaldo.

- Nombres de tile válidos (índice = posición en `tiles/tileset.json`): `pasto`, `pasto_oscuro`,
  `pasto_seco`, `calle`, `calle_linea`, `calle_linea_v`, `cruce`, `vereda`, `tierra`, `cruce_v`,
  `esquina`, `vereda_borde`.
- Tipos de objeto (`OBJECT_DEFS` en `LevelLoader.js`): `casa_a`, `casa_b` (128×128, sólidas),
  `arbol`, `arbusto`, `muro_h`, `muro_v`, `porton` (sólidos), `planta`, `tanque_techo` (decorativos;
  `tanque_techo` se dibuja por encima de todo).
- Tipos de criadero: `llanta`, `tanque`, `balde`, `botella`, `florero`.
- El generador valida: casas sobre pasto, spawn sobre vereda, exactamente 5 criaderos de tipos
  distintos en manzanas distintas, dentro de un patio, sin solapar sólidos, a ≥ 2 tiles del
  spawn y ≥ 4 tiles entre sí; `mision_familia` en el patio de una casa con portón.

## 4. Keys de texturas y audio

Todo se carga en `BootScene` desde `import.meta.env.BASE_URL + 'assets/'`.

| Key | Archivo | Notas |
|---|---|---|
| `player` (atlas) | `anim/player.png` + `player.json` | Frames `down_0..3`, `up_0..3`, `left_0..3`, `right_0..3`; anims `walk_<dir>`, `idle_<dir>` |
| `tiles` (spritesheet) + `tilesMeta` (json) | `tiles/tileset.png` + `tileset.json` | 64×64, 4 columnas |
| `casa_a`, `casa_b`, `arbol`, `arbusto`, `planta`, `muro_h`, `muro_v`, `porton`, `tanque_techo` | `sprites/<key>.png` | Escenario |
| `<tipo>_agua`, `<tipo>_vacio`, `<tipo>_limpio`, `agua_<tipo>` | `sprites/<key>.png` | 5 tipos × 4 = 20 imágenes de 64×64 |
| `drop`, `spark`, `noise` | `sprites/<key>.png` | Partículas y máscara de EliminationFX |
| `vehiculo_down`, `vehiculo_up`, `vehiculo_left`, `vehiculo_right` | `sprites/<key>.png` | v2: camioneta de fumigación, 4 direcciones (80×56) |
| `estacion` | `sprites/estacion.png` | v2: edificio SEDES con garaje (160×128) |
| `mosquito_pequeno`, `mosquito_medio`, `mosquito_grande` | `sprites/<key>.png` | v2: brotes de mosquitos, 3 niveles (40/56/72 px) |
| `spray` | `sprites/spray.png` | v2: partícula de la nube de fumigación (32×32) |
| `key_e`, `panel`, `btn_green` | `ui/<key>.png` | UI de fase 3 |
| `alert` | `ui/alert.png` | Ícono del cartel de detección (fase 3) y de `AlertToast` (v2) |
| `retrato`, `retrato_pulgar`, `star_on`, `star_off`, `bar_bg`, `bar_fill`, `btn_gray`, `btn_red_x` | `ui/<key>.png` | UI de fases 5–6 (opcionales: las escenas tienen fallback dibujado) |
| `icon_back`, `icon_book`, `icon_camera`, `icon_gear`, `icon_lock`, `icon_share`, `icon_sound_on`, `icon_sound_off` | `ui/<key>.png` | Íconos |
| `logo`, `menu_bg`, `level_equipetrol`, `level_plan3000` | `img/<key>.png` | Menú y miniaturas (256×160) |
| `mosq_aegypti`, `mosq_albopictus`, `mosq_culex`, `mosq_anopheles` | `sprites/<key>.png` | v3: ilustración grande de cada especie (fichas de la Biblioteca y resultado de la cámara); key = `SPECIES[i].sprite` |
| `mosq_<id>_mini` (×4) | `sprites/<key>.png` | v3: mosquito de 24×24 para los enjambres de `Brote`; key = `SPECIES[i].spriteMini` |
| `rociador`, `niebla` | `sprites/<key>.png` | v3: rociador en la mano del agente y partícula de niebla de `FumigationFX` (fallbacks `fb_rociador` / `spray`) |
| `ciclo_huevo`, `ciclo_larva`, `ciclo_pupa`, `ciclo_adulto` | `ui/<key>.png` | v3: íconos de la pestaña Ciclo de vida |
| `insignia_explorador`, `insignia_detective`, `insignia_guardian`, `insignia_fotografo`, `insignia_bloqueada` | `ui/<key>.png` | v3: insignias (Biblioteca y selección de nivel); key = `INSIGNIAS[i].icono` |
| `tab_mosquito`, `tab_ciclo`, `tab_sintomas`, `tab_prevencion`, `tab_mitos` | `ui/<key>.png` | v3: íconos de las pestañas de la Biblioteca |
| `icon_camera_big`, `icon_library`, `icon_lang` | `ui/<key>.png` | v3: botón CÁMARA táctil, botón Biblioteca del menú, selector de idioma |
| `foto_antes`, `foto_despues` | (dinámicas) | Creadas en tiempo de ejecución con `snapshotArea` |
| `cam_snap`, `cam_snap_demo` | (dinámicas) | v3: foto de 256×256 para `CameraScene` (`GameScene.capturar`) y muestra de respaldo dibujada por la propia escena |
| `level_equipetrol` (json) | `src/levels/equipetrol.json` | Importado por URL de módulo (lo empaqueta Vite) |
| `sfx_step`, `sfx_detect`, `sfx_gluglu`, `sfx_pop`, `sfx_points`, `sfx_win`, `sfx_click`, `sfx_alert`, `sfx_spray`, `sfx_motor`, `sfx_buzz`, `music` (audio) | `audio/<nombre>.wav` | `AudioManager.play('gluglu')` usa el nombre sin prefijo; los últimos 4 son v2 (aviso de brote, fumigación, arranque de la camioneta, zumbido de mosquitos) |

## 5. Cómo añadir un nuevo barrio

1. **Generar el nivel.** Copia `tools/gen-level.mjs` (o parametrízalo por nombre) y cambia
   `OUT` a `src/levels/<barrio>.json`, `name`, la semilla del RNG y, si quieres, `H_ROADS` /
   `V_ROADS` y el tamaño `W × H`. Mantén las validaciones: el juego asume 5 criaderos de tipos
   distintos y una `mision_familia` que apunte a uno de ellos. Corre `node tools/gen-<barrio>.mjs`
   (o añade un script `gen:level:<barrio>` en `package.json`).
2. **Cargarlo.** En `BootScene.preload()` añade
   `this.load.json('level_<barrio>', new URL('../levels/<barrio>.json', import.meta.url).href)`.
3. **Catálogo.** En `src/data/levels.js` añade una entrada a `LEVELS`:
   `{ id: '<barrio>', nombre: 'Nombre visible', thumb: 'level_<barrio>', bloqueado: false, data: 'level_<barrio>' }`.
   `id` es la clave de guardado en `SaveSystem` y el `levelId` que recibe `GameScene`; `data` es
   la key del JSON en el cache (`this.cache.json.get(data)`).
4. **Miniatura (opcional).** Genera `public/assets/img/level_<barrio>.png` (256×160) en
   `tools/gen-assets.mjs` (función `buildMenu`) o dibújala a mano; cárgala en `BootScene` con la
   key `level_<barrio>`. Si la textura no existe, `LevelSelectScene` dibuja una por defecto.
5. **Desbloqueo.** Para el flujo "Plan 3000 se desbloquea al terminar Equipetrol", cambia
   `bloqueado` por una comprobación con `saveSystem.getNivel('equipetrol')?.estrellas > 0`
   en `LevelSelectScene`.
