# Dengue Invaders 2D — Plan v2: jugabilidad "Agente SEDES" y móvil vertical

El MVP v1 (fases 1–7) demostró el ciclo básico: recorrer, detectar y eliminar criaderos.
La v2 convierte eso en un **trabajo con presión de tiempo**: el jugador es un agente del
SEDES con una estación, brotes de mosquitos que aparecen en el barrio, un minimapa que
avisa, vehículos de fumigación y un medidor de epidemia que sube si no se actúa.
Además, el juego debe jugarse **en vertical desde el celular** con todos los controles
en pantalla (mobile first), y seguir funcionando en horizontal y en escritorio.

---

## 1. Diseño del ciclo de juego

### 1.1 Fantasía y rol
- El personaje es un **agente del SEDES** (chaleco naranja con logo, gorra, mochila fumigadora).
- Tiene una **estación SEDES** en el barrio (edificio con garaje). Ahí empieza y ahí vuelve.
- En la estación hay una **camioneta de fumigación**: subirse duplica la velocidad y fumiga
  brotes más rápido; caminar permite entrar a patios y limpiar criaderos.

### 1.2 La jornada (nivel)
- Un nivel es una **jornada de 4 minutos** en el barrio.
- Objetivo doble: **limpiar los criaderos** (como en v1) y **atender los brotes** que aparecen.
- Termina cuando se acaba el tiempo **o** cuando el medidor de epidemia llega al 100 %.

### 1.3 Brotes de mosquitos
- Cada 25–40 s aparece un **brote** en un punto del mapa (prioridad: cerca de criaderos sucios).
- Un brote tiene 3 niveles: **pequeño** (nube de 3 mosquitos) → **medio** (20 s después) →
  **grande** (40 s después). Cuanto más grande, más sube el medidor por segundo y más
  tarda en fumigarse.
- Al aparecer: sonido de alerta, aviso "¡Brote en Manzana 5! Fumígalo antes de que crezca",
  parpadeo en el minimapa y flecha de brújula alrededor del jugador.
- **Fumigar**: acercarse y mantener el botón de acción 2,5 s (1,5 s con camioneta). Animación
  de rociado con partículas, los mosquitos caen. +75 puntos (+100 si era grande).

### 1.4 Medidor de epidemia
- Barra roja en el HUD ("Riesgo de epidemia"). Sube con cada brote activo según su nivel
  y con cada criadero sucio (poco). Baja al fumigar y al limpiar criaderos.
- Al 60 %: aviso "El barrio está en riesgo". Al 100 %: fin de jornada con la pantalla
  **"Se declaró epidemia"** con mensaje de concientización y botón "Intentar de nuevo".
  No es un "game over" duro: cuenta los puntos ganados y explica qué faltó.

### 1.5 Aprender jugando (concientización)
- Cada acción muestra un **mensaje corto** (2–4 s) en el HUD: al fumigar ("La fumigación
  mata al mosquito adulto, pero no las larvas: hay que eliminar los criaderos"), al limpiar
  ("Cambia el agua del florero cada 3 días"), al volver a la estación ("Reporta los casos
  de fiebre alta a tu centro de salud").
- Al terminar cada jornada, la pantalla de resumen muestra **3 datos aprendidos** y una
  pregunta de opción múltiple (1 pregunta) que da puntos extra si se responde bien.
- El popup educativo de criaderos (v1) se mantiene; se agregan popups para el primer
  brote y para la primera vez en la estación (tutorial ligero).

### 1.6 Puntaje y estrellas
- Criadero limpio +50, combo +25, brote pequeño +75, medio +90, grande +100, pregunta +100.
- Estrellas al final de la jornada: 1 por terminar sin epidemia, 2 si el medidor nunca pasó
  de 60 %, 3 si además se limpiaron todos los criaderos.

---

## 2. Móvil vertical (mobile first)

- Se abandona el lienzo fijo 960×540 con letterboxing. El juego pasa a **`Scale.RESIZE`**:
  el lienzo ocupa toda la pantalla y cada escena **reacomoda su UI** según el tamaño
  (`scene.scale.on('resize')`). Se define un sistema de **anclas** en `src/systems/Layout.js`
  (esquinas, centro, márgenes seguros, `isPortrait`).
- En vertical, la cámara del juego muestra menos ancho y más alto (zoom automático para que
  el personaje se vea del mismo tamaño en todas las pantallas: ~9 tiles de ancho).
- **Controles táctiles siempre visibles** en dispositivos táctiles: joystick fijo abajo a la
  izquierda, botón de acción grande abajo a la derecha, secundarios (lupa, correr, subir a la
  camioneta) alrededor, pausa arriba a la derecha. En escritorio, teclado y ratón.
- **Minimapa** en la esquina superior derecha (vertical: 96 px; horizontal: 140 px), con
  jugador, estación, criaderos sucios, brotes parpadeando y camioneta.
- Los paneles (popup, fin de jornada, menú, selección) se dibujan con **ancho relativo**
  (min(ancho − 32, 560)) y se apilan en columna en vertical.
- Se elimina el aviso "Gira tu dispositivo".

---

## 3. Olas de trabajo (agentes en paralelo)

### Ola 1 — sistemas y assets (8 agentes, sin conflictos de archivos)
| # | Agente | Archivos | Entregable |
|---|---|---|---|
| A | Layout responsivo + menús | `src/main.js`, `src/systems/Layout.js`, `MenuScene`, `LevelSelectScene`, `BootScene` | Scale.RESIZE, anclas, menús que se reacomodan en vertical/horizontal |
| B | HUD y overlays responsivos | `HUDScene`, `PopupScene`, `LevelEndScene`, `PhotoScene`, `InteractionPrompt` | Medidor de epidemia, mensajes de concientización, resumen con datos aprendidos y pregunta, todo responsivo |
| C | Brotes y fumigación | `src/objects/Brote.js`, `src/systems/OutbreakManager.js`, `src/systems/EpidemicMeter.js`, `src/systems/FumigationFX.js` | Aparición, crecimiento, fumigación con partículas, medidor |
| D | Minimapa y brújula | `src/systems/Minimap.js`, `src/systems/Compass.js`, `src/systems/AlertToast.js` | Minimapa con RenderTexture, flecha al brote más cercano, avisos |
| E | Estación y camioneta | `src/objects/Estacion.js`, `src/objects/Vehiculo.js`, `tools/gen-level.mjs` (+ `estacion`, `garaje`) | Subir/bajar de la camioneta, velocidad, radio de fumigación |
| F | Assets v2 | `tools/gen-assets.mjs` | Agente con chaleco SEDES (4 dir), camioneta 4 dir, estación, mosquitos (3 tamaños), spray, íconos de minimapa, ícono fumigar/subir/lupa/correr |
| G | Contenido educativo y audio | `src/data/tips.js`, `src/data/quiz.js`, `tools/gen-sfx.mjs`, `AudioManager` | Tips por acción, 8 preguntas, sonidos de alerta, spray, motor, mosquitos |
| H | Controles táctiles v2 | `src/systems/TouchControls.js`, `src/systems/Joystick.js`, `Player.js` | Botones acción/lupa/correr/vehículo/pausa, layout vertical |

### Ola 2 — integración (2 agentes secuenciales)
| # | Agente | Entregable |
|---|---|---|
| I | Integración del ciclo en `GameScene` | Jornada con reloj, brotes, medidor, estación/camioneta, misiones v2, fin por tiempo o epidemia, zoom de cámara por orientación |
| J | Documentación | `PROGRESO.md`, `ARQUITECTURA.md`, `README.md`, `GDD.md` (reglas del juego) |

### Ola 3 — QA (3 agentes)
| # | Agente | Entregable |
|---|---|---|
| K | QA vertical Pixel 5 (toques) | Flujo completo en 393×851 con capturas; correcciones |
| L | QA horizontal + escritorio | Flujo completo; regresiones del v1; correcciones |
| M | Video demo v2 y publicación | `docs/demo/`, build para el enlace público |

---

## 4. Criterios de "listo" de la v2
1. En un Pixel 5 vertical se juega una jornada completa solo con toques, sin girar el teléfono.
2. Aparecen brotes, el minimapa y la brújula avisan, se fumigan con la camioneta o a pie.
3. El medidor de epidemia sube y baja; al 100 % aparece la pantalla de epidemia con mensaje.
4. Cada acción muestra un mensaje de concientización; el resumen incluye una pregunta.
5. Escritorio y horizontal siguen funcionando con teclado y ratón.
6. Bitácora y arquitectura actualizadas; enlace público actualizado.
