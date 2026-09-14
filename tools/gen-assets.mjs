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

  // Cuerpo: chaleco naranja de agente SEDES con franja reflectante
  const by = 30 + bob;
  const chaleco = (x, w) =>
    `<rect x="${x}" y="${by}" width="${w}" height="17" rx="5" fill="${P.teja}" ${O}/>` +
    `<rect x="${x}" y="${by + 10}" width="${w}" height="3" fill="${P.amarillo}" stroke="none"/>`;
  if (dir === 'up') {
    g.push(chaleco(21, 22));
    // Mochila fumigadora vista desde atrás: tanque con tapa y correas
    g.push(`<rect x="26" y="${by - 1}" width="12" height="16" rx="4" fill="${P.grisClaro}" ${O}/>`);
    g.push(`<rect x="28" y="${by - 4}" width="8" height="4" rx="2" fill="${P.gris}" ${O}/>`);
    g.push(`<circle cx="32" cy="${by - 5}" r="1.4" fill="${P.azulGorraOscuro}" stroke="none"/>`);
    g.push(`<rect x="23" y="${by + 2}" width="3" height="13" rx="1.5" fill="${P.marino}" stroke="none"/>`);
    g.push(`<rect x="38" y="${by + 2}" width="3" height="13" rx="1.5" fill="${P.marino}" stroke="none"/>`);
  } else if (dir === 'left') {
    g.push(chaleco(24, 16));
    // Tanque de la mochila fumigadora asomando por detrás, con manguera hacia adelante
    g.push(`<rect x="36" y="${by - 1}" width="9" height="15" rx="3.5" fill="${P.grisClaro}" ${O}/>`);
    g.push(`<rect x="37.5" y="${by - 3.5}" width="6" height="4" rx="1.5" fill="${P.gris}" ${O}/>`);
    g.push(`<path d="M39 ${by + 8} q7 3 9 9" fill="none" stroke="${P.grisClaro}" stroke-width="2" stroke-linecap="round"/>`);
  } else {
    g.push(chaleco(21, 22));
    // Logo simple del SEDES sobre el pecho
    g.push(`<circle cx="27" cy="${by + 5}" r="2.6" fill="${P.celeste}" ${O}/>`);
    // Correas de la mochila fumigadora asomando sobre los hombros
    g.push(`<rect x="24" y="${by + 1}" width="4" height="14" rx="2" fill="${P.grisClaro}" stroke="none"/>`);
    g.push(`<rect x="36" y="${by + 1}" width="4" height="14" rx="2" fill="${P.grisClaro}" stroke="none"/>`);
  }

  // Brazos
  const arm = (x, dy) =>
    `<rect x="${x}" y="${by + 3 + dy}" width="5" height="11" rx="2.5" fill="${P.piel}" ${O}/>`;
  if (dir === 'left') {
    g.push(arm(26, armL));
  } else {
    g.push(arm(17, armL), arm(42, armR));
  }
  if (dir === 'down') {
    // Lanza de fumigación sostenida con la mano derecha
    g.push(`<rect x="45" y="${by + 9 + armR}" width="8" height="3.4" rx="1.4" fill="${P.grisClaro}" ${O}/>`);
    g.push(`<circle cx="53.5" cy="${by + 10.7 + armR}" r="1.6" fill="${P.gris}" stroke="none"/>`);
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
    case 'cruce_v': // cruce peatonal con franjas horizontales (para calles verticales)
      g.push(`<rect width="64" height="64" fill="${P.gris}"/>`);
      for (let i = 0; i < 4; i++) g.push(`<rect x="8" y="${6 + i * 15}" width="48" height="8" fill="${P.blanco}" opacity="0.9"/>`);
      break;
    case 'esquina': // calle lisa con alcantarilla
      g.push(`<rect width="64" height="64" fill="${P.gris}"/>`);
      g.push(`<circle cx="32" cy="32" r="9" fill="#3a3f44" stroke="#2e3338" stroke-width="1.6"/>`);
      g.push(`<circle cx="32" cy="32" r="6" fill="none" stroke="#5a6066" stroke-width="1.4"/>`);
      g.push(`<path d="M28 29 h8 M28 32 h8 M28 35 h8" stroke="#5a6066" stroke-width="1.2" stroke-linecap="round"/>`);
      break;
    case 'vereda_borde': // vereda con cordón inferior más oscuro
      g.push(`<rect width="64" height="64" fill="#cfd3d6"/>`);
      g.push(`<path d="M32 0 v58 M0 29 h64" stroke="#b3b8bd" stroke-width="2"/>`);
      g.push(`<rect x="0" y="58" width="64" height="6" fill="#8a9096"/>`);
      g.push(`<rect x="0" y="57" width="64" height="1.5" fill="#a5aaaf"/>`);
      break;
  }
  return svg(T, T, g.join(''));
}

const TILES = ['pasto', 'pasto_oscuro', 'pasto_seco', 'calle', 'calle_linea', 'calle_linea_v', 'cruce', 'vereda', 'tierra', 'cruce_v', 'esquina', 'vereda_borde'];

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

function bushSVG() {
  return svg(48, 48, `
    <ellipse cx="24" cy="42" rx="16" ry="4.5" fill="rgba(0,0,0,0.22)"/>
    <circle cx="24" cy="26" r="17" fill="${P.verdeOscuro}" ${O}/>
    <circle cx="17" cy="21" r="9" fill="${P.verde}" stroke="none"/>
    <circle cx="31" cy="24" r="8" fill="${P.verde}" stroke="none"/>
    <circle cx="23" cy="32" r="7" fill="${P.verde}" stroke="none"/>
    <circle cx="16" cy="18" r="3" fill="#8fdc6b" stroke="none"/>
  `);
}

// Casa estilo Santa Cruz, vista top-down tres cuartos. variant 'a': cumbrera horizontal; 'b': cumbrera vertical
function houseSVG(variant) {
  const g = [];
  const wall = variant === 'a' ? P.blanco : '#f5e9d0';
  const wallShade = variant === 'a' ? '#e6e9ec' : '#e8d8b8';
  g.push(`<ellipse cx="64" cy="118" rx="58" ry="8" fill="rgba(0,0,0,0.22)"/>`);
  // Pared frontal (parte inferior visible)
  g.push(`<rect x="10" y="84" width="108" height="36" rx="3" fill="${wall}" ${O}/>`);
  g.push(`<rect x="10" y="84" width="108" height="6" fill="${wallShade}" stroke="none"/>`);
  // Puerta
  g.push(`<rect x="54" y="94" width="20" height="26" rx="3" fill="#8b5a2b" ${O}/>`);
  g.push(`<rect x="57" y="97" width="14" height="10" rx="1.5" fill="#a56d38" stroke="none"/>`);
  g.push(`<circle cx="69" cy="109" r="1.6" fill="${P.amarillo}" stroke="none"/>`);
  // Ventana celeste
  const wx = variant === 'a' ? 22 : 86;
  g.push(`<rect x="${wx}" y="94" width="20" height="16" rx="2" fill="${P.celeste}" ${O}/>`);
  g.push(`<path d="M${wx + 10} 94 v16 M${wx} 102 h20" stroke="${P.linea}" stroke-width="1.4"/>`);
  g.push(`<rect x="${wx + 2}" y="96" width="5" height="4" fill="#ffffff" opacity="0.6" stroke="none"/>`);
  // Techo
  const tiles = (x, y, w, h) => {
    let s = '';
    for (let yy = y + 8; yy < y + h - 2; yy += 8) s += `<path d="M${x + 2} ${yy} h${w - 4}" stroke="${P.tejaOscura}" stroke-width="1.6"/>`;
    for (let yy = y + 4, k = 0; yy < y + h - 2; yy += 8, k++) {
      const off = k % 2 ? 4 : 0;
      for (let xx = x + 6 + off; xx < x + w - 4; xx += 8) s += `<path d="M${xx} ${yy - 3} v3" stroke="${P.tejaOscura}" stroke-width="1.4" stroke-linecap="round"/>`;
    }
    return `<g clip-path="url(#roof-${variant})">${s}</g>`;
  };
  if (variant === 'a') {
    // Techo a dos aguas con cumbrera horizontal: faldón trasero (más oscuro) y frontal
    g.push(`<clipPath id="roof-a"><rect x="4" y="8" width="120" height="84"/></clipPath>`);
    g.push(`<rect x="4" y="8" width="120" height="34" rx="3" fill="#d5602e" ${O}/>`);
    g.push(`<rect x="4" y="40" width="120" height="52" rx="3" fill="${P.teja}" ${O}/>`);
    g.push(tiles(4, 40, 120, 52));
    g.push(`<path d="M8 20 h112" stroke="${P.tejaOscura}" stroke-width="1.6"/><path d="M8 30 h112" stroke="${P.tejaOscura}" stroke-width="1.6"/>`);
    // Cumbrera
    g.push(`<rect x="2" y="37" width="124" height="6" rx="3" fill="${P.tejaOscura}" ${O}/>`);
  } else {
    // Cumbrera vertical: faldón izquierdo y derecho
    g.push(`<clipPath id="roof-b"><rect x="4" y="8" width="120" height="84"/></clipPath>`);
    g.push(`<path d="M6 12 q0 -4 4 -4 h54 v84 h-54 q-4 0 -4 -4 z" fill="${P.teja}" ${O}/>`);
    g.push(`<path d="M64 8 h54 q4 0 4 4 v76 q0 4 -4 4 h-54 z" fill="#d5602e" ${O}/>`);
    // Tejas: líneas paralelas a la cumbrera, en cada faldón
    let s = '';
    for (let xx = 14; xx < 60; xx += 8) s += `<path d="M${xx} 10 v80" stroke="${P.tejaOscura}" stroke-width="1.6"/>`;
    for (let xx = 74; xx < 120; xx += 8) s += `<path d="M${xx} 10 v80" stroke="${P.tejaOscura}" stroke-width="1.6"/>`;
    for (let xx = 10, k = 0; xx < 122; xx += 8, k++) {
      if (xx > 58 && xx < 70) continue;
      const off = k % 2 ? 4 : 0;
      for (let yy = 14 + off; yy < 88; yy += 8) s += `<path d="M${xx} ${yy} h3" stroke="${P.tejaOscura}" stroke-width="1.4" stroke-linecap="round"/>`;
    }
    g.push(`<g clip-path="url(#roof-b)">${s}</g>`);
    g.push(`<rect x="61" y="6" width="6" height="88" rx="3" fill="${P.tejaOscura}" ${O}/>`);
  }
  // Alero: sombra sobre la pared
  g.push(`<rect x="10" y="${variant === 'a' ? 92 : 92}" width="108" height="3" fill="rgba(0,0,0,0.18)" stroke="none"/>`);
  return svg(128, 128, g.join(''));
}

function wallSVG(horizontal) {
  const w = horizontal ? 64 : 32, h = horizontal ? 32 : 64;
  if (horizontal) {
    return svg(w, h, `
      <ellipse cx="32" cy="29" rx="30" ry="3" fill="rgba(0,0,0,0.2)"/>
      <rect x="1" y="10" width="62" height="18" rx="2" fill="#cfd3d6" ${O}/>
      <rect x="1" y="16" width="62" height="12" fill="#b3b8bd" stroke="none"/>
      <rect x="0" y="6" width="64" height="8" rx="2" fill="#e6e9ec" ${O}/>
    `);
  }
  return svg(w, h, `
    <ellipse cx="16" cy="60" rx="12" ry="3" fill="rgba(0,0,0,0.2)"/>
    <rect x="8" y="2" width="16" height="58" rx="2" fill="#cfd3d6" ${O}/>
    <rect x="8" y="50" width="16" height="10" fill="#b3b8bd" stroke="none"/>
    <rect x="4" y="0" width="24" height="52" rx="2" fill="#e6e9ec" ${O}/>
  `);
}

function gateSVG() {
  let bars = '';
  for (let x = 10; x <= 54; x += 11) bars += `<path d="M${x} 6 v20" stroke="${P.marino}" stroke-width="3" stroke-linecap="round"/>`;
  return svg(64, 32, `
    <ellipse cx="32" cy="29" rx="30" ry="3" fill="rgba(0,0,0,0.2)"/>
    ${bars}
    <rect x="0" y="2" width="64" height="5" rx="2" fill="${P.marino}" ${O}/>
    <rect x="0" y="24" width="64" height="5" rx="2" fill="${P.marino}" ${O}/>
    <rect x="0" y="14" width="64" height="3" rx="1.5" fill="${P.marino}" stroke="none"/>
    <circle cx="32" cy="15.5" r="2.5" fill="${P.amarillo}" ${O}/>
  `);
}

function roofTankSVG() {
  return svg(40, 40, `
    <ellipse cx="20" cy="35" rx="16" ry="4" fill="rgba(0,0,0,0.25)"/>
    <circle cx="20" cy="22" r="16" fill="#2a2e32" ${O}/>
    <circle cx="20" cy="19" r="16" fill="#3a3f44" ${O}/>
    <circle cx="20" cy="19" r="11" fill="#2f3438" stroke="${P.linea}" stroke-width="1.2"/>
    <circle cx="20" cy="19" r="4" fill="#4a5056" ${O}/>
    <path d="M11 12 a12 12 0 0 1 9 -5" fill="none" stroke="#7a8188" stroke-width="2.4" stroke-linecap="round"/>
  `);
}

async function buildDeco() {
  await sharp(Buffer.from(treeSVG())).png().toFile(`${OUT}/sprites/arbol.png`);
  await sharp(Buffer.from(plantSVG())).png().toFile(`${OUT}/sprites/planta.png`);
  await sharp(Buffer.from(bushSVG())).png().toFile(`${OUT}/sprites/arbusto.png`);
  await sharp(Buffer.from(houseSVG('a'))).png().toFile(`${OUT}/sprites/casa_a.png`);
  await sharp(Buffer.from(houseSVG('b'))).png().toFile(`${OUT}/sprites/casa_b.png`);
  await sharp(Buffer.from(wallSVG(true))).png().toFile(`${OUT}/sprites/muro_h.png`);
  await sharp(Buffer.from(wallSVG(false))).png().toFile(`${OUT}/sprites/muro_v.png`);
  await sharp(Buffer.from(gateSVG())).png().toFile(`${OUT}/sprites/porton.png`);
  await sharp(Buffer.from(roofTankSVG())).png().toFile(`${OUT}/sprites/tanque_techo.png`);
}

// ---------- Camioneta de fumigación (top-down, 4 direcciones, 80×56) ----------
function vehiculoSVG(dir) {
  const w = 80, h = 56;
  const body = P.blanco, tank = P.grisClaro, tankDark = P.gris;
  const g = [];
  const wheel = (x, y, horiz) => horiz
    ? `<rect x="${x}" y="${y}" width="10" height="5" rx="1.5" fill="#2a2e32"/>`
    : `<rect x="${x}" y="${y}" width="5" height="10" rx="1.5" fill="#2a2e32"/>`;
  const badge = (cx, cy) =>
    `<circle cx="${cx}" cy="${cy}" r="6" fill="${P.blanco}" ${O}/>` +
    `<path d="M${cx - 3} ${cy} h6 M${cx} ${cy - 3} v6" stroke="#e53935" stroke-width="2" stroke-linecap="round"/>`;
  g.push(`<ellipse cx="${w / 2}" cy="${h - 4}" rx="${w / 2 - 4}" ry="5" fill="rgba(0,0,0,0.22)"/>`);
  if (dir === 'down' || dir === 'up') {
    const frontY = dir === 'down' ? h - 12 : 12;
    const backY = dir === 'down' ? 12 : h - 12;
    g.push(wheel(4, 14, false), wheel(w - 9, 14, false), wheel(4, h - 24, false), wheel(w - 9, h - 24, false));
    g.push(`<rect x="10" y="6" width="${w - 20}" height="${h - 12}" rx="8" fill="${body}" ${O}/>`);
    // Tanque de fumigación (extremo trasero)
    g.push(`<rect x="18" y="${backY - 10}" width="${w - 36}" height="20" rx="7" fill="${tank}" ${O}/>`);
    g.push(`<rect x="22" y="${backY - 12}" width="${w - 44}" height="4" rx="2" fill="${tankDark}"/>`);
    // Cabina y parabrisas (extremo delantero)
    g.push(`<rect x="16" y="${frontY - 10}" width="${w - 32}" height="16" rx="5" fill="${P.celeste}" ${O}/>`);
    g.push(`<rect x="20" y="${frontY - 7}" width="${w - 40}" height="6" rx="2" fill="#bfeaff" opacity="0.8"/>`);
    g.push(`<circle cx="20" cy="${dir === 'down' ? h - 5 : 5}" r="2.4" fill="${P.amarillo}"/>`);
    g.push(`<circle cx="${w - 20}" cy="${dir === 'down' ? h - 5 : 5}" r="2.4" fill="${P.amarillo}"/>`);
    g.push(badge(w / 2, h / 2));
  } else {
    const frontX = dir === 'right' ? w - 12 : 12;
    const backX = dir === 'right' ? 12 : w - 12;
    g.push(wheel(14, 3, true), wheel(14, h - 8, true), wheel(w - 24, 3, true), wheel(w - 24, h - 8, true));
    g.push(`<rect x="6" y="8" width="${w - 12}" height="${h - 16}" rx="8" fill="${body}" ${O}/>`);
    // Tanque de fumigación (extremo trasero)
    g.push(`<rect x="${backX - 10}" y="16" width="20" height="${h - 32}" rx="7" fill="${tank}" ${O}/>`);
    g.push(`<rect x="${backX - 12}" y="20" width="4" height="${h - 40}" rx="2" fill="${tankDark}"/>`);
    // Cabina y parabrisas (extremo delantero)
    g.push(`<rect x="${frontX - 8}" y="14" width="16" height="${h - 28}" rx="5" fill="${P.celeste}" ${O}/>`);
    g.push(`<rect x="${frontX - 5}" y="18" width="6" height="${h - 36}" rx="2" fill="#bfeaff" opacity="0.8"/>`);
    g.push(`<circle cx="${dir === 'right' ? w - 5 : 5}" cy="18" r="2.4" fill="${P.amarillo}"/>`);
    g.push(`<circle cx="${dir === 'right' ? w - 5 : 5}" cy="${h - 18}" r="2.4" fill="${P.amarillo}"/>`);
    g.push(badge(w / 2, h / 2));
  }
  return svg(w, h, g.join(''));
}

async function buildVehiculo() {
  for (const dir of ['down', 'up', 'left', 'right']) {
    await sharp(Buffer.from(vehiculoSVG(dir))).png().toFile(`${OUT}/sprites/vehiculo_${dir}.png`);
  }
}

// ---------- Estación SEDES (edificio con garaje, 160×128) ----------
function estacionSVG() {
  const W = 160, H = 128;
  const g = [];
  g.push(`<ellipse cx="${W / 2}" cy="${H - 10}" rx="${W / 2 - 6}" ry="8" fill="rgba(0,0,0,0.22)"/>`);
  // Pared frontal
  g.push(`<rect x="8" y="60" width="${W - 16}" height="50" rx="4" fill="${P.blanco}" ${O}/>`);
  g.push(`<rect x="8" y="60" width="${W - 16}" height="6" fill="#e6e9ec" stroke="none"/>`);
  // Garaje donde vive la camioneta
  g.push(`<rect x="18" y="68" width="60" height="42" rx="3" fill="${P.azulGorraOscuro}" ${O}/>`);
  for (let x = 22; x < 76; x += 10) g.push(`<path d="M${x} 68 v42" stroke="${P.marino}" stroke-width="1.6"/>`);
  g.push(`<path d="M18 84 h60" stroke="${P.marino}" stroke-width="1.6"/>`);
  // Puerta de entrada
  g.push(`<rect x="92" y="80" width="18" height="30" rx="2" fill="#8b5a2b" ${O}/>`);
  g.push(`<circle cx="106" cy="96" r="1.5" fill="${P.amarillo}" stroke="none"/>`);
  // Ventana
  g.push(`<rect x="120" y="76" width="22" height="18" rx="2" fill="${P.celeste}" ${O}/>`);
  g.push(`<path d="M131 76 v18 M120 85 h22" stroke="${P.linea}" stroke-width="1.4"/>`);
  // Techo a dos aguas
  g.push(`<clipPath id="roof-estacion"><rect x="4" y="8" width="${W - 8}" height="56"/></clipPath>`);
  g.push(`<rect x="4" y="8" width="${W - 8}" height="24" rx="3" fill="#d5602e" ${O}/>`);
  g.push(`<rect x="4" y="30" width="${W - 8}" height="34" rx="3" fill="${P.teja}" ${O}/>`);
  let tejas = '';
  for (let yy = 38; yy < 60; yy += 8) tejas += `<path d="M8 ${yy} h${W - 16}" stroke="${P.tejaOscura}" stroke-width="1.6"/>`;
  g.push(`<g clip-path="url(#roof-estacion)">${tejas}</g>`);
  g.push(`<rect x="2" y="27" width="${W - 4}" height="6" rx="3" fill="${P.tejaOscura}" ${O}/>`);
  // Cartel SEDES
  g.push(`<rect x="${W / 2 - 38}" y="4" width="76" height="18" rx="4" fill="${P.marino}" ${O}/>`);
  g.push(`<text x="${W / 2}" y="17" text-anchor="middle" font-family="Arial, Helvetica, 'DejaVu Sans', sans-serif" font-weight="bold" font-size="13" fill="${P.blanco}">SEDES</text>`);
  // Sombra del alero
  g.push(`<rect x="8" y="68" width="${W - 16}" height="3" fill="rgba(0,0,0,0.18)" stroke="none"/>`);
  return svg(W, H, g.join(''));
}

async function buildEstacion() {
  await sharp(Buffer.from(estacionSVG())).png().toFile(`${OUT}/sprites/estacion.png`);
}

// ---------- Criaderos (64×64, estados agua | vacio | limpio + capa de agua aparte) ----------
// Cada criadero devuelve { base, water, top } como fragmentos SVG:
//   base  = objeto sin agua; water = SOLO la capa de agua; top = partes que van encima del agua (bordes, planta).
const WATER = P.aguaSucia;
const shine = (cx, cy, rx, ry, rot = -20) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${P.blanco}" opacity="0.5" transform="rotate(${rot} ${cx} ${cy})"/>`;
const waterEllipse = (cx, cy, rx, ry, hx, hy, hrx, hry) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${WATER}"/>` + shine(hx, hy, hrx, hry);

const CRIADEROS = {
  llanta() {
    let grooves = '';
    for (let a = 0; a < 360; a += 30) {
      grooves += `<path d="M32 12 v5" stroke="#1e2226" stroke-width="2.2" stroke-linecap="round" transform="rotate(${a} 32 32)"/>`;
    }
    return {
      base: `
        <ellipse cx="32" cy="55" rx="24" ry="6" fill="rgba(0,0,0,0.22)"/>
        <ellipse cx="32" cy="34" rx="25" ry="23" fill="#1e2226" ${O}/>
        <circle cx="32" cy="32" r="25" fill="#2b2f33" ${O}/>
        <circle cx="32" cy="32" r="19" fill="none" stroke="#3a3f44" stroke-width="6"/>
        ${grooves}
        <circle cx="32" cy="32" r="12.5" fill="#1e2226" ${O}/>
        <circle cx="32" cy="33.5" r="11" fill="#15181b" stroke="none"/>`,
      water: waterEllipse(32, 33, 10.5, 9.5, 28, 29, 3.5, 1.8),
      top: '',
    };
  },
  tanque() {
    return {
      base: `
        <ellipse cx="32" cy="58" rx="22" ry="5" fill="rgba(0,0,0,0.22)"/>
        <path d="M11 22 v26 a21 9 0 0 0 42 0 v-26 z" fill="${P.azulGorra}" ${O}/>
        <path d="M11 30 h42 M11 40 h42" stroke="${P.azulGorraOscuro}" stroke-width="2.4"/>
        <path d="M11 22 v26 a21 9 0 0 0 42 0 v-26" fill="none" ${O}/>
        <ellipse cx="32" cy="22" rx="21" ry="9" fill="${P.azulGorraOscuro}" ${O}/>
        <ellipse cx="32" cy="22" rx="16.5" ry="6.2" fill="#163a75" ${O}/>
        <rect x="16" y="26" width="5" height="22" rx="2" fill="#5a8fe8" opacity="0.45" stroke="none"/>`,
      water: waterEllipse(32, 22.5, 15, 5.3, 27, 21, 5, 1.6, -10),
      top: '',
    };
  },
  balde() {
    return {
      base: `
        <ellipse cx="32" cy="58" rx="20" ry="5" fill="rgba(0,0,0,0.22)"/>
        <path d="M13 24 l4 26 a15 7 0 0 0 30 0 l4 -26 z" fill="${P.celeste}" ${O}/>
        <path d="M13 24 l4 26 a15 7 0 0 0 30 0 l4 -26" fill="none" ${O}/>
        <rect x="19" y="28" width="4" height="20" rx="2" fill="#ffffff" opacity="0.45" stroke="none"/>
        <ellipse cx="32" cy="24" rx="19" ry="8" fill="#5fb9e0" ${O}/>
        <ellipse cx="32" cy="24" rx="15" ry="5.6" fill="#3f8fb5" ${O}/>
        <path d="M14 26 a18 16 0 0 1 36 0" fill="none" stroke="${P.linea}" stroke-width="5" stroke-linecap="round"/>
        <path d="M14 26 a18 16 0 0 1 36 0" fill="none" stroke="${P.grisClaro}" stroke-width="2.6" stroke-linecap="round"/>`,
      water: waterEllipse(32, 24.5, 13.5, 4.6, 28, 23, 4.5, 1.4, -10),
      top: '',
    };
  },
  botella() {
    // Botella acostada: pico a la izquierda, cuerpo redondeado a la derecha. El agua ocupa la mitad inferior del cuerpo.
    const body = 'M22 24 h26 a9 9 0 0 1 0 18 h-26 a4 4 0 0 1 -4 -4 v-10 a4 4 0 0 1 4 -4 z';
    return {
      base: `
        <ellipse cx="34" cy="50" rx="26" ry="5" fill="rgba(0,0,0,0.22)"/>
        <path d="M7 29 a3 3 0 0 1 3 -3 h9 v14 h-9 a3 3 0 0 1 -3 -3 z" fill="#2f7a1a" ${O}/>
        <path d="${body}" fill="${P.verdeOscuro}" ${O}/>
        <path d="M24 27 h20" stroke="#ffffff" opacity="0.55" stroke-width="2" stroke-linecap="round"/>`,
      water: `<clipPath id="bw"><path d="${body}"/></clipPath>` +
        `<g clip-path="url(#bw)"><rect x="16" y="33" width="44" height="12" fill="${WATER}"/>` +
        shine(50, 36, 3.2, 1, 0) + `</g>`,
      top: `
        <path d="${body}" fill="none" ${O}/>
        <rect x="29" y="25.5" width="12" height="15" fill="${P.blanco}" ${O}/>
        <path d="M31.5 29 h7 M31.5 32.5 h7 M31.5 36 h5" stroke="#8a9096" stroke-width="1.2" stroke-linecap="round"/>`,
    };
  },
  florero() {
    return {
      base: `
        <ellipse cx="32" cy="58" rx="22" ry="5" fill="rgba(0,0,0,0.22)"/>
        <ellipse cx="32" cy="50" rx="21" ry="8" fill="#c95a2a" ${O}/>
        <ellipse cx="32" cy="48.5" rx="21" ry="8" fill="${P.teja}" ${O}/>
        <ellipse cx="32" cy="48.5" rx="17" ry="5.6" fill="#b8522a" ${O}/>
        <path d="M20 26 l3 20 a9 4 0 0 0 18 0 l3 -20 z" fill="${P.teja}" ${O}/>
        <path d="M20 26 l3 20 a9 4 0 0 0 18 0 l3 -20" fill="none" ${O}/>
        <rect x="18" y="23" width="28" height="6" rx="2" fill="#f08a52" ${O}/>
        <rect x="24" y="31" width="3" height="14" rx="1.5" fill="#ffffff" opacity="0.3" stroke="none"/>`,
      water: `<path d="M15.5 48.5 a16.5 5.4 0 0 0 33 0 a16.5 5.4 0 0 0 -33 0 z M22.5 46.5 a9.5 3.6 0 0 0 19 0 a9.5 3.6 0 0 0 -19 0 z" fill-rule="evenodd" fill="${WATER}"/>` +
        shine(20, 47.5, 2.6, 0.9, 0),
      top: `
        <path d="M32 24 C 30 16, 22 12, 16 12 C 18 20, 24 24, 32 24 Z" fill="${P.verde}" ${O}/>
        <path d="M32 24 C 34 16, 42 12, 48 12 C 46 20, 40 24, 32 24 Z" fill="${P.verde}" ${O}/>
        <path d="M32 24 C 30 18, 30 10, 32 4 C 34 10, 34 18, 32 24 Z" fill="${P.verdeOscuro}" ${O}/>
        <path d="M32 24 C 28 22, 24 24, 22 28" fill="none" stroke="${P.verdeOscuro}" stroke-width="1.6" stroke-linecap="round"/>`,
    };
  },
};

const sparkPath = (cx, cy, r) =>
  `<path d="M${cx} ${cy - r} Q${cx} ${cy} ${cx + r} ${cy} Q${cx} ${cy} ${cx} ${cy + r} Q${cx} ${cy} ${cx - r} ${cy} Q${cx} ${cy} ${cx} ${cy - r} Z"`;
const sparkSVG = (cx, cy, r) => `${sparkPath(cx, cy, r)} fill="${P.amarillo}" stroke="${P.linea}" stroke-width="1.2" stroke-linejoin="round"/>`;

const CLEAN_DECOR = `
  ${sparkSVG(9, 16, 7)}
  ${sparkSVG(56, 42, 6)}
  ${sparkSVG(15, 52, 5.5)}
  <circle cx="53" cy="11" r="8" fill="${P.blanco}" ${O}/>
  <path d="M48.5 11.5 l3 3 l6 -6.5" fill="none" stroke="${P.verde}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;

async function buildCriaderos() {
  for (const [name, fn] of Object.entries(CRIADEROS)) {
    const { base, water, top } = fn();
    const out = {
      [`${name}_agua`]: base + water + top,
      [`${name}_vacio`]: base + top,
      [`${name}_limpio`]: base + top + CLEAN_DECOR,
      [`agua_${name}`]: water,
    };
    for (const [file, body] of Object.entries(out)) {
      await sharp(Buffer.from(svg(T, T, body))).png().toFile(`${OUT}/sprites/${file}.png`);
    }
  }
}

// ---------- Brotes de mosquitos (nubes de 2-4 siluetas, 3 tamaños) ----------
function mosquitoSiluetaSVG(cx, cy, s, tint) {
  return `<g transform="translate(${cx} ${cy}) scale(${s})">
    <ellipse cx="-6" cy="-10" rx="14" ry="5" fill="${tint}" opacity="0.55" transform="rotate(-30 -6 -10)"/>
    <ellipse cx="8" cy="-9" rx="14" ry="5" fill="${tint}" opacity="0.55" transform="rotate(28 8 -9)"/>
    <path d="M-2 2 l-16 8 a3 3 0 0 0 2.4 5.4 l15 -4 z" fill="#2b2f33"/>
    <ellipse cx="4" cy="0" rx="8" ry="6" fill="#3a3f44"/>
    <circle cx="15" cy="-1" r="6.5" fill="#3a3f44"/>
    <path d="M17 3 l12 9" stroke="#1e2226" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M-4 6 l-6 7 M2 8 l-3 8 M9 6 l6 7" stroke="#1e2226" stroke-width="1.6" stroke-linecap="round"/>
  </g>`;
}

// nivel 'pequeno'|'medio'|'grande': más siluetas y más aura roja de alarma cuanto más grande
function broteSVG(size, count, tint) {
  const spots = [
    { x: size * 0.34, y: size * 0.42, r: -10 },
    { x: size * 0.62, y: size * 0.56, r: 12 },
    { x: size * 0.5, y: size * 0.28, r: -4 },
    { x: size * 0.7, y: size * 0.34, r: 8 },
  ].slice(0, count);
  const s = size / 95;
  const g = [`<ellipse cx="${size / 2}" cy="${size / 2}" rx="${size * 0.46}" ry="${size * 0.46}" fill="#ff3b30" opacity="${0.08 + count * 0.05}"/>`];
  for (const p of spots) g.push(mosquitoSiluetaSVG(p.x, p.y, s, tint));
  return svg(size, size, g.join(''));
}

async function buildBrotes() {
  await sharp(Buffer.from(broteSVG(40, 2, '#c0392b'))).png().toFile(`${OUT}/sprites/mosquito_pequeno.png`);
  await sharp(Buffer.from(broteSVG(56, 3, '#b8342a'))).png().toFile(`${OUT}/sprites/mosquito_medio.png`);
  await sharp(Buffer.from(broteSVG(72, 4, '#a5241f'))).png().toFile(`${OUT}/sprites/mosquito_grande.png`);
}

// ---------- FX y UI ----------
function dropSVG() {
  return svg(16, 16, `
    <path d="M8 1.5 C 5.5 6, 2.5 8.5, 2.5 11 a5.5 5.5 0 0 0 11 0 c0 -2.5 -3 -5 -5.5 -9.5 z" fill="${WATER}" stroke="${P.linea}" stroke-width="1.2" stroke-linejoin="round"/>
    <ellipse cx="5.8" cy="10.5" rx="1.3" ry="2" fill="${P.blanco}" opacity="0.6" transform="rotate(-15 5.8 10.5)"/>
  `);
}
function sparkFxSVG() {
  return svg(16, 16, sparkSVG(8, 8, 7));
}
function spraySVG() {
  return svg(32, 32, `
    <circle cx="16" cy="16" r="13" fill="${P.celeste}" opacity="0.32"/>
    <circle cx="16" cy="16" r="9" fill="${P.celeste}" opacity="0.5" stroke="${P.blanco}" stroke-width="1" stroke-opacity="0.4"/>
    <circle cx="12" cy="12" r="3" fill="${P.blanco}" opacity="0.55"/>
    <circle cx="21" cy="19" r="2" fill="${P.blanco}" opacity="0.4"/>
  `);
}

async function buildNoise() {
  const n = 256;
  const buf = Buffer.alloc(n * n);
  let s = 1234567; // semilla fija (LCG)
  for (let i = 0; i < buf.length; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    buf[i] = s >>> 24;
  }
  await sharp(buf, { raw: { width: n, height: n, channels: 1 } }).png().toFile(`${OUT}/sprites/noise.png`);
}

function alertSVG() {
  return svg(48, 48, `
    <ellipse cx="24" cy="44" rx="16" ry="3.5" fill="rgba(0,0,0,0.2)"/>
    <circle cx="24" cy="23" r="20" fill="#e53935" stroke="${P.blanco}" stroke-width="4"/>
    <circle cx="24" cy="23" r="22" fill="none" stroke="${P.linea}" stroke-width="1.6"/>
    <rect x="21" y="10" width="6" height="16" rx="3" fill="${P.blanco}"/>
    <circle cx="24" cy="32.5" r="3.4" fill="${P.blanco}"/>
  `);
}
function keyESVG() {
  return svg(40, 40, `
    <rect x="3" y="5" width="34" height="34" rx="8" fill="#b9c2cb"/>
    <rect x="3" y="2" width="34" height="34" rx="8" fill="${P.blanco}" stroke="${P.marino}" stroke-width="2.6"/>
    <text x="20" y="29" text-anchor="middle" font-family="Arial, Helvetica, 'DejaVu Sans', sans-serif" font-weight="bold" font-size="24" fill="${P.marino}">E</text>
  `);
}
function panelSVG() {
  return svg(48, 48, `
    <rect x="1.5" y="1.5" width="45" height="45" rx="12" fill="${P.marino}" fill-opacity="0.92" stroke="${P.celeste}" stroke-width="3"/>
  `);
}
function btnGreenSVG() {
  return svg(48, 48, `
    <rect x="1.5" y="1.5" width="45" height="45" rx="14" fill="${P.verde}" stroke="${P.verdeOscuro}" stroke-width="3"/>
    <path d="M6 14 a10 10 0 0 1 10 -9 h16 a10 10 0 0 1 10 9 z" fill="#8fdc6b" opacity="0.7"/>
  `);
}

async function buildFX() {
  mkdirSync(`${OUT}/ui`, { recursive: true });
  await sharp(Buffer.from(dropSVG())).png().toFile(`${OUT}/sprites/drop.png`);
  await sharp(Buffer.from(sparkFxSVG())).png().toFile(`${OUT}/sprites/spark.png`);
  await buildNoise();
  await sharp(Buffer.from(alertSVG())).png().toFile(`${OUT}/ui/alert.png`);
  await sharp(Buffer.from(keyESVG())).png().toFile(`${OUT}/ui/key_e.png`);
  await sharp(Buffer.from(panelSVG())).png().toFile(`${OUT}/ui/panel.png`);
  await sharp(Buffer.from(btnGreenSVG())).png().toFile(`${OUT}/ui/btn_green.png`);
}

async function buildSpray() {
  await sharp(Buffer.from(spraySVG())).png().toFile(`${OUT}/sprites/spray.png`);
}

await buildPlayerSheet();
await buildTileset();
await buildDeco();
await buildCriaderos();
await buildFX();
await buildVehiculo();
await buildEstacion();
await buildBrotes();
await buildSpray();
console.log('Assets generados en', OUT);

// ---------- UI extra (retratos, estrellas, barras, íconos) ----------
const O2 = (w) => `stroke="${P.linea}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

// Cabeza del personaje a escala: r = radio de la cabeza; centro (cx, cy). Sonrisa amplia opcional.
function bigHeadSVG(cx, cy, r, { wide = false } = {}) {
  const sw = (1.6 * r) / 12.5;
  const o = O2(sw.toFixed(2));
  const k = r / 12.5;
  const g = [];
  g.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${P.piel}" ${o}/>`);
  g.push(`<path d="M${cx - r * 0.96} ${cy} a${r * 0.96} ${r * 0.96} 0 0 1 ${r * 1.92} 0 v${2 * k} h-${r * 1.92} z" fill="${P.linea}" stroke="none"/>`);
  g.push(`<path d="M${cx - r} ${cy + 1 * k} a${r} ${r} 0 0 1 ${2 * r} 0 z" fill="${P.azulGorra}" ${o}/>`);
  g.push(`<rect x="${cx - r - 0.5 * k}" y="${cy - 1 * k}" width="${2 * r + 1 * k}" height="${3.5 * k}" rx="${1.5 * k}" fill="${P.azulGorraOscuro}" stroke="none"/>`);
  g.push(`<ellipse cx="${cx}" cy="${cy + 3 * k}" rx="${r * 1.08}" ry="${2.2 * k}" fill="${P.azulGorraOscuro}" ${o}/>`);
  // brillo de la gorra
  g.push(`<path d="M${cx - r * 0.7} ${cy - r * 0.3} a${r * 0.75} ${r * 0.75} 0 0 1 ${r * 0.55} -${r * 0.55}" fill="none" stroke="#5a8fe8" stroke-width="${2 * k}" stroke-linecap="round" opacity="0.8"/>`);
  // ojos
  g.push(`<circle cx="${cx - 4.5 * k}" cy="${cy + 7.6 * k}" r="${1.9 * k}" fill="${P.linea}"/>`);
  g.push(`<circle cx="${cx + 4.5 * k}" cy="${cy + 7.6 * k}" r="${1.9 * k}" fill="${P.linea}"/>`);
  g.push(`<circle cx="${cx - 3.8 * k}" cy="${cy + 6.9 * k}" r="${0.6 * k}" fill="${P.blanco}"/>`);
  g.push(`<circle cx="${cx + 5.2 * k}" cy="${cy + 6.9 * k}" r="${0.6 * k}" fill="${P.blanco}"/>`);
  // sonrisa
  if (wide) {
    g.push(`<path d="M${cx - 4.5 * k} ${cy + 10.2 * k} q${4.5 * k} ${4.6 * k} ${9 * k} 0 z" fill="${P.linea}" stroke="none"/>`);
    g.push(`<path d="M${cx - 2.5 * k} ${cy + 10.9 * k} q${2.5 * k} ${1.6 * k} ${5 * k} 0 z" fill="${P.blanco}" stroke="none"/>`);
  } else {
    g.push(`<path d="M${cx - 3.5 * k} ${cy + 10.4 * k} q${3.5 * k} ${3 * k} ${7 * k} 0" fill="none" stroke="${P.linea}" stroke-width="${1.6 * k}" stroke-linecap="round"/>`);
  }
  g.push(`<circle cx="${cx - 7 * k}" cy="${cy + 9.6 * k}" r="${1.6 * k}" fill="${P.teja}" opacity="0.22"/>`);
  g.push(`<circle cx="${cx + 7 * k}" cy="${cy + 9.6 * k}" r="${1.6 * k}" fill="${P.teja}" opacity="0.22"/>`);
  return g.join('');
}

function retratoSVG() {
  const S = 128, c = 64, r = 38, k = r / 12.5, o = O2((1.6 * k).toFixed(2));
  const cy = 58;
  const body = `
    <clipPath id="circ"><circle cx="${c}" cy="${c}" r="57"/></clipPath>
    <circle cx="${c}" cy="${c}" r="60" fill="${P.blanco}" stroke="${P.linea}" stroke-width="2.4"/>
    <circle cx="${c}" cy="${c}" r="55" fill="${P.celeste}"/>
    <g clip-path="url(#circ)">
      <!-- torso -->
      <rect x="${c - 36}" y="${cy + r - 4}" width="72" height="60" rx="16" fill="${P.blanco}" ${o}/>
      <rect x="${c - 28}" y="${cy + r - 2}" width="12" height="50" rx="6" fill="${P.marino}" stroke="none"/>
      <rect x="${c + 16}" y="${cy + r - 2}" width="12" height="50" rx="6" fill="${P.marino}" stroke="none"/>
      ${bigHeadSVG(c, cy, r)}
    </g>
    <circle cx="${c}" cy="${c}" r="57" fill="none" stroke="${P.blanco}" stroke-width="6"/>
    <circle cx="${c}" cy="${c}" r="60.5" fill="none" stroke="${P.linea}" stroke-width="2.4"/>
  `;
  return svg(S, S, body);
}

function retratoPulgarSVG() {
  const S = 160, c = 80, r = 34, k = r / 12.5, o = O2((1.6 * k).toFixed(2));
  const cy = 50;
  const by = cy + r + 2; // top del torso
  const body = `
    <ellipse cx="${c}" cy="152" rx="36" ry="6" fill="rgba(0,0,0,0.22)"/>
    <!-- piernas -->
    <rect x="${c - 22}" y="${by + 38}" width="18" height="26" rx="6" fill="${P.marino}" ${o}/>
    <rect x="${c + 4}" y="${by + 38}" width="18" height="26" rx="6" fill="${P.marino}" ${o}/>
    <rect x="${c - 25}" y="${by + 58}" width="24" height="12" rx="6" fill="${P.azulGorra}" ${o}/>
    <rect x="${c + 1}" y="${by + 58}" width="24" height="12" rx="6" fill="${P.azulGorra}" ${o}/>
    <!-- brazo izquierdo abajo -->
    <rect x="${c - 42}" y="${by + 6}" width="13" height="32" rx="6.5" fill="${P.piel}" ${o}/>
    <!-- torso -->
    <rect x="${c - 30}" y="${by}" width="60" height="44" rx="12" fill="${P.blanco}" ${o}/>
    <rect x="${c - 23}" y="${by + 2}" width="10" height="38" rx="5" fill="${P.marino}" stroke="none"/>
    <rect x="${c + 13}" y="${by + 2}" width="10" height="38" rx="5" fill="${P.marino}" stroke="none"/>
    <!-- brazo derecho levantado con pulgar arriba -->
    <path d="M${c + 30} ${by + 14} q14 -2 20 -18 l0 -22" fill="none" stroke="${P.linea}" stroke-width="${13 + 2 * 1.6 * k}" stroke-linecap="round"/>
    <path d="M${c + 30} ${by + 14} q14 -2 20 -18 l0 -22" fill="none" stroke="${P.piel}" stroke-width="13" stroke-linecap="round"/>
    <!-- puño -->
    <rect x="${c + 40}" y="${cy - 10}" width="24" height="22" rx="8" fill="${P.piel}" ${o}/>
    <path d="M${c + 43} ${cy - 3} h18 M${c + 43} ${cy + 3} h18" stroke="${P.pieloscura}" stroke-width="2" stroke-linecap="round"/>
    <!-- pulgar -->
    <path d="M${c + 46} ${cy - 9} v-14 a6 6 0 0 1 12 0 v14 z" fill="${P.piel}" ${o}/>
    ${bigHeadSVG(c, cy, r, { wide: true })}
  `;
  return svg(S, S, body);
}

const starPath = (cx, cy, R, r) => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r : R;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
};
function starSVG(on) {
  const fill = on ? P.amarillo : P.grisClaro;
  const stroke = on ? '#d99a1a' : '#5f656b';
  const shineEl = on
    ? `<path d="${starPath(24, 25, 12, 5)}" fill="#ffe27a" opacity="0.7"/><ellipse cx="18" cy="17" rx="4" ry="2.4" fill="${P.blanco}" opacity="0.75" transform="rotate(-30 18 17)"/>`
    : `<path d="${starPath(24, 25, 12, 5)}" fill="#9aa0a6" opacity="0.5"/>`;
  return svg(48, 48, `
    <path d="${starPath(24, 26, 21, 9)}" fill="${fill}" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>
    ${shineEl}
  `);
}

function barBgSVG() {
  return svg(24, 24, `<rect x="1.5" y="1.5" width="21" height="21" rx="10" fill="#1b2733" stroke="${P.marino}" stroke-width="3"/>`);
}
function barFillSVG() {
  return svg(24, 24, `
    <rect x="0" y="0" width="24" height="24" rx="8" fill="${P.verde}"/>
    <clipPath id="bf"><rect x="0" y="0" width="24" height="24" rx="8"/></clipPath>
    <rect x="0" y="0" width="24" height="9" fill="#8fdc6b" clip-path="url(#bf)"/>
  `);
}

const W = `fill="none" stroke="${P.blanco}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
const ICONS = {
  camera: `<path d="M14 11 l3 -4 h6 l3 4 h6 a3 3 0 0 1 3 3 v14 a3 3 0 0 1 -3 3 h-24 a3 3 0 0 1 -3 -3 v-14 a3 3 0 0 1 3 -3 z" ${W}/><circle cx="20" cy="22" r="5.5" ${W}/><circle cx="20" cy="22" r="2" fill="${P.blanco}"/>`,
  share: `<circle cx="29" cy="9" r="4" ${W}/><circle cx="11" cy="20" r="4" ${W}/><circle cx="29" cy="31" r="4" ${W}/><path d="M14.5 18 l11 -7 M14.5 22 l11 7" ${W}/>`,
  lock: `<rect x="9" y="18" width="22" height="16" rx="3" fill="${P.blanco}" stroke="${P.blanco}" stroke-width="3" stroke-linejoin="round"/><path d="M13 18 v-5 a7 7 0 0 1 14 0 v5" ${W}/><circle cx="20" cy="25" r="2.2" fill="${P.marino}"/><rect x="18.8" y="25" width="2.4" height="5" fill="${P.marino}"/>`,
  book: `<path d="M20 12 c-3 -3 -8 -3 -12 -2 v20 c4 -1 9 -1 12 2 c3 -3 8 -3 12 -2 v-20 c-4 -1 -9 -1 -12 2 z" ${W}/><path d="M20 12 v20" ${W}/><path d="M12 16 h4 M12 21 h4 M24 16 h4 M24 21 h4" stroke="${P.blanco}" stroke-width="2" stroke-linecap="round"/>`,
  gear: (() => {
    let teeth = '';
    for (let a = 0; a < 360; a += 45) teeth += `<rect x="17.5" y="4" width="5" height="7" rx="1.5" fill="${P.blanco}" transform="rotate(${a} 20 20)"/>`;
    return `${teeth}<circle cx="20" cy="20" r="10" fill="${P.blanco}"/><circle cx="20" cy="20" r="4" fill="${P.marino}"/>`;
  })(),
  back: `<path d="M24 8 l-12 12 l12 12 M13 20 h20" fill="none" stroke="${P.blanco}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
  sound_on: `<path d="M6 15 h6 l8 -7 v24 l-8 -7 h-6 z" fill="${P.blanco}" stroke="${P.blanco}" stroke-width="3" stroke-linejoin="round"/><path d="M26 14 a8 8 0 0 1 0 12 M30 9 a14 14 0 0 1 0 22" ${W}/>`,
  sound_off: `<path d="M6 15 h6 l8 -7 v24 l-8 -7 h-6 z" fill="${P.blanco}" stroke="${P.blanco}" stroke-width="3" stroke-linejoin="round"/><path d="M26 15 l10 10 M36 15 l-10 10" ${W}/>`,
};
const iconSVG = (name) => svg(40, 40, ICONS[name]);

function btnRedXSVG() {
  return svg(48, 48, `
    <circle cx="24" cy="24" r="21" fill="#e53935" stroke="${P.blanco}" stroke-width="4"/>
    <circle cx="24" cy="24" r="23" fill="none" stroke="${P.linea}" stroke-width="1.6"/>
    <path d="M16 16 l16 16 M32 16 l-16 16" stroke="${P.blanco}" stroke-width="5" stroke-linecap="round"/>
  `);
}
function btnGraySVG() {
  return svg(48, 48, `
    <rect x="1.5" y="1.5" width="45" height="45" rx="14" fill="${P.gris}" stroke="${P.marino}" stroke-width="3"/>
    <path d="M6 14 a10 10 0 0 1 10 -9 h16 a10 10 0 0 1 10 9 z" fill="#6a7077" opacity="0.6"/>
  `);
}

async function buildUI2() {
  mkdirSync(`${OUT}/ui`, { recursive: true });
  const out = {
    retrato: retratoSVG(),
    retrato_pulgar: retratoPulgarSVG(),
    star_on: starSVG(true),
    star_off: starSVG(false),
    bar_bg: barBgSVG(),
    bar_fill: barFillSVG(),
    btn_red_x: btnRedXSVG(),
    btn_gray: btnGraySVG(),
  };
  for (const n of Object.keys(ICONS)) out[`icon_${n}`] = iconSVG(n);
  for (const [file, body] of Object.entries(out)) {
    await sharp(Buffer.from(body)).png().toFile(`${OUT}/ui/${file}.png`);
  }
}

// ---------- Menú: logo, fondo y miniaturas ----------
const FONT = `font-family="'Arial Black', Arial, 'DejaVu Sans', sans-serif" font-weight="900"`;

function mosquitoSVG(x, y, s) {
  // Mosquito cartoon centrado en (0,0) escalado s, dentro de un grupo trasladado.
  const o = O2(2.2);
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <!-- alas -->
    <ellipse cx="-4" cy="-16" rx="22" ry="8" fill="${P.celeste}" opacity="0.6" ${o} transform="rotate(-35 -4 -16)"/>
    <ellipse cx="20" cy="-14" rx="22" ry="8" fill="${P.celeste}" opacity="0.6" ${o} transform="rotate(25 20 -14)"/>
    <!-- patas -->
    <path d="M-6 8 l-10 10 l-6 12 M6 10 l-2 14 l-8 8 M16 8 l10 10 l4 12" fill="none" stroke="${P.linea}" stroke-width="2.4" stroke-linecap="round"/>
    <!-- abdomen -->
    <path d="M-2 4 l-28 12 a5 5 0 0 0 4 8 l26 -6 z" fill="#3a3f44" ${o}/>
    <path d="M-10 9 l-4 6 M-17 12 l-4 5" stroke="${P.linea}" stroke-width="2"/>
    <!-- tórax -->
    <ellipse cx="6" cy="2" rx="13" ry="10" fill="#4a4f55" ${o}/>
    <!-- cabeza -->
    <circle cx="24" cy="0" r="11" fill="#4a4f55" ${o}/>
    <!-- ojos grandes -->
    <circle cx="22" cy="-3" r="5.5" fill="${P.blanco}" ${o}/>
    <circle cx="30" cy="-3" r="4.2" fill="${P.blanco}" ${o}/>
    <circle cx="23" cy="-2.5" r="2.6" fill="${P.linea}"/>
    <circle cx="31" cy="-2.5" r="2" fill="${P.linea}"/>
    <!-- probóscide -->
    <path d="M32 5 l20 14" fill="none" stroke="${P.linea}" stroke-width="5" stroke-linecap="round"/>
    <path d="M32 5 l20 14" fill="none" stroke="#8a9096" stroke-width="2.2" stroke-linecap="round"/>
  </g>`;
}

function noSignSVG(x, y, r) {
  return `
    <circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${P.linea}" stroke-width="${r * 0.36}"/>
    <path d="M${x - r * 0.68} ${y - r * 0.68} L${x + r * 0.68} ${y + r * 0.68}" stroke="${P.linea}" stroke-width="${r * 0.36}" stroke-linecap="round"/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#e53935" stroke-width="${r * 0.22}"/>
    <path d="M${x - r * 0.68} ${y - r * 0.68} L${x + r * 0.68} ${y + r * 0.68}" stroke="#e53935" stroke-width="${r * 0.22}" stroke-linecap="round"/>
  `;
}

function logoSVG() {
  const W0 = 640, H0 = 300;
  const t = (txt, x, y, size, fill, stroke, sw, extra = '') =>
    `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" ${FONT} fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" paint-order="stroke" ${extra}>${txt}</text>`;
  // DENGUE con arco leve: cada letra con su propio offset vertical y rotación
  const letters = 'DENGUE'.split('');
  const dengue = (fill, stroke, sw, dy = 0) =>
    letters.map((ch, i) => {
      const u = (i - 2.5) / 2.5; // -1..1
      const x = 165 + i * 80, y = 148 + 14 * u * u + dy, rot = u * 6;
      return `<text x="${x}" y="${y}" text-anchor="middle" font-size="106" ${FONT} fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" paint-order="stroke" transform="rotate(${rot} ${x} ${y})">${ch}</text>`;
    }).join('');
  return svg(W0, H0, `
    <defs>
      <linearGradient id="gy" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffe27a"/><stop offset="0.45" stop-color="${P.amarillo}"/><stop offset="1" stop-color="#f0932b"/>
      </linearGradient>
      <linearGradient id="gb" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#5a9cf5"/><stop offset="1" stop-color="${P.azulGorra}"/>
      </linearGradient>
    </defs>
    <g transform="rotate(-3 350 150)">
      <!-- sombra -->
      ${dengue('rgba(0,0,0,0.35)', 'rgba(0,0,0,0.35)', 14, 8)}
      ${dengue('url(#gy)', P.linea, 12)}
      ${t('INVADERS', 330, 250, 60, 'url(#gb)', P.linea, 10, 'letter-spacing="6"')}
      ${t('2D', 590, 250, 40, P.blanco, P.linea, 8)}
    </g>
    <!-- El lema "¡Juntos contra el dengue!" ya no va horneado: lo dibuja MenuScene con i18n. -->
    ${mosquitoSVG(62, 56, 0.85)}
    ${noSignSVG(68, 56, 46)}
  `);
}

// Barrio top-down estilizado. seed varía disposición; opts.small = casas pequeñas y menos árboles
function neighborhoodSVG(w, h, seed, opts = {}) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const g = [];
  const grass = opts.grass || P.verde;
  g.push(`<rect width="${w}" height="${h}" fill="${grass}"/>`);
  const block = opts.block || 160, road = opts.road || 34;
  // manzanas más oscuras
  for (let y = -block / 2; y < h; y += block) {
    for (let x = -block / 2; x < w; x += block) {
      const shade = rnd() < 0.5 ? '#52b434' : (opts.dry || '#7fc84a');
      g.push(`<rect x="${x + road / 2}" y="${y + road / 2}" width="${block - road}" height="${block - road}" fill="${shade}"/>`);
    }
  }
  // calles
  for (let x = -block / 2; x < w + block; x += block) {
    g.push(`<rect x="${x - road / 2}" y="0" width="${road}" height="${h}" fill="${P.gris}"/>`);
    g.push(`<rect x="${x - road / 2 - 5}" y="0" width="5" height="${h}" fill="#cfd3d6"/><rect x="${x + road / 2}" y="0" width="5" height="${h}" fill="#cfd3d6"/>`);
    g.push(`<path d="M${x} 0 V${h}" stroke="${P.amarillo}" stroke-width="3" stroke-dasharray="14 12"/>`);
  }
  for (let y = -block / 2; y < h + block; y += block) {
    g.push(`<rect x="0" y="${y - road / 2}" width="${w}" height="${road}" fill="${P.gris}"/>`);
    g.push(`<rect x="0" y="${y - road / 2 - 5}" width="${w}" height="5" fill="#cfd3d6"/><rect x="0" y="${y + road / 2}" width="${w}" height="5" fill="#cfd3d6"/>`);
    g.push(`<path d="M0 ${y} H${w}" stroke="${P.amarillo}" stroke-width="3" stroke-dasharray="14 12"/>`);
  }
  // casas y árboles por manzana
  const o = O2(1.6);
  for (let y = -block / 2; y < h; y += block) {
    for (let x = -block / 2; x < w; x += block) {
      const bx = x + road / 2 + 10, by = y + road / 2 + 10, bw = block - road - 20;
      const n = opts.small ? 3 : 2;
      const hs = Math.min(opts.small ? 22 : 40, (bw / n) * 0.8);
      for (let i = 0; i < n * n; i++) {
        if (rnd() < (opts.small ? 0.12 : 0.2)) continue;
        const cx = bx + (i % n) * (bw / n) + rnd() * (bw / n - hs), cy = by + Math.floor(i / n) * (bw / n) + rnd() * (bw / n - hs);
        const roof = rnd() < 0.7 ? P.teja : '#d5602e';
        g.push(`<rect x="${cx + 3}" y="${cy + 4}" width="${hs}" height="${hs * 0.8}" fill="rgba(0,0,0,0.25)"/>`);
        g.push(`<rect x="${cx}" y="${cy}" width="${hs}" height="${hs * 0.8}" fill="${roof}" ${o}/>`);
        g.push(`<path d="M${cx} ${cy + hs * 0.4} h${hs}" stroke="${P.tejaOscura}" stroke-width="2.5"/>`);
      }
      const trees = opts.small ? 1 : 3;
      for (let i = 0; i < trees; i++) {
        if (rnd() < 0.3) continue;
        const cx = bx + rnd() * bw, cy = by + rnd() * bw, r = 9 + rnd() * 8;
        g.push(`<circle cx="${cx + 3}" cy="${cy + 4}" r="${r}" fill="rgba(0,0,0,0.25)"/>`);
        g.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${P.verdeOscuro}" ${o}/>`);
        g.push(`<circle cx="${cx - r * 0.3}" cy="${cy - r * 0.3}" r="${r * 0.5}" fill="${P.verde}"/>`);
      }
    }
  }
  return g.join('');
}

async function buildMenu() {
  mkdirSync(`${OUT}/img`, { recursive: true });
  await sharp(Buffer.from(logoSVG())).png().toFile(`${OUT}/img/logo.png`);

  // Fondo del menú: barrio desenfocado + velo celeste 15%
  const bg = await sharp(Buffer.from(svg(960, 540, neighborhoodSVG(960, 540, 42)))).png().blur(2).toBuffer();
  const veil = Buffer.from(svg(960, 540, `<rect width="960" height="540" fill="${P.celeste}" opacity="0.15"/>`));
  await sharp(bg).composite([{ input: veil }]).png().toFile(`${OUT}/img/menu_bg.png`);

  // Miniaturas de nivel (borde redondeado 8px)
  const thumb = async (file, body) => {
    const mask = Buffer.from(svg(256, 160, `<rect width="256" height="160" rx="8" fill="#fff"/>`));
    const img = await sharp(Buffer.from(svg(256, 160, body + `<rect x="1.5" y="1.5" width="253" height="157" rx="7" fill="none" stroke="${P.linea}" stroke-width="3"/>`))).png().toBuffer();
    await sharp(img).composite([{ input: mask, blend: 'dest-in' }]).png().toFile(`${OUT}/img/${file}.png`);
  };
  await thumb('level_equipetrol', neighborhoodSVG(256, 160, 7, { block: 110, road: 22 }));
  await thumb('level_plan3000', neighborhoodSVG(256, 160, 99, { block: 96, road: 18, small: true, grass: P.oliva, dry: '#b7c26a' }));
}

await buildUI2();
await buildMenu();
console.log('UI y menú generados');

// ============================================================================
// v3: especies de mosquito, rociador, ciclo de vida, insignias, íconos, niebla
// ============================================================================

// Rasgos por especie (vista dorsal). Colores planos, contorno P.linea.
const ESPECIES_V3 = {
  aegypti:    { cuerpo: '#23282e', torax: '#2c3238', rayas: true, lira: true,  linea: false, anillos: true,  manchas: false, tilt: 0,   escala: 1 },
  albopictus: { cuerpo: '#15191e', torax: '#1b2026', rayas: true, lira: false, linea: true,  anillos: true,  manchas: false, tilt: 0,   escala: 1 },
  culex:      { cuerpo: '#b08a5a', torax: '#c39a66', rayas: false, lira: false, linea: false, anillos: false, manchas: false, tilt: 0,   escala: 1.08 },
  anopheles:  { cuerpo: '#6b5238', torax: '#7a5f42', rayas: false, lira: false, linea: false, anillos: false, manchas: true,  tilt: -38, escala: 1 },
};

// Ilustración de ficha 128×128: cabeza arriba, abdomen abajo, alas a los lados.
function especieSVG(id) {
  const e = ESPECIES_V3[id];
  const o = O2(2);
  const g = [];
  const legLine = `fill="none" stroke="${P.linea}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
  const ringLine = `fill="none" stroke="${P.blanco}" stroke-width="1.7" stroke-linecap="butt" stroke-dasharray="3.5 4.5" stroke-dashoffset="2"`;
  // Patas (3 pares), simétricas
  const legs = [
    'M52 50 l-16 -12 l-6 -18', 'M76 50 l16 -12 l6 -18',           // delanteras
    'M50 58 l-22 4 l-10 16',   'M78 58 l22 4 l10 16',             // medias
    'M52 66 l-14 20 l-2 22',   'M76 66 l14 20 l2 22',             // traseras
  ];
  for (const d of legs) g.push(`<path d="${d}" ${legLine}/>`);
  if (e.anillos) for (const d of legs) g.push(`<path d="${d}" ${ringLine}/>`);

  // Alas celestes translúcidas
  const wing = (sx) => {
    const cx = 64 + sx * 27, cy = 82;
    let s = `<ellipse cx="${cx}" cy="${cy}" rx="9.5" ry="30" fill="${P.celeste}" fill-opacity="0.62" ${o} transform="rotate(${sx * 22} ${cx} ${cy})"/>`;
    s += `<path d="M${cx} ${cy - 26} v52" stroke="${P.blanco}" stroke-width="1.4" opacity="0.6" transform="rotate(${sx * 22} ${cx} ${cy})"/>`;
    if (e.manchas) {
      // Manchas claras y oscuras a lo largo del ala (Anopheles)
      const spots = [[-3, -20, '#3d2c1c'], [3, -12, '#f6e7c9'], [-2, -3, '#3d2c1c'], [3, 6, '#f6e7c9'], [-3, 14, '#3d2c1c'], [2, 22, '#f6e7c9']];
      for (const [dx, dy, c] of spots) s += `<ellipse cx="${cx + dx}" cy="${cy + dy}" rx="4.2" ry="3" fill="${c}" opacity="0.95" transform="rotate(${sx * 22} ${cx} ${cy})"/>`;
    }
    return s;
  };
  g.push(wing(-1), wing(1));

  // Abdomen (afinado hacia abajo) con segmentos
  g.push(`<path d="M55 62 q9 -4 18 0 l3 14 q-3 22 -12 38 q-9 -16 -12 -38 z" fill="${e.cuerpo}" ${o}/>`);
  const segY = [70, 79, 88, 97, 105];
  for (const y of segY) {
    const halfW = 11 - (y - 62) * 0.19;
    g.push(`<path d="M${64 - halfW} ${y} h${halfW * 2}" stroke="${P.linea}" stroke-width="1.6"/>`);
    if (e.rayas) g.push(`<path d="M${64 - halfW + 0.8} ${y + 2.2} h${halfW * 2 - 1.6}" stroke="${P.blanco}" stroke-width="2.6"/>`);
  }
  // Tórax
  g.push(`<ellipse cx="64" cy="52" rx="14" ry="13" fill="${e.torax}" ${o}/>`);
  if (e.lira) {
    // Lira blanca: dos curvas laterales + dos líneas centrales
    g.push(`<path d="M55 42 q-6 10 0 20" fill="none" stroke="${P.blanco}" stroke-width="3" stroke-linecap="round"/>`);
    g.push(`<path d="M73 42 q6 10 0 20" fill="none" stroke="${P.blanco}" stroke-width="3" stroke-linecap="round"/>`);
    g.push(`<path d="M61 45 v15 M67 45 v15" stroke="${P.blanco}" stroke-width="2" stroke-linecap="round"/>`);
  }
  if (e.linea) g.push(`<path d="M64 41 v22" stroke="${P.blanco}" stroke-width="3" stroke-linecap="round"/>`);
  if (e.rayas && e.anillos) {
    // Puntos blancos en los lados del tórax (Aedes)
    g.push(`<circle cx="52" cy="54" r="1.8" fill="${P.blanco}"/><circle cx="76" cy="54" r="1.8" fill="${P.blanco}"/>`);
  }
  // Cabeza con ojos grandes
  g.push(`<circle cx="64" cy="33" r="10.5" fill="${e.torax}" ${o}/>`);
  g.push(`<circle cx="58" cy="32" r="5.6" fill="${P.blanco}" ${o}/>`);
  g.push(`<circle cx="70" cy="32" r="5.6" fill="${P.blanco}" ${o}/>`);
  g.push(`<circle cx="58.5" cy="31" r="2.8" fill="${P.linea}"/><circle cx="70.5" cy="31" r="2.8" fill="${P.linea}"/>`);
  g.push(`<circle cx="57.5" cy="30" r="0.9" fill="${P.blanco}"/><circle cx="69.5" cy="30" r="0.9" fill="${P.blanco}"/>`);
  // Antenas
  g.push(`<path d="M59 25 q-4 -6 -9 -8 M69 25 q4 -6 9 -8" fill="none" stroke="${P.linea}" stroke-width="1.8" stroke-linecap="round"/>`);
  // Probóscide (y palpos largos en Anopheles)
  if (e.manchas) g.push(`<path d="M61 24 l-3 -17 M67 24 l3 -17" fill="none" stroke="${P.linea}" stroke-width="2.2" stroke-linecap="round"/>`);
  g.push(`<path d="M64 24 v-18" fill="none" stroke="${P.linea}" stroke-width="4.6" stroke-linecap="round"/>`);
  g.push(`<path d="M64 24 v-18" fill="none" stroke="#8a9096" stroke-width="2" stroke-linecap="round"/>`);

  const body = `<g transform="translate(64 64) scale(${e.escala}) rotate(${e.tilt}) translate(-64 -64)">${g.join('')}</g>`;
  return svg(128, 128, body);
}

// Versión mini 24×24 para enjambres: silueta reconocible por color y rayas.
function especieMiniSVG(id) {
  const e = ESPECIES_V3[id];
  const g = [];
  g.push(`<path d="M9 8 l-5 -4 M15 8 l5 -4 M8 12 l-6 1 M16 12 l6 1 M9 15 l-4 6 M15 15 l4 6" fill="none" stroke="${P.linea}" stroke-width="1.4" stroke-linecap="round"/>`);
  g.push(`<ellipse cx="7" cy="14" rx="3" ry="7" fill="${P.celeste}" opacity="0.75" transform="rotate(-22 7 14)"/>`);
  g.push(`<ellipse cx="17" cy="14" rx="3" ry="7" fill="${P.celeste}" opacity="0.75" transform="rotate(22 17 14)"/>`);
  if (e.manchas) {
    g.push(`<circle cx="6.5" cy="12" r="1.1" fill="#3d2c1c"/><circle cx="17.5" cy="12" r="1.1" fill="#3d2c1c"/><circle cx="7.5" cy="17" r="1.1" fill="#3d2c1c"/><circle cx="16.5" cy="17" r="1.1" fill="#3d2c1c"/>`);
  }
  g.push(`<path d="M9.5 11 h5 l-0.5 4 q-2 7 -2 7 q-2 -7 -2 -7 z" fill="${e.cuerpo}" stroke="${P.linea}" stroke-width="1.2" stroke-linejoin="round"/>`);
  if (e.rayas) g.push(`<path d="M9.8 14 h4.4 M10.4 17.5 h3.2" stroke="${P.blanco}" stroke-width="1.2"/>`);
  g.push(`<ellipse cx="12" cy="9.5" rx="3.6" ry="3.2" fill="${e.torax}" stroke="${P.linea}" stroke-width="1.2"/>`);
  if (e.lira) g.push(`<path d="M10.2 7.8 q-1 1.7 0 3.4 M13.8 7.8 q1 1.7 0 3.4" fill="none" stroke="${P.blanco}" stroke-width="1"/>`);
  if (e.linea) g.push(`<path d="M12 7 v5" stroke="${P.blanco}" stroke-width="1.2"/>`);
  g.push(`<circle cx="12" cy="5" r="2.6" fill="${e.torax}" stroke="${P.linea}" stroke-width="1.2"/>`);
  g.push(`<circle cx="10.8" cy="4.6" r="1" fill="${P.blanco}"/><circle cx="13.2" cy="4.6" r="1" fill="${P.blanco}"/>`);
  g.push(`<path d="M12 2.6 v-2" stroke="${P.linea}" stroke-width="1.4" stroke-linecap="round"/>`);
  const body = e.tilt ? `<g transform="rotate(${e.tilt} 12 12)">${g.join('')}</g>` : g.join('');
  return svg(24, 24, body);
}

// Rociador de mano 40×24 (apunta a la derecha)
function rociadorSVG() {
  const o = O2(1.6);
  return svg(40, 24, `
    <path d="M4 20 q-2 -9 5 -12" fill="none" stroke="${P.linea}" stroke-width="4" stroke-linecap="round"/>
    <path d="M4 20 q-2 -9 5 -12" fill="none" stroke="${P.grisClaro}" stroke-width="2" stroke-linecap="round"/>
    <rect x="7" y="7" width="20" height="12" rx="4" fill="${P.gris}" ${o}/>
    <rect x="10" y="9" width="10" height="3" rx="1.5" fill="${P.grisClaro}" stroke="none"/>
    <rect x="12" y="17" width="8" height="6" rx="2" fill="${P.marino}" ${o}/>
    <rect x="26" y="9" width="6" height="8" rx="1.5" fill="${P.grisClaro}" ${o}/>
    <path d="M31 10 h6 a2 2 0 0 1 2 2 v2 a2 2 0 0 1 -2 2 h-6 z" fill="${P.teja}" ${o}/>
    <circle cx="37" cy="13" r="1" fill="${P.linea}"/>
  `);
}

// Ciclo de vida: 4 íconos 64×64 sobre fondo circular celeste
function cicloSVG(etapa) {
  const o = O2(1.6);
  const fondo = `<circle cx="32" cy="32" r="29" fill="${P.celeste}" stroke="${P.linea}" stroke-width="2.4"/>`;
  let body = '';
  const agua = `<path d="M6 38 q6 -4 13 0 t13 0 t13 0 t13 0 v24 h-52 z" fill="${P.aguaSucia}" opacity="0.85"/><path d="M6 38 q6 -4 13 0 t13 0 t13 0 t13 0" fill="none" stroke="${P.blanco}" stroke-width="1.8" opacity="0.7"/>`;
  switch (etapa) {
    case 'huevo': {
      const eggs = [[22, 33], [29, 30], [36, 30], [43, 33], [26, 38], [33, 36], [40, 38]];
      body = agua + eggs.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3.2" ry="4.6" fill="#15191e" ${o}/>`).join('');
      break;
    }
    case 'larva':
      body = agua +
        `<path d="M32 36 q0 8 -4 14 q-3 4 -8 2" fill="none" stroke="${P.linea}" stroke-width="9" stroke-linecap="round"/>` +
        `<path d="M32 36 q0 8 -4 14 q-3 4 -8 2" fill="none" stroke="#c9b27a" stroke-width="6" stroke-linecap="round"/>` +
        `<path d="M32 34 v-6" stroke="${P.linea}" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M30 41 h4 M28 46 h4 M25 51 h4" stroke="${P.linea}" stroke-width="1.4" stroke-linecap="round"/>` +
        `<circle cx="20" cy="52" r="1.4" fill="${P.linea}"/>`;
      break;
    case 'pupa':
      body = agua +
        `<path d="M30 30 a10 10 0 1 1 10 12 q-4 2 -6 10 q-2 6 -8 6" fill="none" stroke="${P.linea}" stroke-width="10" stroke-linecap="round"/>` +
        `<path d="M30 30 a10 10 0 1 1 10 12 q-4 2 -6 10 q-2 6 -8 6" fill="none" stroke="#b39a62" stroke-width="7" stroke-linecap="round"/>` +
        `<circle cx="36" cy="35" r="7.5" fill="#c9b27a" ${o}/>` +
        `<path d="M32 28 l-3 -6 M40 28 l3 -6" stroke="${P.linea}" stroke-width="2" stroke-linecap="round"/>` +
        `<circle cx="34" cy="34" r="1.6" fill="${P.linea}"/>`;
      break;
    case 'adulto':
      body = `<g transform="translate(32 34) scale(0.36) translate(-64 -64)">${especieSVG('aegypti').replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>`;
      break;
  }
  return svg(64, 64, `<clipPath id="cc"><circle cx="32" cy="32" r="28"/></clipPath>${fondo}<g clip-path="url(#cc)">${body}</g><circle cx="32" cy="32" r="29" fill="none" stroke="${P.linea}" stroke-width="2.4"/>`);
}

// Insignias 64×64: medalla dorada con cinta marina y símbolo blanco
function insigniaSVG(tipo) {
  const bloqueada = tipo === 'bloqueada';
  const oro = bloqueada ? '#9aa0a6' : P.amarillo;
  const borde = bloqueada ? '#5f656b' : '#d99a1a';
  const cinta = bloqueada ? '#6a7077' : P.marino;
  const W3 = `fill="none" stroke="${P.blanco}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"`;
  let sym = '';
  switch (tipo) {
    case 'explorador': // brújula
      sym = `<circle cx="32" cy="28" r="10" ${W3}/><path d="M36 24 l-2.5 6.5 l-6.5 2.5 l2.5 -6.5 z" fill="${P.blanco}"/><path d="M32 16 v2 M32 38 v2 M20 28 h2 M42 28 h2" ${W3}/>`;
      break;
    case 'detective': // lupa
      sym = `<circle cx="29" cy="25" r="8" ${W3}/><path d="M35 31 l7 7" stroke="${P.blanco}" stroke-width="4.5" stroke-linecap="round"/>`;
      break;
    case 'guardian': // escudo
      sym = `<path d="M32 16 l11 4 v9 c0 7 -5 11 -11 13 c-6 -2 -11 -6 -11 -13 v-9 z" fill="${P.blanco}"/><path d="M27 28 l3.5 3.5 l7 -7" fill="none" stroke="${oro}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`;
      break;
    case 'fotografo': // cámara
      sym = `<path d="M27 20 l2 -3 h6 l2 3 h4 a2 2 0 0 1 2 2 v11 a2 2 0 0 1 -2 2 h-18 a2 2 0 0 1 -2 -2 v-11 a2 2 0 0 1 2 -2 z" ${W3}/><circle cx="32" cy="27.5" r="4" ${W3}/>`;
      break;
    default: // candado
      sym = `<rect x="25" y="26" width="14" height="11" rx="2" fill="${P.blanco}"/><path d="M27.5 26 v-4 a4.5 4.5 0 0 1 9 0 v4" ${W3}/>`;
  }
  return svg(64, 64, `
    <path d="M22 40 l-4 20 l8 -4 l6 6 l4 -16 z" fill="${cinta}" ${O2(1.6)}/>
    <path d="M42 40 l4 20 l-8 -4 l-6 6 l-4 -16 z" fill="${cinta}" ${O2(1.6)}/>
    <circle cx="32" cy="28" r="22" fill="${borde}" ${O2(1.6)}/>
    <circle cx="32" cy="28" r="17" fill="${oro}" stroke="${bloqueada ? '#7a8188' : '#ffe27a'}" stroke-width="1.6"/>
    ${sym}
  `);
}

// Íconos blancos v3
const W3b = `fill="none" stroke="${P.blanco}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
function iconCameraBigSVG() {
  return svg(56, 56, `
    <path d="M20 16 l4 -6 h8 l4 6 h9 a4 4 0 0 1 4 4 v20 a4 4 0 0 1 -4 4 h-34 a4 4 0 0 1 -4 -4 v-20 a4 4 0 0 1 4 -4 z" ${W3b}/>
    <circle cx="28" cy="29" r="8" ${W3b}/><circle cx="28" cy="29" r="3" fill="${P.blanco}"/>
    <circle cx="43" cy="22" r="1.8" fill="${P.blanco}"/>
  `);
}
function iconLibrarySVG() {
  return svg(40, 40, `
    <path d="M20 12 c-3 -3 -8 -3 -13 -2 v21 c5 -1 10 -1 13 2 c3 -3 8 -3 13 -2 v-21 c-5 -1 -10 -1 -13 2 z" fill="${P.blanco}" fill-opacity="0.18" stroke="${P.blanco}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M20 12 v21" ${W3b}/>
    <path d="M11 16 h5 M11 21 h5 M11 26 h4 M24 16 h5 M24 21 h5 M24 26 h4" stroke="${P.blanco}" stroke-width="2" stroke-linecap="round"/>
  `);
}
function iconLangSVG() {
  return svg(40, 40, `
    <circle cx="20" cy="20" r="14" ${W3b}/>
    <ellipse cx="20" cy="20" rx="6" ry="14" ${W3b}/>
    <path d="M6 20 h28 M8 13 h24 M8 27 h24" stroke="${P.blanco}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="29" cy="29" r="9" fill="${P.marino}" stroke="${P.blanco}" stroke-width="2.4"/>
    <text x="29" y="33.5" text-anchor="middle" font-family="Arial, Helvetica, 'DejaVu Sans', sans-serif" font-weight="bold" font-size="12" fill="${P.blanco}">A</text>
  `);
}
const WT = `fill="none" stroke="${P.blanco}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"`;
const TABS = {
  mosquito: `<ellipse cx="9" cy="19" rx="3.2" ry="8" fill="${P.blanco}" fill-opacity="0.45" transform="rotate(-20 9 19)"/><ellipse cx="23" cy="19" rx="3.2" ry="8" fill="${P.blanco}" fill-opacity="0.45" transform="rotate(20 23 19)"/><path d="M13 13 l-7 -5 M19 13 l7 -5 M13 18 l-7 8 M19 18 l7 8" ${WT}/><path d="M13 14 h6 l-0.5 4 q-2.5 11 -2.5 11 q-2.5 -11 -2.5 -11 z" fill="${P.blanco}"/><circle cx="16" cy="12" r="4.2" fill="${P.blanco}"/><circle cx="16" cy="6.5" r="3" fill="${P.blanco}"/><path d="M16 3.5 v-2.5" ${WT}/>`,
  ciclo: `<path d="M24 12 a9 9 0 1 0 2 8" ${WT}/><path d="M26 6 v7 h-7" ${WT}/><path d="M6 20 a9 9 0 1 0 2 -8" ${WT} opacity="0"/>`,
  sintomas: `<rect x="12" y="4" width="8" height="18" rx="4" ${WT}/><circle cx="16" cy="24" r="4.5" fill="${P.blanco}"/><rect x="14.5" y="12" width="3" height="10" fill="${P.blanco}"/><path d="M22 8 h3 M22 12 h3 M22 16 h3" ${WT}/>`,
  prevencion: `<path d="M8 13 h16 l-2 14 h-12 z" ${WT}/><path d="M10 13 a6 6 0 0 1 12 0" ${WT}/><path d="M9 18 h14" stroke="${P.blanco}" stroke-width="1.6"/><path d="M26 6 l-4 6" ${WT}/><path d="M22 12 l-2 2 l2 2 l2 -2 z" fill="${P.blanco}" stroke="${P.blanco}" stroke-width="2.4" stroke-linejoin="round"/>`,
  mitos: `<path d="M10 12 a6 6 0 1 1 8 5.6 c-1.5 0.6 -2 1.6 -2 3.4" fill="none" stroke="${P.blanco}" stroke-width="3.4" stroke-linecap="round"/><circle cx="16" cy="26" r="2.2" fill="${P.blanco}"/>`,
};
const tabSVG = (n) => svg(32, 32, TABS[n]);

// Niebla difusa 48×48 (alpha radial)
function nieblaSVG() {
  return svg(48, 48, `
    <defs><radialGradient id="ng" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.95"/>
      <stop offset="0.45" stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient></defs>
    <circle cx="24" cy="24" r="24" fill="url(#ng)"/>
    <circle cx="17" cy="20" r="9" fill="#ffffff" opacity="0.25"/>
    <circle cx="30" cy="27" r="8" fill="#ffffff" opacity="0.2"/>
  `);
}

async function buildV3() {
  const out = {};
  for (const id of Object.keys(ESPECIES_V3)) {
    out[`sprites/mosq_${id}`] = especieSVG(id);
    out[`sprites/mosq_${id}_mini`] = especieMiniSVG(id);
  }
  out['sprites/rociador'] = rociadorSVG();
  out['sprites/niebla'] = nieblaSVG();
  for (const e of ['huevo', 'larva', 'pupa', 'adulto']) out[`ui/ciclo_${e}`] = cicloSVG(e);
  for (const t of ['explorador', 'detective', 'guardian', 'fotografo', 'bloqueada']) out[`ui/insignia_${t}`] = insigniaSVG(t);
  out['ui/icon_camera_big'] = iconCameraBigSVG();
  out['ui/icon_library'] = iconLibrarySVG();
  out['ui/icon_lang'] = iconLangSVG();
  for (const t of Object.keys(TABS)) out[`ui/tab_${t}`] = tabSVG(t);
  for (const [file, body] of Object.entries(out)) {
    await sharp(Buffer.from(body)).png().toFile(`${OUT}/${file}.png`);
  }
  return Object.keys(out);
}

const v3Files = await buildV3();
console.log('Assets v3 generados:', v3Files.length);
