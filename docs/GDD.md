# GDD — Dengue Invaders 2D: Agente SEDES (v2 + v3)

Documento de diseño de juego: las reglas de la jornada tal como quedaron implementadas en el
código (no el plan original). Parte de [PLAN_V2_JUGABILIDAD.md](PLAN_V2_JUGABILIDAD.md) y
[PLAN_V3_BIBLIOTECA_IA.md](PLAN_V3_BIBLIOTECA_IA.md), pero ajusta números y detalles a lo que el
juego realmente hace hoy; los contratos técnicos (eventos, registry, constantes) están en
[ARQUITECTURA.md](ARQUITECTURA.md) secciones 2.6 (v2) y 2.7 (v3), y el estado de cada pieza en
[PROGRESO.md](PROGRESO.md). Las secciones 1–10 describen la jornada v2; las 11–15, lo que suma la v3
(Biblioteca SEDES, cámara IA, enjambres, visibilidad e idiomas).

## 1. Fantasía y rol

El jugador es un **agente del SEDES** (Servicio Departamental de Salud): chaleco naranja con logo,
gorra azul y mochila fumigadora. Tiene una **estación** en el barrio (edificio con garaje) donde
empieza la jornada y a la que puede volver en cualquier momento. Junto a la estación espera una
**camioneta de fumigación**: subirse duplica la velocidad de movimiento y reduce el tiempo de
fumigar un brote de 2,5 s a 1,5 s. A pie, el agente puede entrar a los patios a limpiar criaderos;
la camioneta no entra a los patios, solo acompaña por las calles.

## 2. La jornada

Un nivel es una **jornada de 240 segundos (4 minutos)**, contados en cuenta regresiva desde que
empieza la partida. La jornada tiene **doble objetivo**, sin que uno excluya al otro:

- **Limpiar los 5 criaderos** del barrio (como en el v1): acercarse y presionar `E` / tocar el
  botón de acción durante la animación de vaciado (~3,3 s).
- **Fumigar los brotes** que van apareciendo con el tiempo, antes de que crezcan demasiado.

La jornada termina en el primero de estos tres casos:

1. **El tiempo llega a 0** sin haber limpiado todo → resultado `'tiempo'`.
2. **El medidor de epidemia llega a 100** → resultado `'epidemia'` (fin anticipado, no hace falta
   que se acabe el reloj).
3. **Se limpian los 5 criaderos** antes de que pase cualquiera de los dos anteriores → resultado
   `'completo'`.

Los brotes fumigados no forman parte de la condición de "completo": se puede terminar la jornada
con todos los criaderos limpios aunque queden brotes activos en el mapa (bajan el medidor de
epidemia mientras existen, pero no bloquean el resultado `'completo'`).

## 3. Brotes de mosquitos

Cada **25 a 40 segundos** (al azar) aparece un nuevo brote en el barrio. El 70 % de las veces
aparece cerca (80–160 px, poco más de un tile) de un criadero que sigue sucio; el 30 % restante,
en un punto al azar del mapa. Al aparecer suena una alerta y un banner en la parte superior avisa
en qué zona está ("¡Brote en Manzana 3! Fumígalo antes de que crezca."); la primera vez de la
partida ese mismo aviso incluye además una frase corta explicando qué hacer.

Un brote tiene 3 niveles, y crece solo mientras nadie lo fumiga:

| Nivel | Aparece | Sube el medidor de epidemia | Puntos al fumigarlo |
|---|---|---|---|
| Pequeño | al nacer | 0,4 / segundo | 75 |
| Medio | 20 s después de nacer | 0,8 / segundo | 90 |
| Grande | 40 s después de llegar a medio (60 s desde que nació) | 1,5 / segundo | 100 |

**Fumigar** un brote: acercarse (radio de detección 90 px, el mismo cartel/botón de acción que los
criaderos, con prioridad para el criadero si ambos están en rango) y presionar `E` / tocar el
botón. En la v2 era un solo toque; desde la v3 con `E`/ACCIÓN hay que **mantener presionado** y
soltar cancela (ver §13). La fumigación dura 2,5 s a pie o 1,5 s subido a la camioneta (×1,5 si el
brote es grande): el rociador lanza un cono de niebla y los mosquitos van cayendo, y el jugador
queda bloqueado hasta que termina. Al terminar: suma los puntos de la tabla de arriba,
baja el medidor de epidemia y muestra un consejo corto (por ejemplo, que la fumigación no mata las
larvas, solo al mosquito adulto).

## 4. Medidor de epidemia

Barra roja/amarilla en el HUD ("Riesgo de epidemia"), de 0 a 100, que empieza en 0 en cada
jornada:

- **Sube** cada segundo según los brotes activos en ese momento (tabla de arriba: 0,4 / 0,8 / 1,5
  por brote y por segundo, según su nivel) y un poco más por cada criadero que sigue sucio
  (0,05 por segundo por criadero).
- **Baja de golpe** al fumigar un brote (8 / 12 / 18 puntos según era pequeño, medio o grande) o
  al limpiar un criadero (3 puntos).
- **A partir de 60**: el HUD avisa "¡El barrio está en riesgo!" y la barra pulsa; a partir de ese
  momento la jornada ya no puede terminar con 3 estrellas ni con 2, aunque el medidor vuelva a
  bajar de 60 después (ver estrellas, más abajo — el umbral se recuerda para toda la jornada).
- **Al llegar a 100**: la jornada termina de inmediato con el resultado `'epidemia'`.

## 5. Estación y camioneta

La estación es el punto de partida del agente y donde vuelve a buscar la camioneta. Cerca de la
estación (o de la propia camioneta si quedó estacionada en otro lado), la tecla `V` o el botón
VEHÍCULO suben o bajan al agente:

- **Subido**: la velocidad de movimiento se duplica y la fumigación de brotes pasa de 2,5 s a 1,5 s.
- **Bajado**: velocidad normal, puede entrar a los patios a limpiar criaderos (la camioneta no).

La primera vez que el agente vuelve a la estación tras haber salido de ella, un consejo corto
recuerda que la estación es la base de operaciones y que conviene reportar los casos de fiebre
alta al centro de salud.

## 6. Puntaje

| Acción | Puntos |
|---|---|
| Criadero limpiado | +50 |
| Combo (siguiente criadero limpiado antes de 20 s del anterior) | +25 extra |
| Brote pequeño fumigado | +75 |
| Brote medio fumigado | +90 |
| Brote grande fumigado | +100 |
| Pregunta de opción múltiple respondida bien (al terminar la jornada) | +100 |

El bonus de la pregunta final es solo visual en la pantalla de resumen: no se guarda como parte
del puntaje de `SaveSystem` ni afecta el registry del HUD, a diferencia de todo lo anterior.

## 7. Estrellas

Se calculan al terminar la jornada, sin importar cuánto haya durado:

- **0 estrellas**: la jornada terminó en `'epidemia'` (el medidor llegó a 100). No importa cuánto
  se haya limpiado.
- **1 estrella**: la jornada terminó (por tiempo o completa) sin llegar a la epidemia.
- **2 estrellas**: además de lo anterior, el medidor de epidemia **nunca llegó a 60** en toda la
  jornada.
- **3 estrellas**: además de las 2 anteriores, **se limpiaron los 5 criaderos**.

## 8. Los 3 resultados de una jornada

La pantalla de fin de jornada cambia según cómo terminó:

- **`'completo'`** — "¡Barrio protegido!": cinta azul, sin mensaje adicional (solo el bocadillo
  normal según las estrellas obtenidas).
- **`'tiempo'`** — "Se acabó el tiempo": cinta amarilla, mensaje explicando que el reloj llegó a
  cero antes de terminar.
- **`'epidemia'`** — "Se declaró una epidemia": cinta roja/teja, mensaje de concientización
  explicando que faltó fumigar brotes o limpiar criaderos a tiempo. No es un "game over": la
  pantalla igual muestra los puntos ganados, lo que se aprendió y la pregunta final.

En los tres casos, la pantalla de resumen muestra 3 datos educativos al azar ("Aprendiste hoy") y
una pregunta de opción múltiple con su explicación, gane o pierda el jugador la partida.

## 9. Aprender jugando

Cada acción relevante muestra un mensaje corto (2–5 s) en el HUD, tomado al azar de
`src/data/tips.js`: al fumigar un brote, al volver a la estación, y (combinado con el primer aviso
de brote de la partida) una explicación de qué hacer. El popup educativo de criaderos del v1 se
mantiene sin cambios (tarjeta con dato, consejo y fuente al limpiar cada criadero, pausando el
juego). Al terminar la jornada, el resumen agrega los 3 datos al azar y 1 pregunta de
`src/data/quiz.js` (8 preguntas disponibles) con su explicación, gane o pierda la jornada.

## 10. Diferencias con el plan original

Para no repetir aquí lo que ya está detallado en `docs/PROGRESO.md` (v2 · Ola 2): el tip de la
estación se muestra como dato del HUD y no como popup modal, y las misiones del HUD siguen siendo
las 4 del v1 — no hay ninguna misión nueva de brotes, estación o camioneta pese a que el plan la
mencionaba. La regla "fumigar es un solo toque" de la v2 cambió en la v3: ver §13.

---

## 11. Biblioteca SEDES (v3)

La **estación** deja de ser solo el garaje de la camioneta: al acercarse y presionar `E` / el botón
ACCIÓN (el cartel de detección cambia a modo "estación") se abre la **Biblioteca SEDES**, una
pantalla de tarjetas de aprendizaje que pausa la jornada (física detenida, HUD y controles
ocultos, el reloj no avanza) y la reanuda al cerrar con `Esc` o el botón Volver. También está
disponible desde el **menú principal** ("Biblioteca") para quien solo quiere leer, sin jornada.

**Pestañas** (una fila de botones con ícono; se cambian tocando o con las flechas del carrusel):

| Pestaña | Tarjetas | Qué enseña |
|---|---|---|
| Mosquitos | 4 fichas de especie | Ilustración grande, nombre común y científico, chips "cómo reconocerlo", qué transmite, dónde cría, a qué hora pica y un dato curioso |
| Ciclo de vida | 4 (huevo, larva, pupa, adulto) | Cuánto dura cada etapa y **dónde cortar el ciclo** (cepillar paredes, vaciar, botar el agua a la tierra) |
| Síntomas | tarjetas "info" | Fiebre, dolor detrás de los ojos, sarpullido; señales de alarma; no automedicarse; ir al centro de salud |
| Prevención | tarjetas "info" | Limpieza por tipo de criadero, descacharrado, repelente, ropa |
| Mitos | 6 tarjetas que se voltean | Frente rojo "MITO", dorso verde "VERDAD" |

**Tarjetas.** Una sola tarjeta grande a la vez; se navega con las flechas laterales, las teclas
← / →, o deslizando horizontalmente (umbral 50 px). En la pestaña Mitos, un toque corto (o
`Espacio`/`Enter`) voltea la tarjeta. Cada tarjeta que se muestra queda marcada como **leída** y
se recuerda entre sesiones.

**Insignias.** Cuatro, guardadas en el dispositivo y mostradas en una fila bajo el título de la
selección de nivel (en color las ganadas, en gris las pendientes) y dentro de la Biblioteca:

| Insignia | Se gana al… |
|---|---|
| Explorador | leer 5 tarjetas (de cualquier pestaña) |
| Detective de larvas | leer las 4 fichas de especie |
| Guardián del barrio | leer todas las tarjetas de todas las pestañas |
| Fotógrafo | identificar un mosquito con la cámara IA (§12) |

Al ganar una, la Biblioteca lo celebra en pantalla; si es la de Fotógrafo, el aviso llega al volver
al juego desde la cámara.

**Bonus de estudio.** La Biblioteca cuenta las tarjetas **nuevas** leídas desde la última jornada.
Si al empezar una jornada hay 5 o más, el jugador recibe **+50 puntos** a los 0,7 s de arrancar
(aviso "Bonus por estudiar: +50") y el contador vuelve a cero. Leer las mismas tarjetas dos veces no
cuenta; el bonus es de 50 fijos, no acumulable.

## 12. Cámara con IA (demo simulada)

Botón **CÁMARA** táctil (sobre la lupa) o tecla `C` durante la jornada. **Es una simulación**: no
hay ningún modelo de reconocimiento de imágenes ni conexión a un servicio; la pantalla lo declara
con una etiqueta **DEMO**, y así debe presentarse a estudiantes y docentes. Su valor es didáctico:
enseñar *qué señales* distinguen a cada especie, no reconocerlas de verdad.

Flujo, con la jornada en pausa suave:

1. **Visor.** Se captura un cuadro de 256×256 px del mundo centrado en el brote más cercano si está
   a menos de **160 px** del agente; si no, centrado en el propio agente (para la demo siempre hay
   algo que analizar: si ni siquiera hay textura, se dibuja un fondo verde con un enjambre de
   muestra). Marco con esquinas, retícula y el consejo "Apunta a un mosquito". Disparar con el
   botón, `Espacio` o `Enter`.
2. **Análisis (~2,2 s).** Flash y clic de obturador, barrido de escáner sobre la foto, 4–6 puntos
   de referencia que aparecen uno a uno con etiquetas cortas (las "señales" de la especie), barra
   de confianza que sube y una consola de texto tipo terminal.
3. **Resultado.** Tarjeta de especie: ilustración, nombre común y científico, **confianza 87–98 %**
   (fija para esa foto), chips con las señales detectadas ("patas con anillos blancos", "lira
   blanca en el tórax"…), qué transmite y una recomendación. Botones: guardar en el álbum,
   ver la ficha en la Biblioteca, cerrar.

Cómo se elige la especie: si la foto fue de un brote, es la especie de ese brote (cada brote nace
con una al azar); si no, se sortea con los pesos del catálogo — Aedes aegypti 55 %, Aedes
albopictus 20 %, Culex 18 %, Anopheles 7 % — de modo que el mosquito del dengue es el más habitual
pero los demás también aparecen para poder compararlos.

**Álbum.** Cada especie guardada se agrega al álbum del dispositivo (máximo 4). La primera foto
guardada otorga la insignia Fotógrafo; al volver al juego, el HUD avisa "¡Especie identificada!
<nombre>" (y la insignia, si es nueva). La cámara está bloqueada mientras se limpia un criadero, se
fumiga o hay otro overlay abierto.

## 13. Enjambres e intensidad de fumigación (v3)

Los brotes dejan de ser un sprite fijo: son **enjambres de mosquitos individuales** que orbitan y
vibran alrededor de un punto, con un halo rojo cuando el brote es grande. Los tiempos de crecimiento
y los puntos de §3 no cambian; lo que cambia es la escala visual y el ritual de fumigar:

| Nivel | Mosquitos | Radio de la órbita | Duración de fumigar |
|---|---|---|---|
| Pequeño | 8 | 22 px | 2,5 s a pie · 1,5 s en camioneta |
| Medio | 14 | 32 px | 2,5 s · 1,5 s |
| Grande | 22 | 44 px | ×1,5: 3,75 s · 2,25 s |

Para cuidar el rendimiento hay un tope de **70 mosquitos en pantalla**: si se alcanza, los brotes
nuevos nacen con menos individuos (nunca menos de 4).

**Fumigar** ahora se ve así: el agente saca el **rociador** (sprite en la mano, orientado hacia el
brote; desde la camioneta la niebla sale del tanque trasero), un **cono de niebla** blanca-celeste
avanza hacia el enjambre, los mosquitos se agitan cada vez más y, a partir del **40 %** del
progreso, **caen uno a uno** girando (en orden aleatorio, de modo que al 100 % cayeron todos), con
gotas salpicando y un pulso verde al final; el zumbido baja con ellos. Al terminar, "+75/90/100" y
el consejo de siempre.

**Mantener vs. un toque.** Con la tecla `E` o el botón ACCIÓN táctil hay que **mantener
presionado**: soltar antes de tiempo **cancela** la fumigación, la niebla se apaga y el brote sigue
activo — pero los mosquitos que ya cayeron no vuelven, así que el enjambre queda reducido y el
siguiente intento arranca con ventaja. Con el clic del botón "Fumigar" del cartel de detección
(ratón) la fumigación corre sola hasta el final. Esto reemplaza la regla "un solo toque" de la v2.

## 14. Reglas de visibilidad (v3)

El principio: **el HUD nunca debe tapar la acción**. Tres mecanismos, todos automáticos:

- **Cámara con margen.** Los límites de desplazamiento de la cámara se amplían por arriba y por
  abajo (vertical táctil: 150 px arriba / 250 px abajo; horizontal táctil: 100 / 120; escritorio:
  100 / 60) para que, incluso en los bordes del mapa, el agente quede centrado en la franja libre
  entre el HUD y los controles.
- **Paneles que se apartan.** Diez veces por segundo el juego proyecta a pantalla al agente, a los
  brotes activos y al criadero detectado; cualquier panel del HUD (retrato, misiones, barrio
  protegido, riesgo de epidemia, panel central) que los tape baja su opacidad al **25 %** y vuelve
  al 90 % al despejarse; el minimapa baja al 35 %. Los paneles **no se mueven** de sitio.
- **Cartel y banner en el lado opuesto.** El cartel de detección ("¡Criadero detectado!",
  "Fumigar", "Biblioteca") y el banner de tips se colocan arriba si el objetivo está en la mitad
  inferior de la pantalla, y abajo si está en la superior; si los dos van abajo, el banner se apoya
  sobre el borde superior del cartel.

Además, en vertical el **panel de misiones** se muestra como una sola línea (la misión actual);
tocarla lo despliega 3 s y luego se pliega solo.

## 15. Idiomas (v3)

El juego está en **español y en inglés**. El idioma inicial se toma del guardado en el dispositivo
y, si no hay, del navegador (`en*` → inglés; cualquier otro → español). Se cambia desde el botón de
idioma del menú principal (etiqueta ES/EN) o desde Configuración, y se guarda para la próxima vez.
Toda la interfaz, los tips, los datos, el quiz, las fichas de especie y la Biblioteca tienen las
dos versiones; el contenido educativo se redactó en español y se tradujo para el proyecto (ver
`ATTRIBUTION.md`). Si a una clave le falta traducción, se muestra el español.
