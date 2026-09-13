/**
 * Catálogo de niveles del juego.
 *  - id:        clave de progreso en SaveSystem y `levelId` que recibe GameScene.
 *  - nombre:    etiqueta visible en la tarjeta de selección.
 *  - thumb:     key de textura para la miniatura (si no está cargada se dibuja una).
 *  - bloqueado: muestra candado y no permite jugar.
 *  - data:      key del JSON del nivel en el cache (this.cache.json.get(data)).
 */
export const LEVELS = [
  { id: 'equipetrol', nombre: 'Equipetrol', thumb: 'level_equipetrol', bloqueado: false, data: 'level_equipetrol' },
  { id: 'plan3000', nombre: 'Plan 3000', thumb: 'level_plan3000', bloqueado: true },
];

export const getLevel = (id) => LEVELS.find((l) => l.id === id) || null;
