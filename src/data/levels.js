/**
 * Catálogo de niveles del juego.
 *  - id:        clave de progreso en SaveSystem y `levelId` que recibe GameScene.
 *  - nombre:    etiqueta visible en la tarjeta de selección (es).
 *  - nombreEn:  etiqueta en inglés; usar `nombreNivel(level)` para obtener la del idioma actual.
 *  - thumb:     key de textura para la miniatura (si no está cargada se dibuja una).
 *  - bloqueado: muestra candado y no permite jugar.
 *  - data:      key del JSON del nivel en el cache (this.cache.json.get(data)).
 */
import { getLang } from '../i18n/index.js';

export const LEVELS = [
  { id: 'equipetrol', nombre: 'Equipetrol', nombreEn: 'Equipetrol', thumb: 'level_equipetrol', bloqueado: false, data: 'level_equipetrol' },
  { id: 'plan3000', nombre: 'Plan 3000', nombreEn: 'Plan 3000', thumb: 'level_plan3000', bloqueado: true },
];

export const getLevel = (id) => LEVELS.find((l) => l.id === id) || null;

/** Nombre del nivel en el idioma actual (acepta el objeto nivel o su id). */
export function nombreNivel(level) {
  const l = typeof level === 'string' ? getLevel(level) : level;
  if (!l) return '';
  return (getLang() === 'en' ? l.nombreEn : l.nombre) || l.nombre || '';
}
