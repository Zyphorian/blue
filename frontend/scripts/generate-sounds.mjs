// frontend/scripts/generate-sounds.mjs
//
// Generates the short synthesized sound effects that ship in public/sounds.
// They are produced here instead of being downloaded so the project stays
// dependency-free and the files can be regenerated or tweaked at any time.
//
// Usage (from the frontend folder):
//   node scripts/generate-sounds.mjs battle   -> public/sounds/battle_case_open.wav
//   node scripts/generate-sounds.mjs win      -> public/sounds/win.wav
//   node scripts/generate-sounds.mjs all      -> both
//
// Output is mono 16-bit PCM WAV. The noise comes from a seeded PRNG, so running
// this twice produces byte-identical files (no spurious diffs in git).
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

// One-pole low-pass with a cutoff that can move over time (0..1 of Nyquist).
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

// --- sounds -----------------------------------------------------------------

/**
 * Case Battle opening sound: a latch click, a rising whoosh while the case
 * turns, then a bright metallic ping as it opens.
 */
const buildBattleOpen = () => {
  const duration = 0.85;
  const n = Math.round(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  const rand = makePrng();

  // 1. latch click - a very short filtered noise burst plus a low thump
  const clickLp = makeLowPass();
  for (let i = 0; i < n; i += 1) {
    const t = i / SAMPLE_RATE;
    if (t > 0.06) break;
    const noise = rand() * Math.exp(-t / 0.011);
    out[i] += clickLp(noise, 0.55) * 0.9;
    // low thump that drops in pitch
    const freq = 170 - 90 * Math.min(1, t / 0.09);
    out[i] += Math.sin(2 * Math.PI * freq * t) * Math.exp(-t / 0.055) * 0.55;
  }

  // 2. whoosh - noise through a band that opens up (rising low-pass + rising
  //    high-pass), peaking just before the reveal
  const whooshLp = makeLowPass();
  const whooshHp = makeHighPass();
  const start = 0.04;
  const end = 0.46;
  for (let i = 0; i < n; i += 1) {
    const t = i / SAMPLE_RATE;
    if (t < start || t > end) continue;
    const u = (t - start) / (end - start); // 0..1
    const lpCut = 0.02 + 0.5 * u * u;
    const hpCut = 0.004 + 0.09 * u;
    const env = Math.pow(Math.sin(Math.PI * u), 1.25);
    const shaped = whooshHp(whooshLp(rand(), lpCut), hpCut);
    out[i] += shaped * env * 0.75;
  }

  // 3. reveal ping - inharmonic partials, like a metal box opening
  const partials = [
    { freq: 1860, gain: 0.5, decay: 0.26 },
    { freq: 2790, gain: 0.34, decay: 0.2 },
    { freq: 3720, gain: 0.22, decay: 0.15 },
    { freq: 5580, gain: 0.12, decay: 0.1 },
  ];
  const pingStart = 0.4;
  for (const p of partials) {
    for (let i = Math.round(pingStart * SAMPLE_RATE); i < n; i += 1) {
      const t = i / SAMPLE_RATE - pingStart;
      const body = Math.sin(2 * Math.PI * p.freq * t) + 0.35 * Math.sin(2 * Math.PI * p.freq * 1.003 * t);
      out[i] += body * Math.exp(-t / p.decay) * p.gain * 0.5;
    }
  }

  // 4. soft air tail so the ending does not feel clipped
  const tailLp = makeLowPass();
  for (let i = 0; i < n; i += 1) {
    const t = i / SAMPLE_RATE;
    if (t < 0.42) continue;
    out[i] += tailLp(rand(), 0.12) * Math.exp(-(t - 0.42) / 0.16) * 0.22;
  }

  // 5. fade the last 70 ms to avoid a click at the end
  const fade = Math.round(SAMPLE_RATE * 0.07);
  for (let i = 0; i < fade; i += 1) {
    const idx = n - fade + i;
    out[idx] *= 1 - i / fade;
  }

  return normalize(out, 0.92);
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
  const fade = Math.round(SAMPLE_RATE * 0.08);
  for (let i = 0; i < fade; i += 1) out[n - fade + i] *= 1 - i / fade;
  return normalize(out, 0.88);
};

// --- run --------------------------------------------------------------------

const target = (process.argv[2] || "battle").toLowerCase();
if (target === "battle" || target === "all") writeWav("battle_case_open.wav", buildBattleOpen());
if (target === "win" || target === "all") writeWav("win.wav", buildWin());
if (!["battle", "win", "all"].includes(target)) {
  console.error(`Unknown target "${target}". Use: battle | win | all`);
  process.exit(1);
}
