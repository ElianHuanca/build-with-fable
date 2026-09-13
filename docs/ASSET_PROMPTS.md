# Guía de estilo y prompts de assets — Dengue Invaders 2D

Sirve para dos cosas: mantener coherente lo que dibuja `tools/gen-assets.mjs` y
generar con IA las imágenes de mejora (logo, fondo, retratos, miniaturas).
Cada imagen generada reemplaza al archivo del mismo nombre sin tocar código.

## Estilo base (se antepone a todo prompt)

> 2D top-down cartoon game sprite, clean vector look, bold outlines, soft shading,
> bright saturated colors, flat white or transparent background, no text,
> palette: green #5cc23a, olive #a8b45c, terracotta #e8703a, sky blue #7dd3f5,
> navy #2c3e50, gray #4a4f55. Style of a friendly educational mobile game.

## Paleta

| Nombre | Hex | Uso |
|---|---|---|
| verde | `#5cc23a` | botones, barra de progreso, pasto claro |
| oliva | `#a8b45c` | pasto seco, plantas |
| teja | `#e8703a` | techos, acentos |
| celeste | `#7dd3f5` | agua limpia, cielo, bordes de panel |
| marino | `#2c3e50` | paneles de UI, sombras, gorra |
| gris | `#4a4f55` | calle, llanta, muros |
| agua sucia | `#4a8fb8` | agua dentro de criaderos |
| amarillo | `#f7c948` | estrellas, chispas |

## Lista de assets y prompt específico

### Personaje (`anim/player.png`, hoja 4 filas × 4 columnas, 64×64 por frame)
> Young student character, blue cap, navy backpack, white t-shirt, dark pants,
> sneakers. Sprite sheet: rows = facing down, up, left, right; columns = idle,
> walk 1, walk 2, walk 3. Top-down three-quarter view.

### Retrato (`img/portrait.png`, `img/portrait_thumbsup.png`, 128×128)
> Same student character, bust portrait, smiling; second version giving thumbs up.

### Criaderos (`sprites/<tipo>_<estado>.png`, 64×64; estados: agua, vaciando, limpio)
- **llanta:** Old black tire lying flat, seen from above, with stagnant water inside.
- **tanque:** Blue plastic water tank/barrel, open top, seen from above.
- **balde:** Light blue plastic bucket with water, seen from above.
- **botella:** Green glass bottle lying on ground with water inside.
- **florero:** Terracotta flower pot with plant and water in the saucer.
Para el estado `limpio`: same object, no water, small sparkle highlights.

### Escenario (`sprites/`, 64×64 salvo casa 128×128)
- **casa_a / casa_b:** Small Santa Cruz style house, terracotta tile roof, white walls, top-down.
- **arbol:** Round leafy tree, top-down, soft shadow.
- **planta:** Small tropical bush.
- **muro:** Low concrete wall segment with gate.
- **tanque_techo:** Black rooftop water tank.

### Tileset (`tiles/tileset.png`, 64×64 por tile)
pasto, pasto_oscuro, calle, calle_linea, vereda, esquina_vereda, cruce_peatonal, tierra.

### UI (`ui/`)
- `panel.png` 9-slice: navy rounded panel with light blue border.
- `btn_green.png`, `btn_gray.png` 9-slice: rounded pill buttons.
- `star_on.png`, `star_off.png` 32×32.
- `bar_bg.png`, `bar_fill.png`.
- `alert.png`: red circle with white exclamation.
- `key_e.png`: white rounded square with letter E.
- íconos 32×32: `camera`, `share`, `lock`, `book`, `gear`, `back`.

### Menú
- `img/logo.png` 512×256: "DENGUE INVADERS 2D" bold yellow-orange cartoon title, mosquito with red X mascot. (Único asset donde sí va texto.)
- `img/menu_bg.png` 960×540: Blurred top-down neighborhood, warm daylight.
- `img/level_equipetrol.png`, `img/level_plan3000.png` 256×160: aerial thumbnail of a neighborhood.

### Efectos
- `sprites/drop.png` 16×16: single water droplet.
- `sprites/spark.png` 16×16: four-point yellow sparkle.
- `sprites/noise.png` 256×256: grayscale noise (para la máscara de disolución).

## Sonidos (jsfxr, `audio/`)
step, detect, gluglu, pop, points, win, click. Retro suave, volumen normalizado a -12 dB.
