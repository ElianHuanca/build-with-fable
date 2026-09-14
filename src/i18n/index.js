/**
 * i18n mínimo (v3). Diccionarios planos con claves con puntos en ./es.js y ./en.js.
 *
 *   import { t, tx, getLang, setLang } from '../i18n/index.js';
 *   t('menu.jugar')                    → 'JUGAR' | 'PLAY'
 *   t('hud.brotes', { n: 2 })          → interpola {n}
 *   tx({ es: 'Hola', en: 'Hi' })       → texto en el idioma actual (para datos con {es,en})
 *   setLang('en')                      → guarda en localStorage 'dengue.lang' y emite
 *                                        game.events 'lang' (si hay juego registrado con bindGame)
 *
 * Idioma inicial: localStorage → navigator.language (en* → 'en') → 'es'.
 * Si falta una clave en el idioma actual, cae al español y luego a la propia clave.
 */
import { es } from './es.js';
import { en } from './en.js';

// Diccionarios parciales: cada módulo de ./dict/*.js exporta `es` y `en` (objetos planos).
// Se fusionan automáticamente (Vite import.meta.glob), así varios equipos agregan claves
// sin tocar es.js / en.js.
const PARTES = import.meta.glob('./dict/*.js', { eager: true });
const DICTS = { es: { ...es }, en: { ...en } };
for (const mod of Object.values(PARTES)) {
  Object.assign(DICTS.es, mod.es || {});
  Object.assign(DICTS.en, mod.en || {});
}
const KEY = 'dengue.lang';
let lang = detectar();
let game = null;

function detectar() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'es' || saved === 'en') return saved;
  } catch { /* sin almacenamiento */ }
  const nav = (typeof navigator !== 'undefined' && navigator.language) || 'es';
  return nav.toLowerCase().startsWith('en') ? 'en' : 'es';
}

export function getLang() { return lang; }

export function setLang(l) {
  if (l !== 'es' && l !== 'en' || l === lang) return;
  lang = l;
  try { localStorage.setItem(KEY, l); } catch { /* sin almacenamiento */ }
  game?.events.emit('lang', l);
}

/** Registra el juego para emitir 'lang' en game.events al cambiar de idioma. */
export function bindGame(g) { game = g; }

export function t(key, params) {
  let s = DICTS[lang]?.[key] ?? DICTS.es[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** Texto de un objeto { es, en } (o string plano) en el idioma actual. */
export function tx(obj) {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang] ?? obj.es ?? '';
}

/** Lista de un objeto { es: [...], en: [...] } en el idioma actual. */
export function txList(obj) {
  if (Array.isArray(obj)) return obj;
  return obj?.[lang] ?? obj?.es ?? [];
}
