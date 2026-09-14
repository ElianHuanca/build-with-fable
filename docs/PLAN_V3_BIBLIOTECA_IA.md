# Dengue Invaders 2D — Plan v3: biblioteca, cámara IA, visibilidad, inglés

Sobre la v2 (agente SEDES, brotes, estación, camioneta, móvil vertical) se agregan seis
frentes. Regla del usuario: **no se sube a GitHub hasta terminar todo**; cada avance se
registra en `docs/PROGRESO.md`.

---

## 1. Qué se construye

### 1.1 Biblioteca de aprendizaje en la estación SEDES
- Al entrar a la estación (acción con E o botón) se abre la **Biblioteca SEDES**: una
  escena tipo "tarjetas de aprendizaje" con pestañas:
  1. **Mosquitos**: fichas de 4 especies con ilustración grande, nombre común y científico,
     cómo reconocerlo (rayas blancas, tamaño, postura, horario), qué transmite, dónde cría.
  2. **Ciclo de vida**: huevo → larva → pupa → adulto, con cuánto dura y dónde cortar el ciclo.
  3. **Síntomas y qué hacer**: fiebre, dolor detrás de los ojos, sarpullido; señales de alarma;
     no automedicarse; ir al centro de salud.
  4. **Prevención**: los tips de limpieza por criadero, descacharrado, repelente, ropa.
  5. **Mitos y verdades**: 6 tarjetas que se voltean (mito al frente, verdad al dorso).
- Mecánica creativa: cada tarjeta leída suma una **insignia** ("Explorador", "Detective de
  larvas", "Guardián del barrio"); se guardan en `localStorage` y se muestran en la
  selección de nivel. Leer 5 tarjetas nuevas da +50 puntos en la siguiente jornada.
- Accesible también desde el menú principal ("Biblioteca") para el que solo quiere leer.

### 1.2 Cámara con IA (demo simulada)
- Botón **Cámara** en el juego (tecla C o botón táctil junto a la lupa). Abre un visor con
  marco, retícula y consejo "Apunta a un mosquito".
- Si hay un brote a menos de 160 px, la foto lo captura; si no, captura una muestra
  aleatoria de mosquito (para la demo siempre hay algo que analizar).
- Animación de "análisis": barrido de escáner, puntos de referencia sobre el mosquito,
  barra de confianza que sube, y resultado: **especie**, confianza (87–98 %), señales
  detectadas ("patas con anillos blancos", "lira en el tórax") y recomendación.
- Es una **simulación** (sin modelo real): la especie sale de los datos del brote o al azar
  con pesos (Aedes aegypti el más frecuente). Se aclara en pantalla con "Demo".
- Cada especie nueva fotografiada se agrega al **álbum** de la biblioteca.

### 1.3 Visibilidad: el HUD no debe tapar la acción
- **Cámara con margen**: los límites de la cámara se amplían para que el jugador nunca
  quede bajo el HUD ni bajo los controles (padding superior 150 px, inferior 250 px en
  vertical táctil).
- **Paneles que se apartan**: si un brote, criadero o el jugador queda en pantalla debajo
  de un panel del HUD (misiones, riesgo, minimapa), ese panel baja su opacidad al 25 %
  y vuelve al soltarse. Además se puede tocar el panel de misiones para plegarlo.
- El cartel de detección y el banner de tips nunca cubren al objetivo: se colocan en el
  lado opuesto de la pantalla al del objetivo.

### 1.4 Más mosquitos y mejor fumigación
- Los enjambres pasan de 3/5/8 a **8/14/22** mosquitos individuales que orbitan y vibran
  (sprites pequeños en un Container), con zumbido proporcional.
- Fumigación: el agente saca el **rociador** (sprite en la mano), un cono de niebla blanca
  avanza hacia el enjambre, los mosquitos se agitan y van cayendo uno a uno girando, con
  gotas y un pulso "FUMIGANDO" en el botón. Desde la camioneta, la niebla sale del tanque
  trasero. Al terminar, "+75" y un brillo verde.

### 1.5 Inglés
- Sistema `i18n` con diccionarios `es` y `en` para toda la interfaz, tips, datos, quiz y
  biblioteca. Idioma inicial según el navegador; selector ES/EN en Configuración y en el
  menú (bandera/etiqueta). Se guarda en `localStorage`.

### 1.6 Documentación continua
- `docs/PROGRESO.md` se actualiza al cerrar cada ola; `docs/GDD.md` y `ARQUITECTURA.md`
  reciben las secciones nuevas (biblioteca, cámara, i18n).

---

## 2. Olas de trabajo

### Ola 1 — funcionalidades (5 agentes en paralelo, archivos disjuntos)
| # | Agente | Archivos | Entregable |
|---|---|---|---|
| A | Biblioteca | `src/scenes/LibraryScene.js`, `src/data/library.js`, `src/systems/Badges.js`, botón en `MenuScene` | Escena de tarjetas, pestañas, mitos que se voltean, insignias |
| B | Cámara IA | `src/scenes/CameraScene.js`, `src/systems/CameraFX.js` | Visor, captura, análisis simulado, resultado, álbum |
| C | Mosquitos y fumigación | `src/objects/Brote.js`, `src/systems/FumigationFX.js` | Enjambres grandes, rociador, niebla, caída |
| D | Visibilidad y enganches | `src/scenes/GameScene.js`, `src/scenes/HUDScene.js`, `src/systems/TouchControls.js`, `InteractionPrompt.js` | Márgenes de cámara, paneles que se apartan, botón cámara, entrada a la biblioteca desde la estación |
| E | Assets v3 | `tools/gen-assets.mjs` | 4 especies de mosquito (grande y pequeño), rociador, ciclo de vida, insignias, íconos cámara/biblioteca/idioma |

### Ola 2 — inglés y QA (4 agentes)
| # | Agente | Entregable |
|---|---|---|
| F | i18n núcleo + escenas de menú/HUD/overlays | `src/i18n/*.js`, reemplazo de textos |
| G | i18n datos (tips, facts, quiz, biblioteca, especies) | Diccionarios completos |
| H | QA vertical + escritorio del flujo completo en ES y EN | Correcciones |
| I | Documentación y bitácora | `PROGRESO.md`, `GDD.md`, `ARQUITECTURA.md`, `README.md` |

### Cierre
- Build, prueba final, commit único por ola en local y **push solo al terminar**.
- Publicar el enlace de demo actualizado.

---

## 3. Contratos comunes
- `src/data/species.js`: catálogo de especies (`id`, `nombre`, `cientifico`, `reconocer`,
  `transmite`, `cria`, `horario`, `frecuencia`, `sprite`), con textos en `{ es, en }`.
- `src/i18n/index.js`: `t(clave, params)`, `getLang()`, `setLang('es'|'en')`, `tx(obj)`
  que devuelve `obj[lang]` para objetos `{ es, en }`; evento `game.events 'lang'`.
- Escenas nuevas: `Library` (`scene.launch('Library', { desde: 'estacion'|'menu' })` →
  emite `library:cerrar`), `Camera` (`scene.launch('Camera', { brote })` → emite
  `camera:cerrar`, `camera:especie` { id }).
