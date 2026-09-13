# GDD — Dengue Invaders 2D: Agente SEDES (v2)

Documento de diseño de juego: las reglas de la jornada tal como quedaron implementadas en el
código (no el plan original). Parte de [PLAN_V2_JUGABILIDAD.md](PLAN_V2_JUGABILIDAD.md), pero
ajusta números y detalles a lo que el juego realmente hace hoy; los contratos técnicos (eventos,
registry, constantes) están en [ARQUITECTURA.md](ARQUITECTURA.md) sección 2.6, y el estado de cada
pieza en [PROGRESO.md](PROGRESO.md).

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
botón — un solo toque, no hace falta mantenerlo presionado. La fumigación corre sola durante 2,5 s
a pie o 1,5 s subido a la camioneta: una nube de espray rodea al brote mientras este se desvanece,
y el jugador queda bloqueado hasta que termina. Al terminar: suma los puntos de la tabla de arriba,
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

Para no repetir aquí lo que ya está detallado en `docs/PROGRESO.md` (v2 · Ola 2): fumigar un brote
es un solo toque (no "mantener presionado 2,5 s" como decía el plan), el tip de la estación se
muestra como dato del HUD y no como popup modal, y las misiones del HUD siguen siendo las 4 del v1
— no hay ninguna misión nueva de brotes, estación o camioneta pese a que el plan la mencionaba.
