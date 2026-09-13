#!/usr/bin/env node
// Genera src/levels/equipetrol.json: barrio ficticio inspirado en Equipetrol.
// Uso: npm run gen:level
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../src/levels/equipetrol.json');

const W = 40, H = 30, T = 64;

const GROUND_NAMES = new Set([
  'pasto', 'pasto_oscuro', 'pasto_seco', 'calle', 'calle_linea', 'calle_linea_v',
  'cruce', 'cruce_v', 'vereda', 'vereda_borde', 'tierra', 'esquina',
]);

// Calles de 2 tiles: pares [inicio, fin] inclusive
const H_ROADS = [[4, 5], [14, 15], [24, 25]];
const V_ROADS = [[6, 7], [19, 20], [32, 33]];

// RNG determinista (mulberry32)
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20260913);

const inRange = (v, [a, b]) => v >= a && v <= b;
const isHRoad = (y) => H_ROADS.some((r) => inRange(y, r));
const isVRoad = (x) => V_ROADS.some((r) => inRange(x, r));
const isHSide = (y) => H_ROADS.some(([a, b]) => y === a - 1 || y === b + 1);
const isVSide = (x) => V_ROADS.some(([a, b]) => x === a - 1 || x === b + 1);
const isSouthBorde = (y) => H_ROADS.some(([, b]) => y === b + 1);

// ---------- Suelo ----------
const ground = [];
for (let y = 0; y < H; y++) {
  const row = [];
  for (let x = 0; x < W; x++) {
    let name;
    if (isHRoad(y) && isVRoad(x)) name = 'esquina';
    else if (isHRoad(y)) name = 'calle';
    else if (isVRoad(x)) name = 'calle';
    else if (isHSide(y) || isVSide(x)) name = isHSide(y) && isSouthBorde(y) ? 'vereda_borde' : 'vereda';
    else {
      const r = rand();
      name = r < 0.05 ? 'pasto_oscuro' : r < 0.1 ? 'pasto_seco' : 'pasto';
    }
    row.push(name);
  }
  ground.push(row);
}

// Línea amarilla discontinua (fila superior de la calle horizontal, columna izquierda de la vertical)
for (const [a] of H_ROADS) {
  for (let x = 0; x < W; x++) {
    if (!isVRoad(x) && x % 4 < 2) ground[a][x] = 'calle_linea';
  }
}
for (const [a] of V_ROADS) {
  for (let y = 0; y < H; y++) {
    if (!isHRoad(y) && y % 4 < 2) ground[y][a] = 'calle_linea_v';
  }
}

// Cruces peatonales a mitad de cada tramo
function segments(size, roads) {
  const segs = [];
  let start = 0;
  for (const [a, b] of roads) {
    if (a - 1 >= start) segs.push([start, a - 1]);
    start = b + 1;
  }
  if (start <= size - 1) segs.push([start, size - 1]);
  return segs;
}
for (const [a, b] of H_ROADS) {
  for (const [s, e] of segments(W, V_ROADS)) {
    const mid = Math.floor((s + e) / 2);
    ground[a][mid] = 'cruce';
    ground[b][mid] = 'cruce';
  }
}
for (const [a, b] of V_ROADS) {
  for (const [s, e] of segments(H, H_ROADS)) {
    const mid = Math.floor((s + e) / 2);
    ground[mid][a] = 'cruce_v';
    ground[mid][b] = 'cruce_v';
  }
}

// ---------- Manzanas ----------
// Interior de cada manzana (sin veredas)
const rowBands = segments(H, H_ROADS.map(([a, b]) => [a - 1, b + 1]));
const colBands = segments(W, V_ROADS.map(([a, b]) => [a - 1, b + 1]));

const blocks = [];
for (const [y0, y1] of rowBands) {
  for (const [x0, x1] of colBands) {
    blocks.push({ x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
}
// Plaza: manzana central de la banda superior completa (2.ª fila de manzanas, 2.ª columna)
const PLAZA_INDEX = 1 * colBands.length + 1;

const objects = [];
const occupied = new Set(); // tiles ocupados por objetos (para no solapar)
const key = (x, y) => `${x},${y}`;
const occ = (x, y) => occupied.has(key(x, y));
const take = (x, y) => occupied.add(key(x, y));
const cx = (tx) => tx * T + T / 2;
const cy = (ty) => ty * T + T / 2;

let houseToggle = 0;
function addHouse(tx, ty) {
  // casa 2×2 tiles, (tx,ty) = esquina superior izquierda
  const type = houseToggle++ % 2 === 0 ? 'casa_a' : 'casa_b';
  for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) take(tx + dx, ty + dy);
  const x = (tx + 1) * T, y = (ty + 1) * T;
  objects.push({ type, x, y });
  if (rand() < 0.4) {
    const sx = rand() < 0.5 ? -1 : 1;
    objects.push({ type: 'tanque_techo', x: x + sx * 36, y: y - 36 });
  }
  return { type, tx, ty };
}
function addTile(type, tx, ty) {
  if (occ(tx, ty)) return false;
  take(tx, ty);
  objects.push({ type, x: cx(tx), y: cy(ty) });
  return true;
}

const zones = [];
let manzanaN = 0;
// Tiles de patio reservados (etapa 3: aquí van los criaderos). Cada entrada: {tx, ty, block, hasGate}.
const patios = [];

blocks.forEach((b, i) => {
  const isPlaza = i === PLAZA_INDEX;
  zones.push({
    name: isPlaza ? 'Plaza' : `Manzana ${++manzanaN}`,
    x: b.x0 * T, y: b.y0 * T, w: b.w * T, h: b.h * T,
  });

  if (isPlaza) {
    // tierra en el centro, árboles alrededor del perímetro
    for (let y = b.y0 + 1; y <= b.y1 - 1; y++)
      for (let x = b.x0 + 2; x <= b.x1 - 2; x++) ground[y][x] = 'tierra';
    for (let x = b.x0; x <= b.x1; x += 2) { addTile('arbol', x, b.y0); addTile('arbol', x, b.y1); }
    for (let y = b.y0 + 2; y <= b.y1 - 2; y += 2) { addTile('arbol', b.x0, y); addTile('arbol', b.x1, y); }
    addTile('planta', b.x0 + 1, b.y0 + 2);
    addTile('planta', b.x1 - 1, b.y1 - 2);
    return;
  }

  // Orientación: manzanas altas (6 filas) miran al norte con jardín delantero + muro.
  // Manzanas bajas (3 filas): la del borde superior mira al sur, la del borde inferior al norte.
  let houseRow, patioRow, wallRow = -1, frontRow = -1, backGardenRow = -1;
  if (b.h >= 6) {
    frontRow = b.y0;       // árboles en esquinas / jardín
    wallRow = b.y0 + 1;    // muro + portón
    houseRow = b.y0 + 2;   // casa ocupa houseRow y houseRow+1
    patioRow = b.y0 + 4;   // patio trasero (criaderos etapa 3)
    backGardenRow = b.y0 + 5;
  } else if (b.y0 === 0) {
    patioRow = b.y0;       // patio hacia el borde del mapa
    houseRow = b.y0 + 1;   // frente hacia la vereda sur
  } else {
    houseRow = b.y0;       // frente hacia la vereda norte
    patioRow = b.y0 + 2;
  }

  // Casas en fila con 1 tile de jardín entre ellas, centradas en la manzana
  const maxHouses = Math.min(4, Math.floor((b.w + 1) / 3));
  const nHouses = Math.max(2, maxHouses);
  const used = nHouses * 2 + (nHouses - 1);
  const startX = b.x0 + Math.floor((b.w - used) / 2);
  const houses = [];
  for (let k = 0; k < nHouses; k++) {
    const tx = startX + k * 3;
    const h = addHouse(tx, houseRow);
    h.patio = [{ tx, ty: patioRow, block: i, hasGate: false }, { tx: tx + 1, ty: patioRow, block: i, hasGate: false }];
    houses.push(h);
    take(tx, patioRow); take(tx + 1, patioRow); // reservar patio trasero
    patios.push(...h.patio);
  }

  // Muros bajos con portón en el frente de ~60 % de las casas
  if (wallRow >= 0) {
    for (const h of houses) {
      if (rand() < 0.6) {
        for (const p of h.patio) p.hasGate = true;
        const gate = rand() < 0.5 ? 0 : 1;
        addTile(gate === 0 ? 'porton' : 'muro_h', h.tx, wallRow);
        addTile(gate === 1 ? 'porton' : 'muro_h', h.tx + 1, wallRow);
        // tramo lateral corto en el jardín contiguo
        if (h.tx - 1 >= b.x0 && !occ(h.tx - 1, wallRow) && rand() < 0.5) addTile('muro_v', h.tx - 1, houseRow);
      }
    }
  }

  // Árboles en las esquinas de manzana (si están libres)
  for (const [x, y] of [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]]) addTile('arbol', x, y);

  // Arbustos / plantas en jardines entre casas y en la franja trasera
  for (let k = 0; k < nHouses - 1; k++) {
    const gx = startX + k * 3 + 2;
    const gy = houseRow + (rand() < 0.5 ? 0 : 1);
    if (rand() < 0.7) addTile(rand() < 0.5 ? 'arbusto' : 'planta', gx, gy);
  }
  if (frontRow >= 0) {
    for (let x = b.x0 + 1; x < b.x1; x++) if (rand() < 0.2) addTile('arbusto', x, frontRow);
  }
  if (backGardenRow >= 0) {
    for (let x = b.x0 + 1; x < b.x1; x++) {
      const r = rand();
      if (r < 0.12) addTile('arbol', x, backGardenRow);
      else if (r < 0.3) addTile(rand() < 0.5 ? 'arbusto' : 'planta', x, backGardenRow);
    }
  }
});

// Spawn: sobre la vereda al sur de la plaza, centrado
const plaza = blocks[PLAZA_INDEX];
const spawn = { x: cx(Math.floor((plaza.x0 + plaza.x1) / 2)), y: cy(plaza.y1 + 1) };

// ---------- Criaderos (etapa 3) ----------
// 5 criaderos, uno de cada tipo, en tiles de patio de manzanas distintas.
// El primero es el más cercano al spawn (descubrimiento rápido); el resto se elige
// por muestreo de punto más lejano, para repartirlos en direcciones distintas.
const CRIADERO_TYPES = ['llanta', 'tanque', 'balde', 'botella', 'florero'];
const solidTiles = new Set(); // tiles cubiertos por objetos reales (casas 2×2, resto 1×1)
for (const o of objects) {
  const tx = Math.floor(o.x / T), ty = Math.floor(o.y / T);
  if (o.type.startsWith('casa_')) {
    for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) solidTiles.add(key(tx + dx, ty + dy));
  } else if (o.type !== 'tanque_techo') {
    solidTiles.add(key(tx, ty));
  }
}
const freePatios = patios.filter((p) => !solidTiles.has(key(p.tx, p.ty)) && ground[p.ty][p.tx].startsWith('pasto'));
const dist = (p, x, y) => Math.hypot(cx(p.tx) - x, cy(p.ty) - y);
const chosen = [];
const usedBlocks = new Set();
const pick = (p) => { chosen.push(p); usedBlocks.add(p.block); };

// 1) el más cercano al spawn
pick(freePatios.reduce((best, p) => (dist(p, spawn.x, spawn.y) < dist(best, spawn.x, spawn.y) ? p : best)));

// 2..5) repartidos en direcciones distintas: a partir del ángulo del primero, se
// buscan objetivos cada 72° alrededor del spawn, a una distancia media (~12 tiles).
const angleOf = (p) => Math.atan2(cy(p.ty) - spawn.y, cx(p.tx) - spawn.x);
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const IDEAL = 12 * T;
const score = (p, target) => angDiff(angleOf(p), target) + 0.06 * Math.abs(dist(p, spawn.x, spawn.y) - IDEAL) / T;
const baseAngle = angleOf(chosen[0]);
for (let k = 1; k < CRIADERO_TYPES.length; k++) {
  const target = baseAngle + (k * 2 * Math.PI) / CRIADERO_TYPES.length;
  const cands = freePatios.filter((p) => !usedBlocks.has(p.block) && dist(p, spawn.x, spawn.y) >= 5 * T);
  pick(cands.reduce((best, p) => (score(p, target) < score(best, target) ? p : best)));
}
// Garantizar que al menos uno esté en el patio de una casa con portón (misión "Ayuda a la familia").
if (!chosen.some((p) => p.hasGate)) {
  const last = chosen.pop(); usedBlocks.delete(last.block);
  const target = baseAngle + ((CRIADERO_TYPES.length - 1) * 2 * Math.PI) / CRIADERO_TYPES.length;
  const cands = freePatios.filter((p) => p.hasGate && !usedBlocks.has(p.block) && dist(p, spawn.x, spawn.y) >= 5 * T);
  pick(cands.reduce((best, p) => (score(p, target) < score(best, target) ? p : best)));
}
// Ordenar por distancia al spawn y asignar tipos en orden fijo (llanta primero, como en el mockup).
chosen.sort((a, b) => dist(a, spawn.x, spawn.y) - dist(b, spawn.x, spawn.y));
const criaderos = chosen.map((p, i) => ({ type: CRIADERO_TYPES[i], x: cx(p.tx), y: cy(p.ty) }));
const familiaIdx = chosen.findIndex((p) => p.hasGate);
const mision_familia = { ...criaderos[familiaIdx] };

// ---------- Estación SEDES (v2) ----------
// Un tile libre de pasto o vereda, sin solapar objetos/patios, ni muy cerca ni muy lejos del
// spawn: reusa 'occ'/'solidTiles'/'patios' (las mismas estructuras de las secciones previas).
const ESTACION_MIN_DIST = 3 * T;
const ESTACION_MAX_DIST = 14 * T;
const isFreeGround = (tx, ty) => {
  if (tx < 0 || ty < 0 || tx >= W || ty >= H) return false;
  const g = ground[ty][tx];
  if (!(g.startsWith('pasto') || g.startsWith('vereda'))) return false;
  if (occ(tx, ty) || solidTiles.has(key(tx, ty))) return false;
  if (patios.some((p) => p.tx === tx && p.ty === ty)) return false;
  return true;
};
function buscarTileEstacion(minDist, maxDist) {
  let best = null, bestD = Infinity;
  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      if (!isFreeGround(tx, ty)) continue;
      const d = Math.hypot(cx(tx) - spawn.x, cy(ty) - spawn.y);
      if (d < minDist || d > maxDist) continue;
      if (d < bestD) { best = { tx, ty }; bestD = d; }
    }
  }
  return best;
}
// Preferido: cerca del spawn (esquina libre de la manzana de la Plaza o similar). Si no hay
// candidato en ese rango (mapa muy chico/denso), se relaja el máximo y luego el mínimo.
const estacionTile = buscarTileEstacion(ESTACION_MIN_DIST, ESTACION_MAX_DIST)
  || buscarTileEstacion(ESTACION_MIN_DIST, Infinity)
  || buscarTileEstacion(0, Infinity);
const estacion = estacionTile
  ? { x: cx(estacionTile.tx), y: cy(estacionTile.ty) }
  : { x: spawn.x, y: spawn.y }; // no debería ocurrir; la validación de abajo lo marcaría igual

const level = { name: 'Equipetrol', width: W, height: H, tile: T, ground, objects, spawn, zones, criaderos, mision_familia, estacion };

// ---------- Validación ----------
const errors = [];
if (ground.length !== H) errors.push(`ground tiene ${ground.length} filas (esperado ${H})`);
ground.forEach((row, y) => {
  if (row.length !== W) errors.push(`fila ${y} tiene ${row.length} tiles`);
  row.forEach((n, x) => { if (!GROUND_NAMES.has(n)) errors.push(`tile inválido '${n}' en (${x},${y})`); });
});
const houseRects = objects
  .filter((o) => o.type.startsWith('casa_'))
  .map((o) => ({ x0: o.x - 64, y0: o.y - 64, x1: o.x + 64, y1: o.y + 64 }));
houseRects.forEach((r, i) => {
  if (r.x0 < 0 || r.y0 < 0 || r.x1 > W * T || r.y1 > H * T) errors.push(`casa ${i} fuera del mapa`);
  for (let j = i + 1; j < houseRects.length; j++) {
    const s = houseRects[j];
    if (r.x0 < s.x1 && s.x0 < r.x1 && r.y0 < s.y1 && s.y0 < r.y1) errors.push(`casa ${i} solapa con casa ${j}`);
  }
  for (let ty = r.y0 / T; ty < r.y1 / T; ty++)
    for (let tx = r.x0 / T; tx < r.x1 / T; tx++) {
      const g = ground[ty][tx];
      if (!g.startsWith('pasto')) errors.push(`casa ${i} sobre '${g}' en (${tx},${ty})`);
    }
});
if (!ground[spawn.y / T | 0][spawn.x / T | 0].startsWith('vereda')) errors.push('spawn no está sobre vereda');
if (criaderos.length !== 5) errors.push(`hay ${criaderos.length} criaderos (esperado 5)`);
if (new Set(criaderos.map((c) => c.type)).size !== criaderos.length) errors.push('tipos de criadero repetidos');
if (new Set(chosen.map((p) => p.block)).size !== chosen.length) errors.push('dos criaderos en la misma manzana');
criaderos.forEach((c, i) => {
  const tx = Math.floor(c.x / T), ty = Math.floor(c.y / T);
  if (solidTiles.has(key(tx, ty))) errors.push(`criadero ${c.type} solapa con un objeto sólido en (${tx},${ty})`);
  if (!ground[ty][tx].startsWith('pasto')) errors.push(`criadero ${c.type} sobre '${ground[ty][tx]}'`);
  if (!patios.some((p) => p.tx === tx && p.ty === ty)) errors.push(`criadero ${c.type} fuera de un patio`);
  if (Math.hypot(c.x - spawn.x, c.y - spawn.y) < 2 * T) errors.push(`criadero ${c.type} demasiado cerca del spawn`);
  for (let j = i + 1; j < criaderos.length; j++)
    if (Math.hypot(c.x - criaderos[j].x, c.y - criaderos[j].y) < 4 * T) errors.push(`criaderos ${c.type} y ${criaderos[j].type} demasiado juntos`);
});
if (!criaderos.some((c) => c.x === mision_familia.x && c.y === mision_familia.y)) errors.push('mision_familia no apunta a un criadero');
if (!chosen[familiaIdx]?.hasGate) errors.push('mision_familia no está en el patio de una casa con portón');

const estTx = Math.floor(estacion.x / T), estTy = Math.floor(estacion.y / T);
if (estacion.x < 0 || estacion.y < 0 || estacion.x > W * T || estacion.y > H * T) errors.push('estación fuera del mapa');
const estGround = ground[estTy]?.[estTx];
if (!estGround || !(estGround.startsWith('pasto') || estGround.startsWith('vereda'))) errors.push(`estación sobre '${estGround}' (debe ser pasto o vereda)`);
if (occ(estTx, estTy) || solidTiles.has(key(estTx, estTy))) errors.push('estación solapa con un objeto existente');
if (patios.some((p) => p.tx === estTx && p.ty === estTy)) errors.push('estación solapa con un patio reservado');
if (Math.hypot(estacion.x - spawn.x, estacion.y - spawn.y) < 2 * T) errors.push('estación demasiado cerca del spawn');

// ---------- Salida ----------
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(level));

const SYM = {
  pasto: '.', pasto_oscuro: ',', pasto_seco: ':', calle: 'C', calle_linea: '=', calle_linea_v: '|',
  cruce: '#', cruce_v: '#', esquina: '+', vereda: 'v', vereda_borde: 'b', tierra: 'T',
};
console.log(ground.map((r) => r.map((n) => SYM[n]).join('')).join('\n'));
console.log('\nLeyenda: C calle  = / | línea  # cruce  + esquina  v vereda  b vereda_borde  . pasto  , oscuro  : seco  T tierra\n');

const counts = {};
for (const o of objects) counts[o.type] = (counts[o.type] || 0) + 1;
console.log('Objetos:', counts, `(total ${objects.length})`);
console.log('Zonas:', zones.map((z) => z.name).join(', '));
console.log('Spawn:', spawn);
console.log('Criaderos:', criaderos.map((c) => {
  const z = zones.find((zz) => c.x >= zz.x && c.x < zz.x + zz.w && c.y >= zz.y && c.y < zz.y + zz.h);
  return `${c.type}@(${c.x / T | 0},${c.y / T | 0}) ${z?.name} d=${Math.round(Math.hypot(c.x - spawn.x, c.y - spawn.y))}`;
}).join(' | '));
console.log('Misión familia:', mision_familia);
console.log('Estación:', estacion, `d=${Math.round(Math.hypot(estacion.x - spawn.x, estacion.y - spawn.y))}`);
console.log('Escrito:', OUT);

if (errors.length) {
  console.error('\nERRORES DE VALIDACIÓN:\n - ' + errors.join('\n - '));
  process.exit(1);
}
console.log('Validación OK');
