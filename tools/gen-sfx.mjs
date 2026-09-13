#!/usr/bin/env node
// Sintetiza los efectos de sonido y la música de fondo del juego como WAV
// (PCM 16-bit mono) sin dependencias externas, estilo retro suave (jsfxr).
// Uso: npm run gen:sfx   →  public/assets/audio/*.wav
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../public/assets/audio');
const SR = 22050;                 // Hz
const SFX_DB = -12;               // pico de los efectos
const MUSIC_DB = -20;             // pico de la música

const TAU = Math.PI * 2;
const dbToLin = (db) => Math.pow(10, db / 20);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const noteHz = (semi) => 440 * Math.pow(2, (semi - 69) / 12); // MIDI → Hz

// RNG determinista para que el ruido sea reproducible entre ejecuciones.
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
const rand = rng(2026);
const noise = () => rand() * 2 - 1;

// ---------- osciladores (anti-click: todos empiezan en fase 0) ----------
const osc = {
  sine: (p) => Math.sin(TAU * p),
  tri: (p) => 1 - 4 * Math.abs(Math.round(p - 0.25) - (p - 0.25)),
  // cuadrada "suave": suma de armónicos impares limitada → sin aliasing duro
  square: (p) => {
    let s = 0;
    for (let k = 1; k <= 7; k += 2) s += Math.sin(TAU * p * k) / k;
    return s * (4 / Math.PI) * 0.8;
  },
};

// Envolvente ADSR en segundos (sostén como nivel 0..1).
function adsr(t, dur, a = 0.005, d = 0.05, s = 0.7, r = 0.05) {
  if (t < 0 || t >= dur) return 0;
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
  if (t > dur - r) return s * ((dur - t) / r);
  return s;
}

// Buffer de muestras en float (-1..1)
const buffer = (seconds) => new Float32Array(Math.round(seconds * SR));

// Mezcla una voz al buffer. gen(t, phaseAccum) → muestra; freqAt(t) → Hz.
function voice(buf, start, dur, freqAt, wave, env, gain = 1) {
  const i0 = Math.round(start * SR);
  const n = Math.round(dur * SR);
  let phase = 0;
  for (let i = 0; i < n && i0 + i < buf.length; i++) {
    const t = i / SR;
    phase += freqAt(t) / SR;
    buf[i0 + i] += wave(phase % 1) * env(t, dur) * gain;
  }
}

// Filtro pasabajos de un polo (in place).
function lowpass(buf, cutoffHz) {
  const rc = 1 / (TAU * cutoffHz);
  const a = (1 / SR) / (rc + 1 / SR);
  let y = 0;
  for (let i = 0; i < buf.length; i++) { y += a * (buf[i] - y); buf[i] = y; }
}
// Filtro pasaaltos de un polo (in place).
function highpass(buf, cutoffHz) {
  const rc = 1 / (TAU * cutoffHz);
  const a = rc / (rc + 1 / SR);
  let y = 0, xPrev = 0;
  for (let i = 0; i < buf.length; i++) { const x = buf[i]; y = a * (y + x - xPrev); xPrev = x; buf[i] = y; }
}

// Normaliza al pico indicado en dB y aplica fundido corto en los extremos.
function finalize(buf, peakDb, fadeMs = 3) {
  let peak = 1e-9;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  const g = dbToLin(peakDb) / peak;
  const f = Math.round((fadeMs / 1000) * SR);
  for (let i = 0; i < buf.length; i++) {
    let e = 1;
    if (i < f) e = i / f;
    else if (i >= buf.length - f) e = (buf.length - 1 - i) / f;
    buf[i] = clamp(buf[i] * g * e, -1, 1);
  }
  return buf;
}

// ---------- escritura WAV ----------
function writeWav(name, samples) {
  const dataBytes = samples.length * 2;
  const out = Buffer.alloc(44 + dataBytes);
  out.write('RIFF', 0); out.writeUInt32LE(36 + dataBytes, 4); out.write('WAVE', 8);
  out.write('fmt ', 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); // PCM
  out.writeUInt16LE(1, 22);              // mono
  out.writeUInt32LE(SR, 24);             // sample rate
  out.writeUInt32LE(SR * 2, 28);         // byte rate
  out.writeUInt16LE(2, 32);              // block align
  out.writeUInt16LE(16, 34);             // bits
  out.write('data', 36); out.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i++) out.writeInt16LE(Math.round(samples[i] * 32767), 44 + i * 2);
  const path = resolve(OUT_DIR, name);
  writeFileSync(path, out);
  console.log(`  ${name.padEnd(12)} ${(out.length / 1024).toFixed(1).padStart(7)} KB  ${(samples.length / SR).toFixed(2)} s`);
}

// ---------- efectos ----------
function step() {
  const b = buffer(0.08);
  voice(b, 0, 0.08, () => 1, () => noise(), (t, d) => adsr(t, d, 0.002, 0.03, 0.25, 0.03));
  lowpass(b, 900); highpass(b, 120);
  return b;
}

function detect() {
  const b = buffer(0.2);
  const env = (t, d) => adsr(t, d, 0.004, 0.02, 0.8, 0.03);
  voice(b, 0, 0.1, () => noteHz(76), osc.square, env);     // E5
  voice(b, 0.1, 0.1, () => noteHz(81), osc.square, env);   // A5
  lowpass(b, 4000);
  return b;
}

function gluglu() {
  const b = buffer(1.2);
  // Burbujas: senoidales con frecuencia descendente, moduladas en amplitud.
  const bubbles = 9;
  for (let i = 0; i < bubbles; i++) {
    const start = 0.02 + i * 0.12 + rand() * 0.03;
    const dur = 0.16 + rand() * 0.08;
    const f0 = 520 + rand() * 260 - i * 25;
    voice(b, start, dur, (t) => f0 * Math.pow(0.45, t / dur), osc.sine,
      (t, d) => adsr(t, d, 0.006, 0.05, 0.6, 0.05) * (0.7 + 0.3 * Math.sin(TAU * 18 * t)), 0.9);
  }
  // Fondo de agua: ruido muy filtrado y suave.
  voice(b, 0, 1.2, () => 1, () => noise(), (t, d) => adsr(t, d, 0.1, 0.2, 0.5, 0.3), 0.25);
  lowpass(b, 1500);
  return b;
}

function pop() {
  const b = buffer(0.12);
  voice(b, 0, 0.12, (t) => 900 * Math.pow(0.3, t / 0.12), osc.sine, (t, d) => adsr(t, d, 0.002, 0.04, 0.4, 0.04));
  return b;
}

function points() {
  const b = buffer(0.35);
  const env = (t, d) => adsr(t, d, 0.004, 0.03, 0.7, 0.04);
  [72, 76, 79].forEach((n, i) => voice(b, i * 0.1, 0.14, () => noteHz(n), osc.tri, env)); // C5 E5 G5
  return b;
}

function win() {
  const b = buffer(1.2);
  const env = (t, d) => adsr(t, d, 0.006, 0.05, 0.7, 0.08);
  const notes = [[67, 0, 0.16], [72, 0.16, 0.16], [76, 0.32, 0.16], [79, 0.48, 0.2], [84, 0.7, 0.5]]; // G4 C5 E5 G5 C6
  for (const [n, s, d] of notes) {
    voice(b, s, d, () => noteHz(n), osc.tri, env, 0.8);
    voice(b, s, d, () => noteHz(n - 12), osc.square, env, 0.25);
  }
  lowpass(b, 5000);
  return b;
}

function click() {
  const b = buffer(0.04);
  voice(b, 0, 0.04, (t) => 2200 * Math.pow(0.5, t / 0.04), osc.sine, (t, d) => adsr(t, d, 0.001, 0.01, 0.3, 0.015));
  return b;
}

function alert() {
  const b = buffer(0.5);
  const env = (t, d) => adsr(t, d, 0.004, 0.02, 0.8, 0.03);
  // Dos tonos ascendentes cortos, repetidos una vez para llamar la atención (aviso de brote).
  voice(b, 0, 0.09, () => noteHz(83), osc.square, env);    // B5
  voice(b, 0.1, 0.09, () => noteHz(88), osc.square, env);  // E6
  voice(b, 0.25, 0.09, () => noteHz(83), osc.square, env);
  voice(b, 0.35, 0.09, () => noteHz(88), osc.square, env);
  lowpass(b, 5000);
  return b;
}

function spray() {
  const b = buffer(1);
  // Niebla de espray: ruido filtrado con un silbido tenue moviéndose por encima.
  voice(b, 0, 1, () => 1, () => noise(), (t, d) => adsr(t, d, 0.05, 0.15, 0.6, 0.3), 0.8);
  voice(b, 0, 1, (t) => 1800 + 400 * Math.sin(TAU * 2 * t), osc.sine, (t, d) => adsr(t, d, 0.08, 0.2, 0.3, 0.3), 0.15);
  lowpass(b, 3500); highpass(b, 500);
  return b;
}

function motor() {
  const b = buffer(0.6);
  const env = (t, d) => adsr(t, d, 0.01, 0.05, 0.7, 0.15);
  // Arranque tipo "brrm": pulso grave que sube de tono con vibrato, más ruido de combustión.
  voice(b, 0, 0.6, (t) => 70 + 40 * Math.min(1, t / 0.15) + 8 * Math.sin(TAU * 18 * t), osc.square, env, 0.8);
  voice(b, 0, 0.6, () => 1, () => noise(), (t, d) => adsr(t, d, 0.01, 0.1, 0.3, 0.2), 0.25);
  lowpass(b, 900);
  return b;
}

function buzz() {
  const b = buffer(0.6);
  const env = (t, d) => adsr(t, d, 0.02, 0.05, 0.8, 0.1);
  // Zumbido agudo tipo mosquito: tono con vibrato y trémolo de amplitud.
  voice(b, 0, 0.6, (t) => 620 + 30 * Math.sin(TAU * 14 * t), osc.square,
    (t, d) => env(t, d) * (0.7 + 0.3 * Math.sin(TAU * 40 * t)), 0.5);
  highpass(b, 300); lowpass(b, 3000);
  return b;
}

// ---------- música ----------
function music() {
  const BPM = 110, BEAT = 60 / BPM, BARS = 8;  // 8 compases de 4/4 ≈ 17.45 s
  const total = BARS * 4 * BEAT;
  const b = buffer(total);
  const step = BEAT / 2; // corcheas

  // Escala de Do mayor (MIDI), melodía sencilla y alegre en corcheas (2 frases que se repiten).
  const C = { c: 72, d: 74, e: 76, f: 77, g: 79, a: 81, b: 83, C: 84, '-': null };
  const phraseA = 'e g a g e c d e - g a g e d c -'.split(' ');
  const phraseB = 'g a C a g e d e - c d e d c d -'.split(' ');
  const phraseC = 'e g a g e c d e - g a g e d e -'.split(' ');
  const phraseD = 'g a C a g e d e - d e d c - - -'.split(' ');
  const melody = [...phraseA, ...phraseB, ...phraseC, ...phraseD, ...phraseA, ...phraseB, ...phraseC, ...phraseD];
  const mEnv = (t, d) => adsr(t, d, 0.008, 0.08, 0.6, 0.06);
  melody.forEach((n, i) => {
    if (C[n] == null) return;
    const dur = melody[i + 1] === '-' ? step * 1.8 : step * 0.9;
    voice(b, i * step, dur, () => noteHz(C[n]), osc.tri, mEnv, 0.9);
  });

  // Bajo cuadrado atenuado: progresión C - Am - F - G, dos compases por vuelta.
  const bass = [48, 48, 45, 45, 41, 41, 43, 43]; // C2 A1 F1 G1 (por compás)
  const bEnv = (t, d) => adsr(t, d, 0.006, 0.05, 0.7, 0.04);
  for (let bar = 0; bar < BARS; bar++) {
    for (let k = 0; k < 4; k++) {
      const root = bass[bar];
      const n = k === 2 ? root + 7 : root; // quinta en el tercer tiempo
      voice(b, (bar * 4 + k) * BEAT, BEAT * 0.55, () => noteHz(n), osc.square, bEnv, 0.35);
    }
  }

  // Hi-hat de ruido en corcheas (acento en contratiempo).
  const hat = buffer(total);
  const totalSteps = BARS * 8;
  for (let i = 0; i < totalSteps; i++) {
    const g = i % 2 === 1 ? 0.5 : 0.3;
    voice(hat, i * step, 0.05, () => 1, () => noise(), (t, d) => adsr(t, d, 0.001, 0.02, 0.2, 0.02), g);
  }
  highpass(hat, 6000);
  for (let i = 0; i < b.length; i++) b[i] += hat[i] * 0.6;

  lowpass(b, 6500);
  return b;
}

// ---------- main ----------
mkdirSync(OUT_DIR, { recursive: true });
console.log(`Generando audio en ${OUT_DIR} (${SR} Hz, 16-bit mono)`);
writeWav('step.wav', finalize(step(), SFX_DB));
writeWav('detect.wav', finalize(detect(), SFX_DB));
writeWav('gluglu.wav', finalize(gluglu(), SFX_DB));
writeWav('pop.wav', finalize(pop(), SFX_DB));
writeWav('points.wav', finalize(points(), SFX_DB));
writeWav('win.wav', finalize(win(), SFX_DB));
writeWav('click.wav', finalize(click(), SFX_DB));
writeWav('alert.wav', finalize(alert(), SFX_DB));
writeWav('spray.wav', finalize(spray(), SFX_DB));
writeWav('motor.wav', finalize(motor(), SFX_DB));
writeWav('buzz.wav', finalize(buzz(), SFX_DB));
writeWav('music.wav', finalize(music(), MUSIC_DB, 8)); // fundido de 8 ms en los bordes → loop sin clic
console.log('Listo.');
