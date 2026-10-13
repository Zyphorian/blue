// frontend/scripts/generate-sounds.mjs
//
// Generates the short synthesized sound effects that ship in public/sounds.
// They are produced here instead of being downloaded so the project stays
// dependency-free and the files can be regenerated or tweaked at any time.
//
// Usage (from the frontend folder):
//   node scripts/generate-sounds.mjs battle   -> battle_spin.wav + battle_result.wav
//   node scripts/generate-sounds.mjs spin     -> battle_spin.wav   (case battle whirr)
//   node scripts/generate-sounds.mjs result   -> battle_result.wav (drop revealed)
//   node scripts/generate-sounds.mjs upgrade  -> upgrade_spin.wav  (upgrader wheel)
//   node scripts/generate-sounds.mjs win      -> win.wav
//   node scripts/generate-sounds.mjs all      -> everything
//
// Output is mono 16-bit PCM WAV. The noise comes from a seeded PRNG, so running
// this twice produces byte-identical files (no spurious diffs in git).
//
// Playback volume is deliberately kept low in the app (see CaseBattlePage: the
// SPIN_VOLUME / RESULT_VOLUME constants), so these files only need a sensible
// level - not a quiet one.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOUNDS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "sounds");
const SAMPLE_RATE = 44100;

// --- helpers ----------------------------------------------------------------

const makePrng = (seed = 12345) => {
  let state = seed >>> 0;
  return () => {
    // xorshift32 - deterministic, good enough for noise
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return (state / 0xffffffff) * 2 - 1;
  };
};

// One-pole low-pass whose cutoff can move over time (0..1 of Nyquist).
const makeLowPass = () => {
  let z = 0;
  return (input, cutoff) => {
    z += cutoff * (input - z);
    return z;
  };
};

const writeWav = (file, samples) => {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) {
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  fs.mkdirSync(SOUNDS_DIR, { recursive: true });
  fs.writeFileSync(path.join(SOUNDS_DIR, file), Buffer.concat([header, data]));
  const kb = Math.round(fs.statSync(path.join(SOUNDS_DIR, file)).size / 1024);
  console.log(`wrote public/sounds/${file} (${kb} KB, ${(samples.length / SAMPLE_RATE).toFixed(2)}s)`);
};

const normalize = (samples, peak = 0.9) => {
  let max = 0;
  for (const s of samples) max = Math.max(max, Math.abs(s));
  if (max === 0) return samples;
  const gain = peak / max;
  for (let i = 0; i < samples.length; i += 1) samples[i] *= gain;
  return samples;
};

const fadeOutTail = (samples, seconds = 0.07) => {
  const fade = Math.round(SAMPLE_RATE * seconds);
  const n = samples.length;
  for (let i = 0; i < fade; i += 1) samples[n - fade + i] *= 1 - i / fade;
  return samples;
};

// --- battle sounds ----------------------------------------------------------

/**
 * The Case Battle spinner, soft version: an airy swirl rather than a whirr.
 * Heavily low-passed noise whose filter opens slowly, a quiet hum swelling
 * underneath, and a gentle settle at the end. Nothing percussive - there are no
 * clicks or ticks anywhere, so it sits calmly under the music. Length matches
 * OPENING_MS in CaseBattlePage (1500 ms).
 */
const buildBattleSpin = () => {
  const duration = 1.55;
  const n = Math.round(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  const rand = makePrng(31415);

  const swirlA = makeLowPass();
  const swirlB = makeLowPass();
  let humPhase = 0;
  let shimmerPhase = 0;

  for (let i = 0; i < n; i += 1) {
    const time = i / SAMPLE_RATE;
    const p = Math.min(1, time / duration);

    // bell-shaped envelope: fade in, swell, settle
    const env = Math.pow(Math.sin(Math.PI * Math.min(1, p * 1.05)), 1.1);

    // two cascaded low-passes keep this smooth and hiss-free
    const cutoff = 0.02 + 0.09 * p;
    const air = swirlB(swirlA(rand(), cutoff), cutoff * 1.2);
    out[i] += air * env * 0.5;

    // a slow hum rising slightly, kept under the noise so it feels warm
    humPhase += (2 * Math.PI * (72 + 46 * p)) / SAMPLE_RATE;
    out[i] += Math.sin(humPhase) * env * 0.22;

    // a very quiet shimmer an octave above the hum
    shimmerPhase += (2 * Math.PI * (150 + 90 * p)) / SAMPLE_RATE;
    out[i] += Math.sin(shimmerPhase) * env * 0.07;
  }

  // soft settle: a low sine that eases in and fades, no transient
  const settleStart = Math.round((duration - 0.28) * SAMPLE_RATE);
  for (let i = settleStart; i < n; i += 1) {
    const dt = i / SAMPLE_RATE - (duration - 0.28);
    out[i] +=
      Math.sin(2 * Math.PI * 96 * dt) * Math.exp(-dt / 0.09) * 0.2 * Math.min(1, dt / 0.02);
  }

  return fadeOutTail(normalize(out, 0.62), 0.12);
};

/**
 * The upgrader wheel, soft version. The same coasting rhythm as before (ticks
 * slowing like a wheel coming to rest) but each tick is a muted thud with a
 * gentle onset instead of a sharp click, everything is heavily low-passed, and
 * the landing is a fading low sine rather than a thump. Length matches SPIN_MS in
 * UpgraderPage (3400 ms).
 */
const buildUpgradeSpin = () => {
  const duration = 3.45;
  const n = Math.round(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  const rand = makePrng(2718);

  // tick times: about 18 Hz at the start, easing down to ~2.5 Hz by the end
  const ticks = [];
  const tickEnd = duration - 0.35;
  let t = 0.03;
  while (t < tickEnd) {
    ticks.push(t);
    const p = t / tickEnd;
    const interval = 0.055 + 0.34 * Math.pow(p, 2.3);
    t += interval;
  }

  // 1. each tick: a soft muted thud (longer decay, no click)
  const thudLp = makeLowPass();
  for (const start of ticks) {
    const from = Math.round(start * SAMPLE_RATE);
    const len = Math.round(0.09 * SAMPLE_RATE);
    const level = 0.5 + 0.5 * (start / duration);
    for (let i = 0; i < len && from + i < n; i += 1) {
      const dt = i / SAMPLE_RATE;
      const attack = Math.min(1, dt / 0.012); // gentle onset
      const body = Math.sin(2 * Math.PI * 150 * dt) * Math.exp(-dt / 0.03);
      const air = thudLp(rand(), 0.18) * Math.exp(-dt / 0.02);
      out[from + i] += (body * 0.6 + air * 0.5) * attack * level;
    }
  }

  // 2. warm whoosh that breathes with the wheel and fades as it slows
  const whooshLp = makeLowPass();
  for (let i = 0; i < n; i += 1) {
    const p = i / SAMPLE_RATE / duration;
    const env = Math.pow(1 - p, 1.3) * 0.45 + 0.1;
    out[i] += whooshLp(rand(), 0.05) * env * 0.5;
  }

  // 3. landing: a low sine easing in and fading out, no thump
  const landStart = Math.round(tickEnd * SAMPLE_RATE);
  for (let i = landStart; i < n; i += 1) {
    const dt = i / SAMPLE_RATE - tickEnd;
    out[i] +=
      Math.sin(2 * Math.PI * 110 * dt) * Math.exp(-dt / 0.13) * 0.3 * Math.min(1, dt / 0.03);
  }

  // Deliberately quiet: this one is a continuous wash that plays for 3.4s, so at
  // the same peak as the other effects it would sound louder than the sparse
  // clicking version it replaced.
  return fadeOutTail(normalize(out, 0.34), 0.14);
};

/**
 * The result: the moment both drops are revealed. A short impact (latch + thump)
 * followed by a bright metallic ding.
 */
const buildBattleResult = () => {
  const duration = 0.62;
  const n = Math.round(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  const rand = makePrng(777001);

  // 1. impact transient
  const clickLp = makeLowPass();
  for (let i = 0; i < n; i += 1) {
    const t = i / SAMPLE_RATE;
    if (t > 0.09) break;
    out[i] += clickLp(rand(), 0.62) * Math.exp(-t / 0.009) * 0.95;
    const freq = 165 - 70 * Math.min(1, t / 0.08);
    out[i] += Math.sin(2 * Math.PI * freq * t) * Math.exp(-t / 0.05) * 0.5;
  }

  // 2. bright ding - inharmonic partials, quick and clean
  const partials = [
    { freq: 2093, gain: 0.5, decay: 0.2 },
    { freq: 3140, gain: 0.3, decay: 0.14 },
    { freq: 4186, gain: 0.18, decay: 0.1 },
  ];
  const dingStart = 0.012;
  for (const p of partials) {
    for (let i = Math.round(dingStart * SAMPLE_RATE); i < n; i += 1) {
      const t = i / SAMPLE_RATE - dingStart;
      const body =
        Math.sin(2 * Math.PI * p.freq * t) + 0.3 * Math.sin(2 * Math.PI * p.freq * 1.004 * t);
      out[i] += body * Math.exp(-t / p.decay) * p.gain * 0.45;
    }
  }

  // 3. short tail so it does not cut off abruptly
  const tailLp = makeLowPass();
  for (let i = 0; i < n; i += 1) {
    const t = i / SAMPLE_RATE;
    if (t < 0.06) continue;
    out[i] += tailLp(rand(), 0.1) * Math.exp(-(t - 0.06) / 0.12) * 0.18;
  }

  return fadeOutTail(normalize(out, 0.82), 0.06);
};

/** Victory chime: a short ascending three-note bell. */
const buildWin = () => {
  const duration = 0.95;
  const n = Math.round(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  const notes = [
    { freq: 880.0, start: 0.0, length: 0.34, gain: 0.5 }, // A5
    { freq: 1108.73, start: 0.11, length: 0.34, gain: 0.42 }, // C#6
    { freq: 1318.51, start: 0.22, length: 0.6, gain: 0.36 }, // E6
  ];
  for (const note of notes) {
    const from = Math.round(note.start * SAMPLE_RATE);
    const count = Math.round(note.length * SAMPLE_RATE);
    for (let i = 0; i < count && from + i < n; i += 1) {
      const t = i / SAMPLE_RATE;
      const attack = Math.min(1, t / 0.012);
      const decay = Math.exp(-3.1 * t);
      const value =
        Math.sin(2 * Math.PI * note.freq * t) * 0.72 +
        Math.sin(2 * Math.PI * note.freq * 2 * t) * 0.18 +
        Math.sin(2 * Math.PI * note.freq * 3 * t) * 0.07;
      out[from + i] += value * attack * decay * note.gain;
    }
  }
  return fadeOutTail(normalize(out, 0.88), 0.08);
};

// --- run --------------------------------------------------------------------

const target = (process.argv[2] || "battle").toLowerCase();
if (target === "battle" || target === "spin" || target === "all") {
  writeWav("battle_spin.wav", buildBattleSpin());
}
if (target === "battle" || target === "result" || target === "all") {
  writeWav("battle_result.wav", buildBattleResult());
}
if (target === "upgrade" || target === "all") {
  writeWav("upgrade_spin.wav", buildUpgradeSpin());
}
if (target === "win" || target === "all") writeWav("win.wav", buildWin());
if (!["battle", "spin", "result", "upgrade", "win", "all"].includes(target)) {
  console.error(`Unknown target "${target}". Use: battle | spin | result | upgrade | win | all`);
  process.exit(1);
}
