# Dengue Invaders 2D — Plan de desarrollo del MVP (demo jugable)

**Objetivo:** un prototipo web 2D, 100 % visual y jugable, sin backend ni base de datos.
Todo corre en el navegador; el progreso se guarda en `localStorage`.
**Público:** demo educativa para estudiantes de Santa Cruz. No es producto comercial.
**Referencia visual:** el mockup `plan-dengue-invaders-2d` (8 pantallas + guía de estilo).

---

## 0. Análisis del material recibido

### 0.1 Lo que define la imagen de referencia

| Elemento | Qué muestra el mockup | Decisión para el MVP |
|---|---|---|
| Estilo | 2D top-down, cartoon limpio, colores saturados, sombras suaves, sin pixel-art duro | Sprites vectoriales/cartoon a 64 px de tile, exportados a PNG |
| Paleta | Verde `#5cc23a`, oliva `#a8b45c`, naranja teja `#e8703a`, celeste `#7dd3f5`, azul marino `#2c3e50`, gris `#4a4f55` | Se fija en `src/data/palette.js` y en el CSS de UI |
| Personaje | Estudiante con gorra azul y mochila, hoja de 4 direcciones (arriba/derecha/abajo/izquierda) | 4 direcciones × 3 frames de caminata = 12 frames + 4 idle |
| Criaderos | Llanta, tanque, balde, botella, florero | 5 tipos, cada uno con 3 estados: con agua / vaciándose / limpio |
| Escenario | Árbol, casa (techo teja), calle, muro, planta | Tileset mínimo de ~20 tiles |
| Pantallas | Menú, juego, detección, animación de eliminación, popup educativo, fin de nivel, selección de nivel, modo foto | 8 escenas/overlays, en el orden de prioridad de la sección 2 |
| UI | Paneles azul marino con borde claro, botones verdes redondeados, estrellas amarillas, barra de progreso verde | Un solo kit de UI reutilizable (9-slice) |

### 0.2 Lo que se toma del plan original y lo que se ajusta

- **Se mantiene:** Phaser 3 + Vite, escenas Boot/Menu/Game/HUD, objetos Player/Criadero, sistemas EliminationFX/Score/Mission/Save, datos educativos de SEDES.
- **Se ajusta:** el mapa **no** se hace con Tiled ni con OpenStreetMap en el MVP. Se dibuja un barrio ficticio "inspirado en Equipetrol" como tilemap en JSON generado por script. Motivo: OSM añade licencia, exportación y calibración que no aportan a una demo. Se deja como fase futura.
- **Se ajusta:** el segundo barrio (Plan 3000) aparece **bloqueado** en la pantalla de selección, como en el mockup, pero no se construye.
- **Se elimina del MVP:** Firebase, leaderboard, timer competitivo. El tiempo solo se muestra en el fin de nivel.

---

## 1. Alcance del MVP (qué sí y qué no)

**Sí (demo jugable completa):**
1. Menú principal con logo, JUGAR, Créditos, Configuración (solo volumen on/off).
2. Selección de nivel: Equipetrol jugable, Plan 3000 bloqueado.
3. Un barrio de ~40×30 tiles con calles, 6 a 8 casas, árboles, muros y 5 criaderos.
4. Personaje con movimiento en 8 direcciones, teclado (WASD/flechas) y joystick táctil.
5. Detección por proximidad con cartel "¡Criadero detectado!" y botón/tecla E.
6. Animación de eliminación en 4 pasos (agua baja → splash → disolución → limpio ✓).
7. Popup educativo por tipo de criadero con dato de SEDES.
8. HUD con puntos, estrellas, misiones y barra "Barrio protegido %".
9. Fin de nivel con estrellas, resumen y mensaje del personaje.
10. Modo foto antes/después con botón de descarga de imagen.
11. Guardado local de estrellas y progreso.

**No (fase futura, documentada en la sección 5):** backend, ranking, mapa OSM real, segundo barrio jugable, música original, idiomas.

---

## 2. Prioridad de diseño visual (qué se dibuja primero)

El orden responde a una regla: **primero lo que se ve en cada segundo de la demo, después lo que se ve una vez.**

| Prioridad | Asset | Cantidad | Por qué va aquí |
|---|---|---|---|
| P0 | Personaje (hoja de animación 4 direcciones) | 16 frames | Está en pantalla el 100 % del tiempo |
| P0 | Tileset de suelo: pasto, calle, vereda, cruce | 8 tiles | Sin esto no hay barrio |
| P0 | Llanta en 3 estados | 3 sprites | Es el criadero del mockup y de la animación estrella |
| P0 | Partícula de gota de agua y textura de ruido para disolución | 2 texturas | Necesarias para EliminationFX |
| P1 | Kit de UI: panel 9-slice, botón verde, botón gris, estrella llena/vacía, barra de progreso, icono de alerta, ícono E | 9 piezas | Toda la interfaz depende de esto |
| P1 | Tanque, balde, botella, florero en 3 estados | 12 sprites | Completan los 5 criaderos |
| P1 | Casa (2 variantes), árbol, planta, muro, tanque de techo | 6 sprites | Dan identidad al barrio |
| P2 | Logo "Dengue Invaders 2D" con mosquito | 1 imagen | Menú principal |
| P2 | Fondo del menú (barrio desenfocado) | 1 imagen | Se puede reutilizar una captura del nivel |
| P2 | Retrato del personaje (HUD y fin de nivel, pulgar arriba) | 2 imágenes | Aparecen en pantallas puntuales |
| P2 | Miniaturas de nivel Equipetrol / Plan 3000 | 2 imágenes | Selección de nivel |
| P3 | Íconos: cámara, compartir, candado, libro, engranaje, volver | 6 íconos | Pequeños, se pueden reemplazar por emoji si falta tiempo |
| P3 | Sonidos: pasos, detección, gluglu, pop, +puntos, victoria | 6 SFX | Generados con jsfxr al final |

### 2.1 Cómo se producen los assets

Estrategia en dos capas para que el juego nunca se quede sin gráficos:

1. **Capa base, generada por script (garantizada).** Un script `tools/gen-assets.mjs` dibuja cada sprite como SVG con la paleta oficial y lo exporta a PNG con `sharp`. Esto produce el personaje, los 5 criaderos en 3 estados, el tileset, el kit de UI y los íconos. El resultado es cartoon simple, coherente y consistente con el mockup. Es reproducible: si cambia la paleta se regeneran todos.
2. **Capa de mejora, con generador de imágenes (opcional).** Para logo, fondo de menú, retratos y miniaturas se usa una hoja de prompts (`docs/ASSET_PROMPTS.md`) que fija estilo, paleta, ángulo y fondo transparente. Cada imagen generada reemplaza a su equivalente de la capa base sin tocar código, porque los nombres de archivo son fijos.

Regla de nombres: `assets/sprites/<tipo>_<estado>.png`, `assets/tiles/tileset.png`, `assets/ui/<pieza>.png`, `assets/anim/player.png` (hoja) + `player.json` (atlas).

---

## 3. Etapas de desarrollo

Cada etapa tiene un entregable visible y un criterio de "listo". No se pasa a la siguiente sin cumplirlo.

### Etapa 1 — Cimientos y guía de estilo (½ día)
**Entregable:** proyecto Vite + Phaser corriendo, pantalla vacía con la paleta aplicada, personaje generado moviéndose.
- Crear proyecto, `main.js` con `Scale.FIT`, 960×540 base, física arcade.
- `src/data/palette.js` con los 6 colores del mockup.
- Script `tools/gen-assets.mjs` con el primer sprite: personaje 4 direcciones.
- `Player.js`: movimiento 8 direcciones, animaciones por dirección, joystick táctil con el plugin virtual de Phaser o uno propio de 40 líneas.
- **Listo cuando:** el personaje camina y anima en escritorio y en un celular.

### Etapa 2 — El barrio (1 día)
**Entregable:** mapa de Equipetrol ficticio con colisiones.
- Tileset de suelo (P0) y decoración (P1) generados por script.
- `levels/equipetrol.json`: tilemap generado por `tools/gen-level.mjs` (calles en cuadrícula, manzanas con casas y jardines). Formato compatible con `Phaser.Tilemaps`.
- Capa de colisión: casas, muros, árboles.
- Cámara que sigue al jugador con límites del mapa.
- **Listo cuando:** se recorre todo el barrio sin atravesar nada y se ve como la "Vista principal" del mockup.

### Etapa 3 — Criaderos e interacción (1 día)
**Entregable:** 5 criaderos detectables y eliminables (sin animación todavía).
- `Criadero.js` con estados `oculto → detectado → limpiando → limpio`.
- Zona de proximidad circular; al entrar aparece el cartel "¡Criadero detectado!" y el botón "E · Eliminar agua" (tecla E y toque).
- Sprites de los 5 tipos en sus 3 estados (P0 + P1).
- `data/facts.js` con los 5 datos educativos (fuente SEDES Santa Cruz).
- **Listo cuando:** se puede limpiar los 5 criaderos y el estado cambia visualmente.

### Etapa 4 — Animación estrella: EliminationFX (1–2 días)
**Entregable:** la secuencia de 4 pasos del mockup, con sonido y puntos flotantes.
1. Tween: la capa de agua baja de escala en Y (1,5 s, `Sine.easeIn`).
2. Splash: emisor de partículas con textura de gota, gravedad, 30 partículas, 600 ms.
3. Disolución: máscara bitmap con textura de ruido + fade a alpha 0, 800 ms.
4. Estado limpio: brillo dorado (partículas de chispa) + check verde 400 ms.
- Texto flotante "+50" subiendo con tween.
- Sonidos gluglu y pop generados con jsfxr y exportados a `.wav`.
- Bloqueo de input del jugador durante la animación.
- **Listo cuando:** la secuencia dura ~3,3 s, se ve fluida a 60 fps en móvil y coincide con los 4 cuadros del mockup.

### Etapa 5 — HUD, misiones, popups y puntaje (1 día)
**Entregable:** la capa de información completa como en el mockup.
- `HUDScene.js` overlay: retrato, puntos, 3 estrellas, panel de misiones con checkboxes, barra "Barrio protegido %".
- `MissionManager.js`: "Recorre el barrio" (visitar 3 zonas) → "Encuentra 3 criaderos" → "Ayuda a la familia" (el criadero del patio de la casa marcada) → "Barrio 100 %".
- `ScoreManager.js`: +50 por criadero, +25 bonus si se limpia dentro de 20 s del anterior (combo). Estrellas: 1 por terminar, 2 por menos de 4 min, 3 por menos de 2:30.
- Popup educativo (imagen del criadero, título, dato, fuente, botón "¡Genial!") que pausa el juego.
- Pantalla de fin de nivel: banner "¡Barrio protegido!", estrellas animadas una a una, resumen, mensaje del personaje, botón Continuar.
- `SaveSystem.js`: estrellas y mejor tiempo en `localStorage`.
- **Listo cuando:** un nivel completo se juega de principio a fin con toda la UI del mockup.

### Etapa 6 — Menú, selección de nivel y modo foto (1 día)
**Entregable:** el flujo completo de navegación.
- `MenuScene.js`: logo, fondo, JUGAR, Créditos (con atribuciones), Configuración (sonido on/off).
- `LevelSelectScene.js`: tarjetas Equipetrol (estrellas guardadas) y Plan 3000 (candado), botón Volver.
- `PhotoScene.js`: al terminar el nivel, muestra antes/después del último criadero (se captura el sprite con `renderer.snapshotArea` antes y después de la animación) y botón para descargar la imagen compuesta.
- **Listo cuando:** Menú → Selección → Juego → Fin → Foto → Menú sin recargar la página.

### Etapa 7 — Pulido, sonido, despliegue y demo (1 día)
**Entregable:** demo publicada y grabada.
- Música de fondo en loop (CC-BY) o pista generada con Tone.js; SFX restantes.
- Pantalla de carga con barra de progreso en `BootScene`.
- Pruebas en Chrome escritorio, Android Chrome e iOS Safari.
- `ATTRIBUTION.md` con créditos de assets, fuentes y sonidos.
- Build con `vite build` y publicación en GitHub Pages desde la carpeta `dist/`.
- Video de 60 s: la animación de eliminación aparece en el segundo 10.
- **Listo cuando:** la URL pública abre en móvil y se juega el nivel completo.

**Total estimado:** 6 a 7 días de trabajo real. **MVP mínimo mostrable:** etapas 1 a 4 (3–4 días).

---

## 4. Estructura del proyecto

```
build-with-fable/
├── index.html
├── package.json            # phaser, vite, sharp (dev), jsfxr (dev)
├── vite.config.js          # base: '/build-with-fable/' para GitHub Pages
├── docs/
│   ├── PLAN_DESARROLLO.md  # este documento
│   ├── ASSET_PROMPTS.md    # hoja de prompts y guía de estilo para imágenes
│   └── GDD.md              # reglas de juego, misiones, puntaje (se escribe en etapa 5)
├── tools/
│   ├── gen-assets.mjs      # SVG → PNG de todos los sprites y UI
│   ├── gen-level.mjs       # genera levels/equipetrol.json
│   └── gen-sfx.mjs         # jsfxr → wav
├── public/assets/
│   ├── anim/  sprites/  tiles/  ui/  audio/  img/
└── src/
    ├── main.js
    ├── scenes/   Boot, Menu, LevelSelect, Game, HUD, Popup, LevelEnd, Photo
    ├── objects/  Player.js, Criadero.js
    ├── systems/  EliminationFX.js, ScoreManager.js, MissionManager.js, SaveSystem.js, Joystick.js
    ├── data/     palette.js, facts.js, levels.js
    └── levels/   equipetrol.json
```

---

## 5. Fase futura (fuera del MVP)

- Barrio real desde OpenStreetMap con atribución ODbL, redibujado en Tiled.
- Segundo nivel Plan 3000 y tercer nivel Los Lotes.
- Ranking entre estudiantes con Firebase.
- Reto contrarreloj de 3 minutos.
- Más tipos de criadero (canaleta, bebedero de mascotas) y NPCs vecinos con diálogos.

---

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Los assets generados por script se ven "pobres" frente al mockup | La capa 2 (imágenes generadas) reemplaza P2 sin tocar código; el gameplay no depende de ellas |
| La disolución con máscara bitmap no funciona en WebGL de algunos móviles | Fallback: fade + escala si `renderer.type !== WEBGL` |
| Rendimiento en celulares de gama baja | Mapa de 40×30 máximo, partículas limitadas a 30, texturas en un solo atlas |
| Se dispara el alcance | Cada etapa cierra con su criterio de "listo"; nada de la sección 5 entra al MVP |
| Descarga de imagen bloqueada en iOS | Mostrar la imagen en pantalla y pedir captura nativa como alternativa |

---

## 7. Próximo paso inmediato

Etapa 1: crear el proyecto Vite + Phaser, la paleta, el script de generación de assets con el personaje de 4 direcciones y el movimiento. Al cerrarla, se sube una URL de vista previa para validar el estilo antes de dibujar el resto.

---

## 8. Estado de avance

El seguimiento real de cada etapa (qué está hecho, en curso o pendiente, archivos clave,
decisiones y pendientes conocidos) se lleva en [PROGRESO.md](PROGRESO.md). La referencia
técnica de escenas, eventos, formato de nivel y keys de assets está en
[ARQUITECTURA.md](ARQUITECTURA.md).

Resumen al 2026-09-13: etapas 1 a 3 hechas y probadas; etapa 4 (EliminationFX + audio)
hecha a nivel de sistemas; etapas 5 (HUD, misiones, popup, fin de nivel, guardado) y 6
(menú, selección, modo foto) construidas como escenas y en integración con `GameScene`;
etapa 7 (documentación y despliegue en GitHub Pages) en curso.
