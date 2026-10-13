// frontend/scripts/generate-sounds.mjs
//
// Generates the short synthesized sound effects that ship in public/sounds.
// They are produced here instead of being downloaded so the project stays
// dependency-free and the files can be regenerated or tweaked at any time.
//
// Usage (from the frontend folder):
//   node scripts/generate-sounds.mjs battle   -> battle_spin.wav + battle_result.wav
//   node scripts/generate-sounds.mjs spin     -> battle_spin.wav   (case spinning)
//   node scripts/generate-sounds.mjs result   -> battle_result.wav (drop revealed)
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

const makeHighPass = () => {
  let z = 0;
  return (input, cutoff) => {
    z += cutoff * (input - z);
    return input - z;
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
 * The case spinning: rhythmic mechanical ticks that speed up through the middle
 * and coast at the end, over a rising rumble. Length matches OPENING_MS in
 * CaseBattlePage (1500 ms) so it lands exactly when the drops are revealed.
 */
const buildBattleSpin = () => {
  const duration = 1.55;
  const n = Math.round(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  const rand = makePrng(20260514);

  // tick times: 5 Hz at the start, ~16 Hz in the middle, easing back to ~11 Hz
  const ticks = [];
  let t = 0.02;
  while (t < duration - 0.1) {
    ticks.push(t);
    const p = t / duration;
    const interval = p < 0.6 ? 0.2 - 0.138 * (p / 0.6) : 0.062 + 0.045 * ((p - 0.6) / 0.4);
    t += interval;
  }

  // 1. the ticks themselves: a click plus a small mechanical thump
  const tickLp = makeLowPass();
  for (const start of ticks) {
    const from = Math.round(start * SAMPLE_RATE);
    const len = Math.round(0.035 * SAMPLE_RATE);
    for (let i = 0; i < len && from + i < n; i += 1) {
      const dt = i / SAMPLE_RATE;
      const click = tickLp(rand(), 0.6) * Math.exp(-dt / 0.0035);
      const thumpFreq = 210 - 90 * Math.min(1, dt / 0.03);
      const thump = Math.sin(2 * Math.PI * thumpFreq * dt) * Math.exp(-dt / 0.012);
      // later ticks are a touch quieter, as if the case is settling
      const level = 0.75 - 0.25 * (start / duration);
      out[from + i] += (click * 0.8 + thump * 0.5) * level;
    }
  }

  // 2. rumble under the ticks: noise through a slowly opening low-pass
  const rumbleLp = makeLowPass();
  for (let i = 0; i < n; i += 1) {
    const time = i / SAMPLE_RATE;
    const p = time / duration;
    const cutoff = 0.012 + 0.05 * Math.sin(Math.PI * p);
    const env = 0.35 + 0.65 * Math.sin(Math.PI * p);
    out[i] += rumbleLp(rand(), cutoff) * env * 0.5;
  }

  // 3. a soft "air" layer so the ticks do not sound bare
  const airHp = makeHighPass();
  const airLp = makeLowPass();
  for (let i = 0; i < n; i += 1) {
    const p = i / SAMPLE_RATE / duration;
    out[i] += airHp(airLp(rand(), 0.3), 0.02) * Math.sin(Math.PI * p) * 0.12;
  }

  return fadeOutTail(out, 0.09);
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
if (target === "win" || target === "all") writeWav("win.wav", buildWin());
if (!["battle", "spin", "result", "win", "all"].includes(target)) {
  console.error(`Unknown target "${target}". Use: battle | spin | result | win | all`);
  process.exit(1);
}
