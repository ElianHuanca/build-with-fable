// Genera los sprites del juego como SVG → PNG con la paleta oficial.
// Uso: npm run gen:assets
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PALETTE as P } from '../src/data/palette.js';

const OUT = 'public/assets';
const T = 64; // tamaño de tile / frame
for (const d of ['anim', 'tiles', 'sprites']) mkdirSync(`${OUT}/${d}`, { recursive: true });

const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="geometricPrecision">${body}</svg>`;
const O = `stroke="${P.linea}" stroke-width="1.6" stroke-linejoin="round"`;

// ---------- Personaje (estudiante con gorra azul y mochila) ----------
// dir: down | up | left ; frame: 0 idle, 1 paso izq, 2 neutro, 3 paso der
function characterSVG(dir, frame) {
  const stepL = frame === 1 ? -3 : frame === 3 ? 3 : 0; // desplazamiento vertical piernas
  const stepR = -stepL;
  const bob = frame === 1 || frame === 3 ? -1 : 0; // rebote del cuerpo al caminar
  const armL = frame === 1 ? 2 : frame === 3 ? -2 : 0;
  const armR = -armL;
  const g = [];

  g.push(`<ellipse cx="32" cy="59" rx="13" ry="4" fill="rgba(0,0,0,0.22)"/>`);

  // Piernas y zapatillas
  const leg = (x, dy) =>
    `<rect x="${x}" y="${43 + dy}" width="7" height="11" rx="2" fill="${P.marino}" ${O}/>` +
    `<rect x="${x - 1}" y="${52 + dy}" width="9" height="5" rx="2.5" fill="${P.azulGorra}" ${O}/>`;
  if (dir === 'left') {
    g.push(leg(27, stepR), leg(31, stepL));
  } else {
    g.push(leg(24, stepL), leg(33, stepR));
  }

  // Cuerpo
  const by = 30 + bob;
  if (dir === 'up') {
    g.push(`<rect x="21" y="${by}" width="22" height="17" rx="5" fill="${P.blanco}" ${O}/>`);
    // Mochila vista desde atrás
    g.push(`<rect x="24" y="${by + 1}" width="16" height="15" rx="4" fill="${P.marino}" ${O}/>`);
    g.push(`<rect x="27" y="${by + 4}" width="10" height="5" rx="2" fill="${P.azulGorra}" stroke="none"/>`);
  } else if (dir === 'left') {
    g.push(`<rect x="24" y="${by}" width="16" height="17" rx="5" fill="${P.blanco}" ${O}/>`);
    // Mochila lateral (sobresale atrás, a la derecha del cuerpo)
    g.push(`<rect x="37" y="${by + 2}" width="7" height="13" rx="3" fill="${P.marino}" ${O}/>`);
  } else {
    g.push(`<rect x="21" y="${by}" width="22" height="17" rx="5" fill="${P.blanco}" ${O}/>`);
    // Tirantes de la mochila
    g.push(`<rect x="24" y="${by + 1}" width="4" height="14" rx="2" fill="${P.marino}" stroke="none"/>`);
    g.push(`<rect x="36" y="${by + 1}" width="4" height="14" rx="2" fill="${P.marino}" stroke="none"/>`);
  }

  // Brazos
  const arm = (x, dy) =>
    `<rect x="${x}" y="${by + 3 + dy}" width="5" height="11" rx="2.5" fill="${P.piel}" ${O}/>`;
  if (dir === 'left') {
    g.push(arm(26, armL));
  } else {
    g.push(arm(17, armL), arm(42, armR));
  }

  // Cabeza
  const hy = 19 + bob;
  const hx = dir === 'left' ? 31 : 32;
  g.push(`<circle cx="${hx}" cy="${hy}" r="12.5" fill="${P.piel}" ${O}/>`);
  // Pelo bajo la gorra
  g.push(`<path d="M${hx - 12} ${hy} a12 12 0 0 1 24 0 v3 h-24 z" fill="${P.linea}" stroke="none"/>`);

  // Gorra azul
  const capDome = `<path d="M${hx - 12.5} ${hy + 1} a12.5 12.5 0 0 1 25 0 z" fill="${P.azulGorra}" ${O}/>`;
  g.push(capDome);
  g.push(`<path d="M${hx - 12.5} ${hy + 1} h25" stroke="${P.linea}" stroke-width="1.6"/>`);
  g.push(`<rect x="${hx - 13}" y="${hy - 1}" width="26" height="3.5" rx="1.5" fill="${P.azulGorraOscuro}" stroke="none"/>`);
  if (dir === 'down') {
    g.push(`<ellipse cx="${hx}" cy="${hy + 3}" rx="13.5" ry="2.8" fill="${P.azulGorraOscuro}" ${O}/>`);
  } else if (dir === 'left') {
    g.push(`<path d="M${hx - 6} ${hy - 0.5} h-9 a2.2 2.2 0 0 0 0 4.4 h9 z" fill="${P.azulGorraOscuro}" ${O}/>`);
  } else {
    // up: botón de la gorra
    g.push(`<circle cx="${hx}" cy="${hy - 11}" r="1.6" fill="${P.azulGorraOscuro}" stroke="none"/>`);
  }

  // Cara
  if (dir === 'down') {
    g.push(`<circle cx="${hx - 4.5}" cy="${hy + 7}" r="1.7" fill="${P.linea}"/>`);
    g.push(`<circle cx="${hx + 4.5}" cy="${hy + 7}" r="1.7" fill="${P.linea}"/>`);
    g.push(`<path d="M${hx - 3} ${hy + 10.5} q3 2.5 6 0" fill="none" stroke="${P.linea}" stroke-width="1.4" stroke-linecap="round"/>`);
    g.push(`<circle cx="${hx - 8}" cy="${hy + 9}" r="1.8" fill="${P.teja}" opacity="0.45"/>`);
    g.push(`<circle cx="${hx + 8}" cy="${hy + 9}" r="1.8" fill="${P.teja}" opacity="0.45"/>`);
  } else if (dir === 'left') {
    g.push(`<circle cx="${hx - 7}" cy="${hy + 7}" r="1.7" fill="${P.linea}"/>`);
    g.push(`<path d="M${hx - 9} ${hy + 10.5} q2 2 4 0.5" fill="none" stroke="${P.linea}" stroke-width="1.4" stroke-linecap="round"/>`);
  }

  return svg(T, T, g.join(''));
}

async function buildPlayerSheet() {
  const dirs = ['down', 'up', 'left', 'right'];
  const composites = [];
  const frames = {};
  for (let r = 0; r < dirs.length; r++) {
    for (let c = 0; c < 4; c++) {
      const src = dirs[r] === 'right' ? characterSVG('left', c) : characterSVG(dirs[r], c);
      let img = sharp(Buffer.from(src)).png();
      if (dirs[r] === 'right') img = img.flop();
      composites.push({ input: await img.toBuffer(), left: c * T, top: r * T });
      frames[`${dirs[r]}_${c}`] = { frame: { x: c * T, y: r * T, w: T, h: T } };
    }
  }
  await sharp({ create: { width: T * 4, height: T * 4, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites)
    .png()
    .toFile(`${OUT}/anim/player.png`);
  writeFileSync(`${OUT}/anim/player.json`, JSON.stringify({ frames, meta: { image: 'player.png', size: { w: T * 4, h: T * 4 } } }, null, 2));
}

// ---------- Tiles de suelo ----------
function tileSVG(kind) {
  const g = [];
  const blades = (color, n, seed) => {
    let s = seed;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < n; i++) {
      const x = 4 + rnd() * 56, y = 4 + rnd() * 56;
      g.push(`<path d="M${x} ${y} l2 -4 l2 4" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/>`);
    }
  };
  switch (kind) {
    case 'pasto':
      g.push(`<rect width="64" height="64" fill="${P.verde}"/>`); blades(P.verdeOscuro, 7, 11); break;
    case 'pasto_oscuro':
      g.push(`<rect width="64" height="64" fill="#52b434"/>`); blades(P.verdeOscuro, 8, 23); break;
    case 'pasto_seco':
      g.push(`<rect width="64" height="64" fill="#7fc84a"/>`); blades('#6aa83a', 7, 7); break;
    case 'calle':
      g.push(`<rect width="64" height="64" fill="${P.gris}"/>`);
      g.push(`<circle cx="14" cy="40" r="1.2" fill="#5a6066"/><circle cx="48" cy="18" r="1.2" fill="#5a6066"/>`);
      break;
    case 'calle_linea': // línea central discontinua (horizontal)
      g.push(`<rect width="64" height="64" fill="${P.gris}"/>`);
      g.push(`<rect x="8" y="30" width="24" height="4" rx="1" fill="${P.amarillo}"/>`);
      break;
    case 'calle_linea_v':
      g.push(`<rect width="64" height="64" fill="${P.gris}"/>`);
      g.push(`<rect x="30" y="8" width="4" height="24" rx="1" fill="${P.amarillo}"/>`);
      break;
    case 'cruce':
      g.push(`<rect width="64" height="64" fill="${P.gris}"/>`);
      for (let i = 0; i < 4; i++) g.push(`<rect x="${6 + i * 15}" y="8" width="8" height="48" fill="${P.blanco}" opacity="0.9"/>`);
      break;
    case 'vereda':
      g.push(`<rect width="64" height="64" fill="#cfd3d6"/>`);
      g.push(`<path d="M32 0 v64 M0 32 h64" stroke="#b3b8bd" stroke-width="2"/>`);
      break;
    case 'tierra':
      g.push(`<rect width="64" height="64" fill="#c9a06a"/><circle cx="20" cy="22" r="2" fill="#b58a55"/><circle cx="44" cy="46" r="2.5" fill="#b58a55"/>`);
      break;
  }
  return svg(T, T, g.join(''));
}

const TILES = ['pasto', 'pasto_oscuro', 'pasto_seco', 'calle', 'calle_linea', 'calle_linea_v', 'cruce', 'vereda', 'tierra'];

async function buildTileset() {
  const cols = 4, rows = Math.ceil(TILES.length / cols);
  const composites = [];
  for (let i = 0; i < TILES.length; i++) {
    composites.push({ input: Buffer.from(tileSVG(TILES[i])), left: (i % cols) * T, top: Math.floor(i / cols) * T });
  }
  await sharp({ create: { width: cols * T, height: rows * T, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites).png().toFile(`${OUT}/tiles/tileset.png`);
  writeFileSync(`${OUT}/tiles/tileset.json`, JSON.stringify({ tile: T, cols, names: TILES }, null, 2));
}

// ---------- Decoración básica ----------
function treeSVG() {
  return svg(T, T, `
    <ellipse cx="32" cy="58" rx="16" ry="5" fill="rgba(0,0,0,0.22)"/>
    <rect x="28" y="40" width="8" height="16" rx="3" fill="#8b5a2b" ${O}/>
    <circle cx="32" cy="30" r="22" fill="${P.verdeOscuro}" ${O}/>
    <circle cx="24" cy="24" r="11" fill="${P.verde}" stroke="none"/>
    <circle cx="40" cy="28" r="10" fill="${P.verde}" stroke="none"/>
    <circle cx="30" cy="38" r="9" fill="${P.verde}" stroke="none"/>
    <circle cx="22" cy="20" r="4" fill="#8fdc6b" stroke="none"/>
  `);
}
function plantSVG() {
  return svg(T, T, `
    <ellipse cx="32" cy="54" rx="12" ry="4" fill="rgba(0,0,0,0.2)"/>
    <path d="M32 52 C 26 40, 16 38, 14 30 C 24 30, 30 38, 32 44 C 34 36, 42 28, 50 28 C 48 38, 40 44, 32 52 Z" fill="${P.verde}" ${O}/>
    <path d="M32 52 C 30 42, 28 34, 32 24 C 36 34, 34 42, 32 52 Z" fill="${P.verdeOscuro}" ${O}/>
  `);
}

async function buildDeco() {
  await sharp(Buffer.from(treeSVG())).png().toFile(`${OUT}/sprites/arbol.png`);
  await sharp(Buffer.from(plantSVG())).png().toFile(`${OUT}/sprites/planta.png`);
}

await buildPlayerSheet();
await buildTileset();
await buildDeco();
console.log('Assets generados en', OUT);
