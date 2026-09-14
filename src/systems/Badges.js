/**
 * Insignias de la Biblioteca SEDES (v3), guardadas en localStorage 'dengue.insignias'.
 *
 *   import { Badges } from '../systems/Badges.js';
 *   Badges.lista()            → ['explorador', ...] ids ganados (en orden de obtención)
 *   Badges.tiene('detective') → boolean
 *   Badges.otorgar('fotografo') → true si es nueva (la cámara IA la otorga)
 *   Badges.tarjetasLeidas     → Set de ids de tarjeta leídos (persistido)
 *   Badges.marcarLeida(id)    → { nueva: boolean, ganadas: [ids de insignias recién ganadas] }
 *   Badges.bonusPendiente()   → 50 si se leyeron ≥ 5 tarjetas nuevas desde la última jornada, si no 0
 *   Badges.consumirBonus()    → devuelve el bonus y reinicia el contador (llamar al iniciar una jornada)
 *   Badges.reset()
 *
 * Reglas: explorador = 5 tarjetas leídas; detective = las 4 fichas de especie;
 * guardian = todas las tarjetas de todas las pestañas; fotografo = la otorga la cámara.
 * Tolera localStorage inaccesible (copia en memoria durante la sesión).
 */
import { ALL_CARD_IDS, SPECIES_CARD_IDS, INSIGNIAS } from '../data/library.js';

export const BADGES_KEY = 'dengue.insignias';
export const BONUS_PUNTOS = 50;
export const BONUS_TARJETAS = 5;

const IDS = INSIGNIAS.map((b) => b.id);

function leer() {
  try {
    const raw = globalThis.localStorage?.getItem(BADGES_KEY);
    const o = raw ? JSON.parse(raw) : null;
    if (o && typeof o === 'object') {
      return {
        ganadas: Array.isArray(o.ganadas) ? o.ganadas.filter((id) => IDS.includes(id)) : [],
        leidas: Array.isArray(o.leidas) ? o.leidas : [],
        nuevasDesdeJornada: Number.isFinite(o.nuevasDesdeJornada) ? o.nuevasDesdeJornada : 0,
      };
    }
  } catch { /* inaccesible o corrupto */ }
  return null;
}

const estado = leer() || { ganadas: [], leidas: [], nuevasDesdeJornada: 0 };
const leidas = new Set(estado.leidas);

function guardar() {
  estado.leidas = [...leidas];
  try { globalThis.localStorage?.setItem(BADGES_KEY, JSON.stringify(estado)); } catch { /* sin storage */ }
}

export const Badges = {
  IDS,
  tarjetasLeidas: leidas,

  lista() { return [...estado.ganadas]; },

  tiene(id) { return estado.ganadas.includes(id); },

  /** Otorga una insignia por id; devuelve true si es nueva. */
  otorgar(id) {
    if (!IDS.includes(id) || estado.ganadas.includes(id)) return false;
    estado.ganadas.push(id);
    guardar();
    return true;
  },

  /** Marca una tarjeta como leída y evalúa insignias. */
  marcarLeida(id) {
    const nueva = !leidas.has(id);
    if (nueva) {
      leidas.add(id);
      estado.nuevasDesdeJornada += 1;
    }
    const ganadas = [];
    if (leidas.size >= 5 && Badges.otorgar('explorador')) ganadas.push('explorador');
    if (SPECIES_CARD_IDS.every((c) => leidas.has(c)) && Badges.otorgar('detective')) ganadas.push('detective');
    if (ALL_CARD_IDS.every((c) => leidas.has(c)) && Badges.otorgar('guardian')) ganadas.push('guardian');
    if (nueva || ganadas.length) guardar();
    return { nueva, ganadas };
  },

  /** Tarjetas nuevas leídas desde la última jornada. */
  nuevasDesdeJornada() { return estado.nuevasDesdeJornada; },

  bonusPendiente() { return estado.nuevasDesdeJornada >= BONUS_TARJETAS ? BONUS_PUNTOS : 0; },

  /** Devuelve el bonus (0 o 50) y reinicia el contador. Llamar al comenzar una jornada. */
  consumirBonus() {
    const b = Badges.bonusPendiente();
    estado.nuevasDesdeJornada = 0;
    guardar();
    return b;
  },

  reset() {
    estado.ganadas = [];
    estado.nuevasDesdeJornada = 0;
    leidas.clear();
    try { globalThis.localStorage?.removeItem(BADGES_KEY); } catch { /* ignorar */ }
  },
};
