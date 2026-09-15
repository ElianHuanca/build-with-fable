# Dengue Invaders 2D — Plan v4 (propuesta): economía, mundo vivo y ciclo completo del dengue

**Estado: propuesta para discutir, nada de esto está implementado.** Este documento responde a
la pregunta del usuario "¿cómo hacemos el juego más atractivo?" con una idea concreta: en vez de
agregar una mecánica suelta, simular el **ciclo completo real** del dengue en un barrio — la
gente ensucia, el mosquito se reproduce con el tiempo, el Agente SEDES actúa con recursos
limitados, las autoridades reales (SEDES, CENETROP) tienen su rol, y si todo falla hay enfermos
y hospitales saturados. El jugador **ayuda** a las autoridades; no las reemplaza.

Antes de tocar código, dos preguntas para el usuario en la sección 7.

**Estado de implementación (2026-09-15):** el usuario priorizó "mundo vivo + ciclo día/noche"
(§2+§3) como punto de partida. Se implementó la primera mitad, §3 (ciclo día/noche →
especie del brote), sin commitear todavía: ver la sección 3 más abajo, marcada **Hecho**.
§2 (basura que ensucian los NPCs y madura en criadero) sigue pendiente, es la continuación
natural de este mismo sprint.

---

## 0. Lo que ya existe y no hay que reinventar

El juego ya tiene piezas que esta propuesta simplemente **conecta mejor**, no reemplaza:

- `species.js` ya tiene `horario` por especie ("Mañana temprano y atardecer", "Noche", etc.) que
  **hoy no afecta el gameplay** — es solo texto educativo. Es la base perfecta para un ciclo
  día/noche real (§3).
- `OutbreakManager`/`EpidemicMeter`/`Brote` ya simulan aparición y crecimiento de brotes — la
  propuesta los extiende con una **causa** (basura acumulada) en vez de aparición puramente
  aleatoria (§2).
- La estación SEDES y la camioneta ya existen — la propuesta les da más funciones (§1, §4) en
  vez de crear edificios nuevos.
- `CameraScene` (cámara IA demo) ya "identifica especie" — la propuesta la conecta a una
  narrativa de reporte a CENETROP en vez de terminar en una tarjeta aislada (§5).
- `ScoreManager`/puntos ya existen — la propuesta los convierte en una **moneda gastable**, no
  solo un marcador (§1).

---

## 1. Investigación: qué hacen SEDES y CENETROP de verdad (Santa Cruz, Bolivia)

Fuentes consultadas (2026-09-15), a verificar/actualizar con SEDES antes de uso público —
mismo criterio que ya aplica `ATTRIBUTION.md` a todo el contenido educativo del juego:

- **SEDES Santa Cruz** (Servicio Departamental de Salud) coordina el **Programa Dengue, Zika y
  Chikungunya**: brigadas departamentales y municipales que van casa por casa a identificar y
  eliminar criaderos, fumigar espacios públicos y educar a la población. En operativos grandes
  ("Escudos contra el Dengue") moviliza miles de personas (personal de salud, Fuerzas Armadas,
  Policía, voluntarios) y llega a decenas de miles de viviendas. [Ministerio de Salud — Escudo
  contra el Dengue](https://minsalud.gob.bo/7326-santa-cruz-mas-de-5-000-personas-entre-profesionales-en-salud-y-ffaa-recorren-barrios-en-escudo-de-lucha-contra-el-dengue),
  [El Deber — brigadas SEDES](https://eldeber.com.bo/santa-cruz/sedes-intensifica-campana-para-prevenir-el-dengue-con-brigadas-que-orientan-a-los-ciudadanos_353580/).
- **CENETROP** (Centro Nacional de Enfermedades Tropicales, con sede en Santa Cruz) es el
  **laboratorio de referencia nacional**: todos los casos sospechosos/confirmados de dengue se
  reportan y confirman ahí, y desde 2023 hace **secuenciación genómica** para saber qué
  variantes del virus circulan — no hace fumigación de campo, su rol es diagnóstico y
  vigilancia epidemiológica. [OPS/OMS — CENETROP 51 años](https://www.paho.org/es/noticias/1-8-2025-cenetrop-aliado-estrategico-opsoms-cumplio-51-anos-vigilancia-control),
  [Ministerio de Salud — secuenciador genómico](https://minsalud.gob.bo/7349-gobierno-nacional-implementa-secuenciador-genomico-en-cenetrop-santa-cruz-en-su-lucha-para-vencer-el-dengue).

**Cómo se traduce esto al juego** (rol claro para cada institución, sin inventarles funciones
que no tienen):

| Institución real | Rol real | Rol en el juego |
|---|---|---|
| SEDES | Coordina brigadas de campo: descacharrado, fumigación, educación | Ya es la estación del jugador; en v4 además **paga** al Agente por su trabajo y **presta refuerzos** (cuadrilla) cuando el jugador está saturado |
| CENETROP | Confirma la especie/el virus en laboratorio, vigilancia genómica | Recibe los **reportes del explorador** (fotos con la cámara IA): cada especie nueva reportada "confirma" un foco en el mapa departamental (meta-progreso entre niveles) |
| Municipio / Gobernación (mencionados en los operativos reales) | Recursos, personal, ambulancias | Fuente narrativa de por qué a veces "no alcanzan los carros" — justifica la mecánica de saturación (§4) sin culpar a una autoridad específica de negligencia |
| Hospitales | Atienden a los enfermos | Nuevo edificio en el mapa (§6), con capacidad limitada |

El jugador (el "Agente SEDES", posible nombre alternativo más propio: **"Agente Anti-Dengue"** o
"Brigadista", a decidir) es un **trabajador de campo que colabora con SEDES** — no un
funcionario con autoridad, ni un vigilante solitario. Esto importa para el tono: el juego debe
transmitir "un vecino puede ayudar mucho, pero el sistema de salud es de todos", no "las
autoridades son inútiles y el héroe las reemplaza". Mantener esto es importante para no dañar
la reputación de instituciones reales que están detrás del proyecto.

---

## 2. Mundo vivo: gente que ensucia, basura que envejece, criaderos que nacen solos · Hecho (2026-09-15)

Hoy los criaderos son fijos (colocados por `tools/gen-level.mjs`) y los brotes aparecen al azar
por tiempo. La propuesta agrega una **causa visible**:

- **Vecinos NPC** caminan por rutas fijas simples (ir de una casa a la calle y volver, como ya
  hace el patrón de patrulla que no existe aún — sería nuevo) y cada tanto "botan" un objeto
  (bolsa, botella, llanta) en la vereda o el patio — una animación corta y una textura nueva de
  "basura fresca" (`gen-assets.mjs`).
- La basura tiene un **reloj de maduración** (igual patrón que `Brote` con sus 3 niveles a 20s/
  40s): fresca → acumulada (días simulados) → **criadero activo** si nadie la recoge. El
  jugador puede recogerla en cualquier momento del reloj (acción rápida, sin fumigar) para
  cortarla antes de que críe mosquitos — refuerza el mensaje real de "descacharrado" que ya está
  en `LIBRARY_TABS.prevencion`.
- Esto convierte la limpieza de la ciudad en una **tarea continua de mantenimiento**, no solo
  una lista fija de 5 criaderos — más parecido a cómo describe el usuario "la vida real".
- **Alcance para no descontrolar el rendimiento**: límite duro de basura simultánea en el mapa
  (p. ej. 12), igual que `Brote` ya limita mosquitos individuales a 70 — nunca dejar que la
  simulación crezca sin techo.

**Qué se construyó** (sin commitear al 2026-09-15; implementado con 2 agentes en paralelo sobre
archivos disjuntos, integrados a mano en `GameScene.js`):
- `src/objects/Basura.js` (nuevo): objeto `fresca → acumulada (30s) → criadero (30s más)`, con
  `recoger()` en cualquier momento (emite `'recogida'`, `{tarde}` si ya era criadero) y `'maduro'`
  una sola vez al llegar a criadero sin recoger. Usa las 9 texturas reales `basura_<tipo>_
  <estado>` (`tools/gen-assets.mjs` → `buildBasura()`, agregado después a pedido del usuario —
  ver más abajo) con el mismo dibujo generado en tiempo de ejecución que antes como respaldo,
  igual patrón que `Criadero`/`Brote`.
- `src/systems/Vecinos.js` (nuevo): manager de 4 NPCs decorativos (`Phaser.GameObjects.Container`)
  que caminan entre puntos frente a las casas del nivel y cada 15-30s "botan" algo vía el
  callback `onBotar(x,y)` — no conoce `Basura`, GameScene conecta ambas piezas. Usan el sprite
  real `vecino_N` (`tools/gen-assets.mjs` → `vecinoSVG`, mismo lenguaje visual que el personaje
  principal — piel, línea de contorno, proporciones — pero sin gorra/chaleco/mochila, con 5
  colores de remera para variedad), con el dibujo simple original como respaldo si la textura no
  cargó. Se agregó tras el primer pase, a pedido del usuario ("¿por qué las personitas no tienen
  el mismo diseño que el personaje principal?").
- **Animación de caminata** (a pedido del usuario, "el personaje principal gira a distintas
  direcciones, tiene efecto al caminar... los vecinos no se mueven así"): el primer pase de
  vecinos era una sola textura estática volteada en X. Se extendió `vecinoSVG(colorRopa, dir,
  frame)` a 2 direcciones (`down` de frente, `up` de espaldas) × 4 cuadros (mismo esquema
  `[1,2,3,2]` a 8 fps que usa el jugador), 40 sprites en total (5 colores × 2 × 4).
  `BootScene.create()` arma las animaciones `vecino_<n>_walk_<dir>`/`idle_<dir>` igual que ya
  hace con `walk_<dir>`/`idle_<dir>` del jugador. `Vecinos.js` ahora usa un `Sprite` animado en
  vez de una `Image` estática: decide `down` vs. `up` comparando cuánto del paso es vertical
  (igual criterio que `Player.move()`), y sigue volteando en X para izquierda/derecha (no hay
  arte de perfil, mismo criterio simplificado que ya tenía). Sin sonido de pasos — 4 vecinos a
  la vez sonando sería ruidoso; solo el jugador tiene ese efecto.
- **Auditoría de estilo** (a pedido del usuario, "¿todos los assets nuevos siguen el diseño de
  los oficiales?"): se revisó cada asset nuevo de esta sesión contra `docs/ASSET_PROMPTS.md` y
  el resto de `tools/gen-assets.mjs`. `vecino_N` ya seguía el estilo (pipeline SVG→`sharp`
  oficial). Las **fotos reales de la Biblioteca no siguen el estilo a propósito** (son
  fotografías, no arte vectorial — ver `ATTRIBUTION.md` y `wiki/decision/fuentes-fotos-mosquitos.md`
  del vault). Las **9 texturas de basura sí eran una inconsistencia real**: el primer pase nunca les generó
  un PNG por el pipeline oficial, así que siempre usaban el dibujo `RenderTexture` en tiempo de
  ejecución de `Basura.js` (pensado como respaldo de emergencia, no como arte final) — se veía
  borroso/pixelado comparado con el resto. Se agregó `buildBasura()` con el mismo lenguaje
  visual que `CRIADEROS` (sombra elíptica, contorno `O`, highlight) y `Basura.js` las usa sin
  ningún cambio de código (`textureFor()` ya prefería la textura real si existía).
- `GameScene.js`: `vecinoBotoBasura()` crea la `Basura` y escucha sus eventos — `'maduro'` crea
  un brote real ahí (`outbreakManager.spawn({x,y})`, con la especie ya elegida por horario del
  §3) y destruye la basura; `'recogida'` suma 20 puntos (10 si fue tarde). `recogerBasura()`,
  `actualizarDeteccion()` (basura es la 3ª prioridad de interacción: criadero > brote > basura >
  estación, radio 70px) y `intentarLimpiar()`/`accionInicio()` conectan la basura al mismo
  cartel/botón de acción que ya usan criaderos y brotes. `InteractionPrompt.js` suma el modo
  `'basura'` ("Basura en la calle" / "Recoger") con sus claves de i18n en `juego.js` (ES/EN).
- Extra del mismo hilo: `CameraScene.js` ahora usa `especieSegunHorario()` (no solo
  `especieAleatoria()`) en la demo sin brote cercano, recibiendo `fraccionDia` desde
  `GameScene.abrirCamara()` — cierra la inconsistencia menor anotada en la sección 3.
- Extra del mismo hilo: `LevelSelectScene.js` — el overlap de "Volver"/"Jugar" en horizontal
  angosto (ver `wiki/backlog/pendientes.md` del vault) se debía a que el escalado de las
  tarjetas solo consideraba el ancho disponible, no el alto; ahora también topa por `availH`.

**Verificado en el navegador** (no solo lectura de código): un vecino botó basura real durante
el juego corriendo, la basura maduró sola y generó un brote real en su misma posición (con la
basura destruyéndose); se creó una basura sintética, se detectó correctamente como prioridad
más baja (con el cartel mostrando "Basura en la calle"/"Recoger"), se recogió con
`intentarLimpiar()` y sumó 20 puntos, sacándose de la lista. `LevelSelectScene` verificado en
640×320: "Volver" y "Jugar" ya no se superponen. Sin errores nuevos de consola.

**Pendiente de este mismo hilo:** no se encontró ninguna foto de *Anopheles darlingi* con
licencia verificable (Wikimedia, CDC, GBIF, iNaturalist revisados) — la ficha sigue usando
*A. albimanus* como respaldo documentado en `ATTRIBUTION.md`. La economía (§1/§4, pagar por
fumigar/recoger, tienda, cuadrilla contratada) y los hospitales/reputación (§6) siguen sin
implementar — son la continuación natural una vez que el "mundo vivo" ya está funcionando.

---

## 3. Ciclo día/noche conectado a las especies (usa datos que ya existen) · Hecho (2026-09-15)

`species.js.horario` ya dice, por especie, cuándo pica cada mosquito. Propuesta: un reloj de
jornada con franjas (mañana / mediodía / tarde / noche) que determina **qué especie es más
probable** en cada franja, reemplazando el `especieAleatoria()` puramente estadístico:

- Mañana temprano / atardecer → más *Aedes aegypti* y *albopictus* (como dice su ficha).
- Noche → más *Culex*.
- Anochecer/madrugada → *Anopheles* (zonas con vegetación/agua natural del mapa).

Efecto en el jugador: aprende **jugando** (no solo leyendo la Biblioteca) que cada mosquito
tiene su horario — es contenido educativo convertido en mecánica, que es exactamente lo que ya
funciona bien en la dinámica de las llantas/criaderos que el usuario menciona que le gustó.

**Qué se construyó** (sin commitear al 2026-09-15):
- `src/data/species.js`: `FRANJAS_DIA` (5 franjas: mañana, mediodía, tarde, noche, madrugada,
  cada una con un multiplicador de `frecuencia` por especie, alineado a su `horario` real),
  `franjaActual(fraccionDia)` y `especieSegunHorario(fraccionDia, rnd)` (reemplaza a
  `especieAleatoria()` para brotes, que sigue existiendo para el fallback de la cámara IA sin
  brote cercano).
- `src/systems/OutbreakManager.js`: nueva opción `jornadaMs`; `update()` calcula
  `this.fraccionDia`/`this.franja` y dispara `.onFranjaChange(cb)` cuando cambia de franja
  (nunca en la primera detección, para no avisar apenas arranca la jornada); `spawn()` usa
  `especieSegunHorario(this.fraccionDia)` en vez de dejar que `Brote` elija al azar.
- `src/data/tips.js`: 5 tips nuevos (`horario_manana`...`horario_madrugada`, ES/EN) que
  explican qué mosquito es más probable en la franja que empieza.
- `src/scenes/GameScene.js`: pasa `jornadaMs: JORNADA_SEG * 1000` al `OutbreakManager` y
  muestra el tip correspondiente (`mostrarTip('horario_' + franja.id)`) en el HUD al cambiar de
  franja.

**Verificado** (en el navegador, forzando `fraccionDia` y `tiempoInicio` desde la consola, no
solo leyendo el código): distribución de especie por franja con 200 brotes de prueba cada una
(mañana 78% aegypti, mediodía aegypti≈albopictus, atardecer 82% aegypti, noche 61% culex,
madrugada culex+anopheles ≈ 84% combinado); el tip de HUD se dispara con el texto correcto al
simular un salto de franja y no se dispara espurio al iniciar la jornada. Sin errores nuevos de
consola.

**Pendiente de este mismo hilo:** la demo de cámara IA (`CameraScene.js`) sigue usando
`especieAleatoria()` sin ponderar por horario cuando no hay un brote cerca — inconsistencia
menor, no se tocó para no ampliar el alcance de este sprint (ver `wiki/backlog/pendientes.md`
del vault).

### Bug crítico corregido (2026-09-15): brotes sin tope real → parpadeo y colgado

El usuario reportó que el juego se sentía con parpadeos en las calles y terminó colgándose del
todo. Causa real: `vecinoBotoBasura()` (§2, arriba) creaba el brote de una basura madura
llamando **directo** a `outbreakManager.spawn({x,y})`, sin pasar por `OutbreakManager.update()`
— que es el único lugar que respeta `MAX_ACTIVOS = 3`. Con 4 vecinos botando basura cada
15-30s, en una partida larga se podían acumular muchos más de 3 brotes simultáneos (cada uno
con hasta 22 mosquitos animando su órbita cada frame), saturando el render hasta el colgado.

Fix: `OutbreakManager.js` exporta `MAX_ACTIVOS`; `vecinoBotoBasura()` solo llama `spawn()` si
`outbreakManager.activos.length < MAX_ACTIVOS` — si ya está al tope, la basura madura se
destruye igual pero sin generar un brote nuevo, en vez de acumularse sin límite. Verificado en
el navegador: con 3 brotes forzados al tope, 60 basuras madurando de golpe nunca hicieron subir
`activos.length` de 3. Sin errores de consola tras el stress test.

**Lección para el harness**: cuando un evento nuevo dispara una acción de otro sistema que ya
tenía sus propios límites de recursos (acá, `Brote`/`OutbreakManager`), hay que revisar si esos
límites siguen aplicando cuando se llama al método directamente en vez de por el camino
automático original — un tope que solo se chequea en un lugar es fácil de saltarse sin darse
cuenta al conectar sistemas nuevos.

### Incidente (2026-09-15): un agente en paralelo revirtió trabajo real con `git checkout`

Al pedirle a 3 agentes en paralelo mejorar la camioneta, el hospital y los vecinos, se les
instruyó "después de `npm run gen:assets`, revertí con `git checkout --` cualquier archivo que
no sea el tuyo, para no dejar ruido de regeneración". Uno de los agentes interpretó eso de forma
demasiado amplia y revirtió con `git checkout --` **13 archivos con trabajo real sin commitear**
de la misma sesión (el fix de controles táctiles, el ciclo día/noche completo, las fotos de la
Biblioteca, toda la integración de vecinos/basura en `GameScene.js`, etc.) — no eran ruido de
`gen:assets`, eran cambios legítimos de horas antes que el agente no reconoció como "esperados".
Como nunca se habían commiteado, `git checkout` los descartó sin ninguna forma de recuperarlos
por git (no hay commit ni stash de por medio).

Se reconstruyeron los 13 archivos a mano, releyendo la transcripción de la sesión (cada edición
había quedado registrada ahí) y verificando con `node --check` + pruebas reales en el navegador
que todo quedó igual que antes, incluido un segundo stress test del bug de arriba.

**Regla para el futuro**: nunca darle a un agente en paralelo una instrucción de `git checkout`
sobre "cualquier archivo que no reconozca" — solo debe poder revertir la lista exacta y cerrada
de archivos que **él mismo** sabe que `gen:assets` toca de más (los 6-7 ya identificados:
`player.json`, `tileset.json`, `logo.png`, `estacion.png`, `icon_lang.png`, `key_e.png`), nunca
un patrón abierto tipo "todo lo demás". Mejor todavía: hacer ese `git checkout` de limpieza en
el proceso principal (que sí conoce el estado completo de la sesión), no delegarlo a un agente
que solo ve una porción del trabajo en curso.

---

## 4. Economía del Agente: pago, tienda, y qué pasa cuando ya no alcanza solo

### 4.1 Moneda

Nueva moneda **"Bs" (bolivianos) del Agente**, separada de los puntos/estrellas de la jornada
(que siguen midiendo desempeño para las 3 estrellas de v1-v3). Se gana por: limpiar un
criadero, fumigar un brote, recoger basura antes de que críe, y un **bono de SEDES** al cerrar
la jornada según el % de barrio protegido (así SEDES literalmente "le paga" al jugador,
respondiendo directo al pedido del usuario).

### 4.2 Tienda (en la estación SEDES, junto a la Biblioteca)

Mejoras compradas con Bs, todas con tope para no romper el balance:

- **Repelente/mochila mejor** → radio de detección de criaderos +X%.
- **Tanque de fumigación más grande** → menos recargas necesarias en la jornada.
- **Bicicleta o moto** (entre caminar y la camioneta) → más rápido que a pie sin necesitar
  volver a la estación por el vehículo grande.
- **Contratar un ayudante** (ver 4.3).

### 4.3 Cuadrilla: qué pasa cuando el jugador "ya no puede"

Responde directo a la pregunta del usuario ("¿qué sucede cuando ya no puede? ¿va con camión, va
caminando, contrata?"). Regla propuesta, con 3 niveles de refuerzo según cuán saturado esté el
jugador (brotes activos simultáneos por encima de un umbral):

1. **A pie**: el modo por defecto, radio de acción chico, para criaderos y brotes cercanos.
2. **Camioneta** (ya existe): el jugador decide subir cuando tiene que cruzar el mapa rápido o
   cuando fumiga "rápido" (ya existe `rapido: true` en `FumigationFX`) — no cambia, solo se
   documenta la regla de cuándo conviene: 2+ brotes activos en zonas distintas.
3. **Cuadrilla contratada** (nuevo, con Bs): si el número de brotes activos supera lo que el
   jugador puede cubrir en el tiempo que queda de jornada, aparece un aviso de SEDES ofreciendo
   mandar **1-2 brigadistas NPC** por un costo en Bs — se mueven solos hacia el brote más
   cercano y lo fumigan más lento que el jugador, pero sin que el jugador tenga que estar ahí.
   Esto es la traducción directa de "cuando SEDES no da abasto con su propio personal, un civil
   organizado puede pedir/pagar refuerzo" — y enseña que los recursos son limitados incluso para
   las autoridades, sin culparlas.

---

## 5. El explorador: identificar, reportar a CENETROP, avisar a las autoridades

La cámara IA ya "identifica" una especie con confianza simulada. Propuesta para darle
propósito narrativo real (conectado a lo que CENETROP hace de verdad: confirmar y llevar
registro, no fumigar):

- Cada foto nueva de una especie **nunca antes reportada en esa jornada** dispara un mini-evento:
  "Reporte enviado a CENETROP" con un sello/animación simple, y suma a un contador departamental
  visible en `LevelSelectScene` o en un nuevo panel ("focos confirmados esta semana").
- Reportar las 4 especies en una sola jornada podría desbloquear una **insignia nueva** o un dato
  extra de la Biblioteca (encaja con el sistema de insignias que ya existe en `Badges.js`).
- Mantiene la etiqueta "DEMO" existente — sigue sin ser un modelo real de visión, solo cambia
  qué hace la app con el resultado.

---

## 6. Enfermos, hospitales y la "reputación" del barrio

Pieza que hoy no existe: consecuencia humana visible de la epidemia, más allá del número
`EpidemicMeter`.

- **Vecinos NPC que se enferman**: cuando `EpidemicMeter` supera un umbral (ya existe el umbral
  de 60% para las estrellas), algún NPC cercano a un brote activo puede "enfermarse" (animación
  simple: se sienta, ícono de fiebre) y necesitar traslado.
- **Hospital**: nuevo edificio fijo en el mapa (mismo patrón que `Estacion.js`: textura o
  fallback dibujado, sin cuerpo físico de colisión). Tiene una **capacidad** visible (ej. 6
  camas); un NPC enfermo "camina" o es "trasladado" (ambulancia simple, reusa el sprite de
  vehículo con otro tinte) hacia el hospital.
- **Saturación como consecuencia, no como micromecánica nueva para el jugador**: si el hospital
  llega a su capacidad, no es algo que el jugador arregle directamente (el jugador no es
  paramédico) — es una **barra de "reputación del barrio"** que baja, afecta las estrellas
  finales y aparece en el resumen de `LevelEndScene" ("el hospital de tu zona llegó al límite
  esta semana"). Esto cierra el ciclo que pide el usuario (criadero → brote → epidemia → enfermos
  → hospital → reputación) sin convertir el juego en un simulador hospitalario aparte.
- Mensaje educativo directo: "por eso prevenir es más barato que curar" — encaja con el tono
  de `docs/GDD.md` y `LIBRARY_TABS.sintomas`.

---

## 7. Progresión por niveles (rediseño sugerido)

Hoy solo existe "Equipetrol" jugable y "Plan 3000" bloqueado con el mismo tipo de jornada.
Propuesta: usar los niveles para **introducir sistemas gradualmente**, no repetir la misma
jornada con más brotes — así los niños no reciben todo junto y cada nivel enseña algo nuevo,
como pidió el usuario ("nivel 1, nivel 2, nivel 3").

| Nivel | Qué se introduce | Objetivo de aprendizaje |
|---|---|---|
| 1 — Equipetrol (ya existe) | Loop base: criaderos, fumigar, Biblioteca | Reconocer criaderos y mosquitos |
| 2 — nuevo o Plan 3000 | Economía (Bs, tienda básica) + basura/NPCs que ensucian | La prevención es constante, no una sola limpieza |
| 3 — nuevo | Ciclo día/noche + explorador/CENETROP | Cada mosquito tiene su horario y su rol distinto |
| 4 — nuevo | Saturación, cuadrilla contratada, hospital/reputación | Los recursos son limitados; prevenir cuesta menos que curar |

Cada nivel nuevo reutiliza el mismo tilemap/generador (`tools/gen-level.mjs`) con parámetros
distintos, no arte nuevo desde cero.

---

## 8. Enganche fuera del juego: que los niños lo lleven a la casa y al colegio

Pedido explícito del usuario. Sin necesidad de redes sociales ni nada que requiera moderación:

- Al cerrar una jornada con buen resultado, `LevelEndScene` ya tiene botón de Foto/compartir
  (`PhotoScene`, Web Share API) — extenderlo con una **tarjeta "Reto familiar"**: 3 acciones
  reales para hacer en casa esa semana (volcar baldes, tapar tanques, revisar floreros), con un
  espacio para marcarlas como hechas la próxima vez que se abre el juego (mismo patrón de
  `SaveSystem`, sin cuentas ni backend).
- Insignia especial "Guardián en casa" si el jugador vuelve y marca el reto como cumplido.
- Nada de esto reemplaza la recomendación ya existente en `ATTRIBUTION.md` de validar todo el
  contenido con SEDES antes de uso público — los "retos familiares" en particular deberían
  salir de las recomendaciones oficiales reales, no inventarse.

---

## 9. Riesgos y qué NO hacer todavía

- No implementar todo el plan de una sola vez — es demasiado para un sprint y rompe el patrón
  de "una feature verificable por vez" del proyecto (ver el vault `build-with-fable-obsidian`,
  `AGENTS.md`).
- No convertir el juego en un city-builder/economía compleja — el público es de 10 a 14 años;
  cada sistema nuevo debe poder explicarse en una frase.
- Los NPCs caminando + basura + enfermos son la pieza de mayor riesgo técnico (IA simple de
  patrulla, más entidades en pantalla) — vale la pena prototipar aparte antes de comprometerse
  a todo el diseño.
- Todo el contenido nuevo relacionado a instituciones reales (SEDES, CENETROP, hospitales)
  necesita el mismo aviso de revisión que ya tiene el resto: esto es un prototipo educativo, no
  una fuente oficial.

---

## Preguntas para decidir antes de empezar a implementar

1. **¿Por dónde empezamos?** Sugerencia: §2+§3 (basura que madura + ciclo día/noche) primero,
   porque reutilizan sistemas que ya existen (`Brote`, `species.horario`) y dan la sensación de
   "mundo vivo" más rápido que la economía completa. La economía (§1/§4) y hospitales (§6) son
   más trabajo y dependen de tener el mundo vivo primero (¿de qué sirve pagar por fumigar si
   los brotes siguen apareciendo solo al azar?).
2. **¿Nivel nuevo o reciclar Plan 3000?** Plan 3000 ya existe como concepto (bloqueado, con
   thumbnail) — ¿lo usamos para el nivel 2 de esta progresión, o se deja para más adelante y se
   crean niveles nuevos dedicados a la economía/mundo vivo?
