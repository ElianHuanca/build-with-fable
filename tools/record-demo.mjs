#!/usr/bin/env node
/**
 * Graba el video demo (~60 s) de Dengue Invaders 2D con Playwright.
 *
 *   npm run build && npm run demo:video
 *
 * Guion (segundos aproximados):
 *   0-4   menú principal (hover sobre JUGAR)
 *   4-7   selección de nivel
 *   7-10  caminata por el barrio con el teclado hasta la llanta
 *   ~10   E → animación de eliminación (entregable de la etapa 7)
 *   ~14   popup educativo, se cierra con E
 *   luego 3 criaderos más (teletransporte + caminata corta), fin de nivel con
 *   estrellas, modo foto, volver, continuar y selección de nivel con estrellas.
 *
 * Salida: docs/demo/dengue-invaders-demo.webm (+ .mp4 y poster.png si hay ffmpeg
 * con libx264 en el PATH; con el ffmpeg de Playwright solo se genera poster.png).
 *
 * Variables opcionales: PLAYWRIGHT_MODULE (ruta al paquete playwright),
 * CHROMIUM_PATH (ejecutable de Chromium), DEMO_PORT (4176), DEMO_KEEP_FRAMES=1.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'docs', 'demo');
const TMP_DIR = join(OUT_DIR, '.rec');
const PORT = Number(process.env.DEMO_PORT || 4176);
const URL = `http://localhost:${PORT}/`;
const W = 960, H = 540;

// ---------- utilidades ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node22/lib/node_modules/playwright/index.mjs'].filter(Boolean);
  for (const c of candidates) {
    try { return await import(c); } catch { /* siguiente */ }
  }
  throw new Error('No se encontró playwright. Instálalo (npm i -D playwright) o define PLAYWRIGHT_MODULE.');
}

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  return existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
}

function which(bin) {
  const r = spawnSync('which', [bin], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

/** ffmpeg del sistema (si tiene libx264) o, como respaldo, el que trae Playwright (solo vp8/png). */
function findFfmpeg() {
  const sys = which('ffmpeg');
  if (sys) {
    const enc = spawnSync(sys, ['-hide_banner', '-encoders'], { encoding: 'utf8' }).stdout || '';
    return { bin: sys, h264: /libx264/.test(enc) };
  }
  const base = '/opt/pw-browsers';
  if (existsSync(base)) {
    const dir = readdirSync(base).find((d) => d.startsWith('ffmpeg'));
    if (dir) {
      const bin = join(base, dir, 'ffmpeg-linux');
      if (existsSync(bin)) return { bin, h264: false };
    }
  }
  return null;
}

async function waitForServer(url, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(url); if (r.ok) return; } catch { /* aún no */ }
    await sleep(250);
  }
  throw new Error(`vite preview no respondió en ${url}`);
}

// ---------- servidor ----------
if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
  console.log('[demo] no hay dist/, corriendo vite build…');
  const b = spawnSync('npx', ['vite', 'build'], { cwd: ROOT, stdio: 'inherit' });
  if (b.status !== 0) process.exit(b.status ?? 1);
}
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
const killPreview = () => { try { preview.kill('SIGTERM'); } catch { /* ya cerrado */ } };
process.on('exit', killPreview);
process.on('SIGINT', () => { killPreview(); process.exit(130); });

let exitCode = 0;
try {
  await waitForServer(URL);
  console.log('[demo] preview listo en', URL);

  const { chromium } = await loadPlaywright();
  rmSync(TMP_DIR, { recursive: true, force: true });
  mkdirSync(TMP_DIR, { recursive: true });

  const browser = await chromium.launch({
    executablePath: findChromium(),
    args: ['--use-gl=swiftshader', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'],
  });
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    recordVideo: { dir: TMP_DIR, size: { width: W, height: H } },
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  const T0 = Date.now();
  const t = () => ((Date.now() - T0) / 1000).toFixed(1);
  const mark = (msg) => console.log(`[demo] ${t().padStart(5)} s  ${msg}`);
  const game = (fn, arg) => page.evaluate(fn, arg);
  const playerPos = () => game(() => { const p = window.__game.scene.getScene('Game').player; return { x: Math.round(p.x), y: Math.round(p.y) }; });
  const scenes = () => game(() => window.__game.scene.getScenes(true).map((s) => s.scene.key));

  /**
   * Mantiene una tecla hasta que `until(pos)` sea verdadero (o venza el tiempo). Con el
   * render por software cada ida y vuelta al navegador tarda ~100-250 ms, así que el
   * personaje "se pasa" unos 20-40 px al soltar; los objetivos dejan ese margen.
   */
  async function walk(key, until, maxMs = 4000) {
    const t0 = Date.now();
    await page.keyboard.down(key);
    let pos = await playerPos();
    while (!until(pos) && Date.now() - t0 < maxMs) { await sleep(30); pos = await playerPos(); }
    await page.keyboard.up(key);
    await sleep(150);
    pos = await playerPos();
    console.log(`[demo]         ${key} → (${pos.x},${pos.y}) en ${Date.now() - t0} ms`);
    return pos;
  }
  /** Toques cortos para dejar la x del jugador dentro de [min,max] (corrige el sobrepaso). */
  async function alignX(min, max) {
    for (let i = 0; i < 6; i++) {
      const pos = await playerPos();
      if (pos.x >= min && pos.x <= max) return pos;
      await page.keyboard.press(pos.x < min ? 'ArrowRight' : 'ArrowLeft', { delay: 50 });
      await sleep(150);
    }
    return playerPos();
  }
  const activo = () => game(() => { const g = window.__game.scene.getScene('Game'); return g.activo ? g.activo.type : null; });

  // ---- 0-4 s: menú ----
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Menu'), null, { timeout: 15000 });
  mark('menú');
  await page.mouse.move(W / 2 - 200, H * 0.56 + 120);
  await sleep(900);
  await page.mouse.move(W / 2, H * 0.56, { steps: 6 });    // hover sobre JUGAR
  await sleep(1000);
  await page.mouse.click(W / 2, H * 0.56);
  await page.waitForFunction(() => window.__game.scene.isActive('LevelSelect'));
  mark('selección de nivel');

  // ---- 4-7 s: selección de nivel ----
  await sleep(600);
  await page.mouse.move(310, 435, { steps: 6 });           // botón "Jugar" de Equipetrol
  await sleep(700);
  await page.mouse.click(310, 435);
  await page.waitForFunction(() => window.__game.scene.isActive('Game') && !!window.__game.scene.getScene('Game').player);
  mark('juego: caminando');

  // ---- 7-10 s: caminata real hasta la llanta (864,1376), detrás de la casa del medio ----
  // Ruta: bajar por el paso de cebra, cruzar la calle, seguir hasta la vereda de las casas,
  // ir a la derecha hasta el hueco entre casas, bajar al patio y volver a la izquierda.
  // Con render por software (swiftshader) y CPU compartida, los primeros segundos del
  // nivel corren lentos, por eso la bajada inicial tarda más de lo que sugiere la distancia.
  async function rutaLlanta() {
    // Tramo recto sin obstáculos; con la máquina cargada puede tardar hasta ~12 s.
    for (let i = 0; i < 3 && (await playerPos()).y < 1222; i++) {
      await walk('ArrowDown', (p) => p.y >= 1222, 5000);     // hasta el frente de la casa del medio
    }
    await walk('ArrowRight', (p) => p.x >= 900, 2500);       // hueco entre casas: x ∈ [910, 946]
    await alignX(912, 944);
    await walk('ArrowDown', (p) => p.y >= 1335, 3000);       // bajar al patio trasero
    await walk('ArrowLeft', (p) => p.x <= 886, 2500);        // acercarse a la llanta (864,1376)
    return (await activo()) === 'llanta';
  }
  let reached = false;
  for (let attempt = 1; attempt <= 3 && !reached; attempt++) {
    reached = await rutaLlanta();
    if (!reached) {
      console.warn(`[demo] intento ${attempt}: no se detectó la llanta (pos ${JSON.stringify(await playerPos())})`);
      await game(() => window.__game.scene.getScene('Game').debugTeleport(864, 864));
      await sleep(300);
    }
  }
  if (!reached) {
    console.warn('[demo] usando debugTeleport como último recurso');
    await game(() => window.__game.scene.getScene('Game').debugTeleport(900, 1330));
    await walk('ArrowLeft', (p) => p.x <= 886, 800);
  }
  mark(`llanta detectada (pos ${JSON.stringify(await playerPos())})`);
  await sleep(400);

  // ---- ~10 s: animación de eliminación ----
  mark('E → animación de eliminación');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__game.scene.isActive('Popup'), null, { timeout: 8000 });
  mark('popup');
  await sleep(2200);
  await page.keyboard.press('KeyE');
  await sleep(800);

  // ---- 3 criaderos más: teletransporte + caminata corta antes de cada E ----
  const OTROS = [
    { x: 224, y: 1376, from: [224, 1270], key: 'ArrowDown', until: (p) => p.y >= 1335 },   // tanque
    { x: 1504, y: 1376, from: [1504, 1270], key: 'ArrowDown', until: (p) => p.y >= 1335 }, // balde
    { x: 1440, y: 32, from: [1330, 60], key: 'ArrowRight', until: (p) => p.x >= 1400 },    // florero
  ];
  for (const o of OTROS) {
    await game(([x, y]) => window.__game.scene.getScene('Game').debugTeleport(x, y), o.from);
    await sleep(200);
    await walk(o.key, o.until, 1500);
    const ok = await activo();
    if (!ok) { // por si la caminata no alcanzó el radio de detección
      await game(([x, y]) => window.__game.scene.getScene('Game').debugTeleport(x, y - 70), [o.x, o.y]);
      await sleep(300);
    }
    await sleep(200);
    mark(`E en criadero (${o.x},${o.y})`);
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => window.__game.scene.isActive('Popup'), null, { timeout: 8000 });
    await sleep(1400);
    await page.keyboard.press('KeyE');
    await sleep(300);
  }

  // Último criadero (botella): teletransporte + caminata y E; al limpiarlo termina el nivel.
  await game(() => window.__game.scene.getScene('Game').debugTeleport(180, 60));
  await sleep(200);
  await walk('ArrowRight', (p) => p.x >= 250, 1500);
  if (!(await activo())) { await game(() => window.__game.scene.getScene('Game').debugTeleport(288, 32 - 70)); await sleep(300); }
  await sleep(200);
  mark('E en último criadero');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__game.scene.isActive('Popup'), null, { timeout: 8000 });
  await sleep(1400);
  await page.keyboard.press('KeyE');

  // ---- fin de nivel con estrellas (~8 s) ----
  await page.waitForFunction(() => window.__game.scene.isActive('LevelEnd'), null, { timeout: 8000 });
  mark('fin de nivel');
  await sleep(4200);
  await page.mouse.move(360, 470, { steps: 6 });
  await sleep(600);

  // ---- modo foto (~6 s) ----
  await page.mouse.click(360, 470);
  await page.waitForFunction(() => window.__game.scene.isActive('Photo'), null, { timeout: 5000 });
  mark('modo foto');
  await sleep(3400);
  await page.mouse.move(330, 490, { steps: 6 });
  await sleep(500);
  await page.mouse.click(330, 490);                         // Volver
  await page.waitForFunction(() => window.__game.scene.isActive('LevelEnd'), null, { timeout: 5000 });
  mark('volver a fin de nivel');
  await sleep(1000);
  await page.mouse.move(570, 470, { steps: 6 });
  await sleep(500);
  await page.mouse.click(570, 470);                         // Continuar
  await page.waitForFunction(() => window.__game.scene.isActive('LevelSelect'), null, { timeout: 5000 });
  mark('selección de nivel con estrellas');
  await sleep(2200);
  mark('fin del guion');

  console.log('[demo] escenas activas al final:', await scenes());
  if (errors.length) console.warn('[demo] errores de página:', errors);

  await context.close(); // Playwright escribe el .webm al cerrar el contexto
  await browser.close();

  // ---- archivos de salida ----
  const webmSrc = readdirSync(TMP_DIR).find((f) => f.endsWith('.webm'));
  if (!webmSrc) throw new Error('Playwright no generó el .webm');
  const webm = join(OUT_DIR, 'dengue-invaders-demo.webm');
  renameSync(join(TMP_DIR, webmSrc), webm);
  console.log(`[demo] video: ${webm} (${(statSync(webm).size / 1024 / 1024).toFixed(2)} MB)`);

  const ff = findFfmpeg();
  if (!ff) {
    console.log('[demo] ffmpeg no disponible: se deja solo el .webm (sin .mp4 ni poster.png).');
  } else {
    if (ff.h264) {
      const mp4 = join(OUT_DIR, 'dengue-invaders-demo.mp4');
      const r = spawnSync(ff.bin, ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
      if (r.status === 0) console.log(`[demo] mp4: ${mp4} (${(statSync(mp4).size / 1024 / 1024).toFixed(2)} MB)`);
    } else {
      console.log(`[demo] ${ff.bin} no tiene libx264: no se genera .mp4.`);
    }
    const poster = join(OUT_DIR, 'poster.png');
    const p = spawnSync(ff.bin, ['-y', '-loglevel', 'error', '-ss', '10', '-i', webm, '-frames:v', '1', poster], { stdio: 'inherit' });
    if (p.status === 0) console.log(`[demo] poster (segundo 10): ${poster}`);
    // Duración: con ffprobe si existe; si no, se extrae 1 fotograma por segundo con el
    // ffmpeg de Playwright (no trae ffprobe ni el muxer null) y se cuentan.
    const probe = which('ffprobe');
    if (probe) {
      const d = spawnSync(probe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', webm], { encoding: 'utf8' }).stdout.trim();
      console.log(`[demo] duración (ffprobe): ${Number(d).toFixed(1)} s`);
    } else {
      const framesDir = join(TMP_DIR, 'frames');
      mkdirSync(framesDir, { recursive: true });
      const r = spawnSync(ff.bin, ['-y', '-loglevel', 'error', '-i', webm, '-r', '1', join(framesDir, 'seg_%03d.png')], { stdio: 'inherit' });
      if (r.status === 0) console.log(`[demo] duración (fotogramas a 1 fps): ~${readdirSync(framesDir).length} s`);
    }
  }
  console.log(`[demo] duración del guion (reloj): ${t()} s`);

  if (!process.env.DEMO_KEEP_FRAMES) rmSync(TMP_DIR, { recursive: true, force: true });
  else console.log('[demo] fotogramas de referencia (1 por segundo) en', join(TMP_DIR, 'frames'));
} catch (e) {
  console.error('[demo] error:', e);
  exitCode = 1;
} finally {
  killPreview();
}
process.exit(exitCode);
