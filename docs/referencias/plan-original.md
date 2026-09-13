# Dengue Invaders 2D — Plan de proyecto
## Juego web educativo 2D · Track Delight
**Idea:** el estudiante explora su barrio en vista cenital (top-down), encuentra criaderos de
mosquito (llantas, tanques, botellas), los inspecciona y los elimina con una animación
antes/después, ganando puntos que llenan la barra de "barrio protegido".

---

## 1. Stack tecnológico recomendado (2D)

| Capa | Tecnología | Por qué |
|---|---|---|
| Motor 2D | **Phaser 3** | El estándar de juegos HTML5: física arcade, tweens, partículas, tilemaps, sonido. Todo incluido |
| Editor de niveles | **Tiled** | Editor visual gratuito: dibujas el barrio como mapa de tiles |
| Build | **Vite** | Servidor dev rápido y build de producción |
| Deploy | GitHub Pages / Vercel | Gratis, con HTTPS |
| Leaderboard (fase 2) | Firebase | Ranking entre estudiantes |

> Alternativa: PixiJS (solo render) + lógica propia. Phaser es mejor porque trae física,
> animaciones y audio integrados — menos código propio que mantener.

---

## 2. Arquitectura (Phaser = todo son "Scenes")

```
src/
├── main.js               # config Phaser (tamaño, física arcade, escalado móvil)
├── scenes/
│   ├── BootScene.js      # carga de assets con barra de progreso
│   ├── MenuScene.js      # título "Dengue Invaders", botón jugar, créditos
│   ├── GameScene.js      # el barrio + jugador + criaderos (lo principal)
│   └── HUDScene.js       # puntos, misiones, barra % — overlay fijo
├── objects/
│   ├── Player.js         # movimiento 8 direcciones, animaciones
│   ├── Criadero.js       # estados: oculto / detectado / limpio + interacción
│   └── Mision.js         # objetivos del nivel
├── systems/
│   ├── EliminationFX.js  # tween + splash + disolución (la animación estrella)
│   ├── ScoreManager.js   # puntos, combo, barrio protegido %
│   ├── MissionManager.js # secuencia de misiones
│   └── SaveSystem.js     # localStorage: progreso y estrellas por nivel
├── levels/
│   ├── equipetrol.json   # exportado desde Tiled
│   └── plan3000.json
└── data/
    └── facts.js          # datos educativos (SEDES) por tipo de criadero
```

Flujo de una interacción:
1. El jugador se acerca a una llanta → aparece cartel "Criadero detectado 🚨"
2. Presiona E / toca el botón "Eliminar agua" → EliminationFX:
   tween del agua bajando + splash de partículas + fade con "disolve" pixelado → estado "limpio"
3. ScoreManager suma +50, HUD actualiza la barra %, popup educativo
   ("Una llanta puede criar 500 mosquitos por semana").
4. Todos los criaderos limpios → "¡Barrio protegido! ⭐⭐⭐"

---

## 3. Los gráficos 2D: qué usar y cómo (gratis)

### Assets listos (CC0)
- **Kenney.nl** — packs 2D top-down: "Topdown Shooter", "RPG Urban", "City Kit".
  Casas, calles, árboles, llantas, barriles, personajes con hojas de animación.
- **OpenGameArt.org** — buscar "topdown city tileset" (filtrar CC0/CC-BY).
- **itch.io** — assets gratuitos (revisar licencia).
- **Sprites del personaje:** hoja de animación 4 direcciones (Kenney las trae listas).
- **Sonidos:** jsfxr (beep retro) + Freesound CC0. Música: Kevin MacLeod (CC-BY) o Tone.js.

### El barrio real: SÍ se puede en 2D ✅
Al no ser Google Maps, sino **OpenStreetMap** (datos libres, licencia ODbL con atribución):
1. Entrar a openstreetmap.org o umap.openstreetmap.fr, centrar en un barrio real de
   Santa Cruz (Equipetrol, Plan 3000, Los Lotes...).
2. Exportar una imagen estática del área (o capturarla con un estilo claro).
3. Atribuir: "© colaboradores de OpenStreetMap" en los créditos.
4. Usar esa imagen como **fondo del nivel** y encima colocar los criaderos interactivos
   como sprites con zona de colisión.
   → El estudiante recorre literalmente las calles de SU barrio.
5. Alternativa aún más "juego": redibujar el mapa como tilemap en Tiled con un estilo
   cartoon, manteniendo la traza real de las calles (guía: la imagen OSM debajo).

### EliminationFX en 2D (la animación estrella ⭐)
Tres capas combinadas, todo nativo de Phaser:
1. **Tween:** el sprite de agua se encoge hacia abajo (Phaser.Tweens, 1.5 seg).
2. **Splash:** `Phaser.GameObjects.Particles` con textura de gota, gravedad y rebote.
3. **Disolución:** el sprite de agua se destruye píxel a píxel con un efecto de
   "dissolve" — en Phaser se logra con máscara de ruide recortada (bitmap mask) +
   fade. 20 líneas.
4. Sonido de "gluglu" + "pop" (jsfxr) y "+50 puntos" flotando hacia arriba.

---

## 4. Diseño del juego (educación + diversión)

- **Misiones:** "Recorre el barrio" → "Encuentra 3 criaderos" → "Ayuda a la familia"
  → "Barrio protegido 100%".
- **Tipos de criadero:** llanta, tanque de agua, balde, botella, florero — cada uno con
  dato real de SEDES Santa Cruz en el popup.
- **Sistema de estrellas** por nivel (tiempo + criaderos encontrados).
- **Modo foto:** capturar el antes/después (canvas.toDataURL) para compartir — difusión.
- **Timer opcional** para el reto: "limpia el barrio en 3 minutos".

---

## 5. Roadmap de desarrollo (2D es más rápido)

| Fase | Entregable | Tiempo est. |
|---|---|---|
| 1. Setup | Vite + Phaser, personaje moviéndose en pantalla vacía | medio día |
| 2. Barrio | Fondo OSM o tilemap Tiled + colliders | 1 día |
| 3. Criaderos | Sprites interactivos, detección por proximidad, cartel | 1 día |
| 4. Animación estrella ⭐ | Tween + splash + dissolve + sonido + puntos flotantes | 1–2 días |
| 5. HUD/misiones | Puntos, barra %, popups educativos, estrellas, localStorage | 1 día |
| 6. Polish | Música, más barrios, joystick táctil (Phaser lo trae) | 1 día |
| 7. Deploy + demo | GitHub Pages + video demo 60 seg | medio día |

**MVP corto:** fases 1–4, un solo barrio, 5 criaderos. 3-4 días de trabajo real.

---

## 6. Riesgos y consejos

- **Escalado móvil:** configurar Phaser con `Scale.FIT` desde el día 1.
- **Assets CC0:** guardar créditos en ATTRIBUTION.md (incluye OpenStreetMap).
- **No sobrediseñar:** un barrio pequeño pulido gana a tres barrios a medias.
- **La animación de eliminación es tu demo:** mostrarla en el segundo 10 del video.
- **Si Phaser se complica:** reducir a canvas vanilla, pero Phaser ahorra semanas.
