import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';

/**
 * Catálogo de objetos del nivel. `w,h` es el tamaño del sprite;
 * `box` es la caja de colisión {w,h,ox,oy} (offset desde la esquina superior izquierda del sprite).
 * `solid=false` → solo se dibuja. `top=true` → se dibuja por encima de todo (p. ej. sobre techos).
 */
export const OBJECT_DEFS = {
  casa_a: { w: 128, h: 128, solid: true, box: { w: 120, h: 88, ox: 4, oy: 36 }, color: PALETTE.teja },
  casa_b: { w: 128, h: 128, solid: true, box: { w: 120, h: 88, ox: 4, oy: 36 }, color: PALETTE.tejaOscura },
  arbol: { w: 64, h: 64, solid: true, box: { w: 30, h: 18, ox: 17, oy: 40 }, color: PALETTE.verdeOscuro },
  planta: { w: 64, h: 64, solid: false, color: PALETTE.verde },
  arbusto: { w: 48, h: 48, solid: true, box: { w: 36, h: 20, ox: 6, oy: 26 }, color: PALETTE.oliva },
  muro_h: { w: 64, h: 32, solid: true, box: { w: 64, h: 32, ox: 0, oy: 0 }, color: PALETTE.grisClaro },
  muro_v: { w: 32, h: 64, solid: true, box: { w: 32, h: 64, ox: 0, oy: 0 }, color: PALETTE.grisClaro },
  porton: { w: 64, h: 32, solid: true, box: { w: 64, h: 32, ox: 0, oy: 0 }, color: PALETTE.gris },
  tanque_techo: { w: 40, h: 40, solid: false, top: true, color: PALETTE.aguaSucia },
};

const TOP_DEPTH = 100000;

/**
 * Construye el nivel a partir del JSON generado por tools/gen-level.mjs.
 * @param {Phaser.Scene} scene
 * @param {{name:string,width:number,height:number,tile:number,ground:string[][],objects:{type:string,x:number,y:number}[],spawn:{x:number,y:number},zones:{name:string,x:number,y:number,w:number,h:number}[]}} level
 * @returns {{solids: Phaser.Physics.Arcade.StaticGroup, widthPx:number, heightPx:number, spawn:{x:number,y:number}, zones:Array}}
 */
export function buildLevel(scene, level) {
  const tile = level.tile || 64;
  const names = scene.cache.json.get('tilesMeta')?.names || [];
  const fallbackFrame = Math.max(0, names.indexOf('pasto'));
  const frameOf = (name) => {
    const i = names.indexOf(name);
    return i >= 0 ? i : fallbackFrame;
  };

  // Suelo: Blitter (un solo objeto de render, ideal para ~1200 tiles estáticos).
  const ground = scene.add.blitter(0, 0, 'tiles').setDepth(-1);
  const rows = level.ground || [];
  for (let y = 0; y < level.height; y++) {
    const row = rows[y] || [];
    for (let x = 0; x < level.width; x++) {
      ground.create(x * tile, y * tile, frameOf(row[x]));
    }
  }

  // Objetos
  const solids = scene.physics.add.staticGroup();
  for (const obj of level.objects || []) {
    const def = OBJECT_DEFS[obj.type];
    if (!def) { console.warn(`[LevelLoader] tipo desconocido: ${obj.type}`); continue; }
    const hasTex = scene.textures.exists(obj.type);
    const bottom = obj.y + def.h / 2;
    const depth = def.top ? TOP_DEPTH + bottom : bottom;

    if (def.solid) {
      let s;
      if (hasTex) {
        s = solids.create(obj.x, obj.y, obj.type);
      } else {
        s = scene.add.rectangle(obj.x, obj.y, def.w, def.h, hex(def.color)).setStrokeStyle(2, hex(PALETTE.linea));
        solids.add(s);
      }
      s.setDepth(depth);
      // Caja desde la esquina superior izquierda del sprite; solids.refresh() la recoloca al final.
      s.body.setSize(def.box.w, def.box.h, false);
      s.body.setOffset(def.box.ox, def.box.oy);
    } else if (hasTex) {
      scene.add.image(obj.x, obj.y, obj.type).setDepth(depth);
    } else {
      scene.add.rectangle(obj.x, obj.y, def.w, def.h, hex(def.color)).setStrokeStyle(2, hex(PALETTE.linea)).setDepth(depth);
    }
  }
  solids.refresh();

  return {
    solids,
    widthPx: level.width * tile,
    heightPx: level.height * tile,
    spawn: level.spawn || { x: (level.width * tile) / 2, y: (level.height * tile) / 2 },
    zones: level.zones || [],
  };
}

/** Devuelve la zona (de `zones`) que contiene el punto, o null. */
export function zoneAt(zones, x, y) {
  for (const z of zones) {
    if (x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h) return z;
  }
  return null;
}
