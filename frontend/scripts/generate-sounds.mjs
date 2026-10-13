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
 * The Case Battle spinner: a motorised whirr rather than a tick pattern. Its
 * pitch climbs while a flutter speeds up, air rushes past, and it ends with a
 * small latch as the case lands. Length matches OPENING_MS in CaseBattlePage
 * (1500 ms) so it finishes exactly on the reveal.
 */
const buildBattleSpin = () => {
  const duration = 1.55;
  const n = Math.round(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  const rand = makePrng(90210);

  const body = duration - 0.12; // the whirr stops just before the tail
  let dronePhase = 0;
  let secondPhase = 0;
  let thirdPhase = 0;
  let flutterPhase = 0;
  const airLp = makeLowPass();
  const airHp = makeHighPass();

  for (let i = 0; i < n; i += 1) {
    const time = i / SAMPLE_RATE;
    const p = Math.min(1, time / body);

    // pitch climbs from a low hum up to a fast spin
    const freq = 96 + 190 * Math.pow(p, 0.85);
    dronePhase += (2 * Math.PI * freq) / SAMPLE_RATE;
    secondPhase += (2 * Math.PI * freq * 2.01) / SAMPLE_RATE;
    thirdPhase += (2 * Math.PI * freq * 3.02) / SAMPLE_RATE;

    // the whirr's pulse, accelerating as it picks up speed
    flutterPhase += (2 * Math.PI * (13 + 24 * p)) / SAMPLE_RATE;
    const flutter = 0.7 + 0.3 * Math.sin(flutterPhase);

    const envelope = time < 0.05 ? time / 0.05 : 1 - 0.25 * p;
    const drone =
      Math.sin(dronePhase) * 0.6 + Math.sin(secondPhase) * 0.22 + Math.sin(thirdPhase) * 0.1;
    out[i] += drone * flutter * envelope * 0.55;

    // air rushing past, opening up as it spins faster
    const air = airHp(airLp(rand(), 0.25 + 0.35 * p), 0.01 + 0.05 * p);
    out[i] += air * (0.1 + 0.16 * p) * envelope;
  }

  // final latch: a click and a short downward blip as the case lands
  const latch = makeLowPass();
  const latchStart = Math.round(body * SAMPLE_RATE);
  for (let i = latchStart; i < n; i += 1) {
    const dt = i / SAMPLE_RATE - body;
    out[i] += latch(rand(), 0.5) * Math.exp(-dt / 0.006) * 0.5;
    const blipFreq = 240 - 120 * Math.min(1, dt / 0.07);
    out[i] += Math.sin(2 * Math.PI * blipFreq * dt) * Math.exp(-dt / 0.045) * 0.35;
  }

  return fadeOutTail(normalize(out, 0.8), 0.08);
};

/**
 * The upgrader wheel: ticks that slow down like a wheel coasting to a stop, with
 * a whoosh underneath and a soft thud as it lands. Length matches SPIN_MS in
 * UpgraderPage (3400 ms).
 */
const buildUpgradeSpin = () => {
  const duration = 3.45;
  const n = Math.round(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  const rand = makePrng(4242);

  // tick times: about 24 Hz at the start, drifting down to ~3 Hz by the end
  const ticks = [];
  const tickEnd = duration - 0.16;
  let t = 0.015;
  while (t < tickEnd) {
    ticks.push(t);
    const p = t / tickEnd;
    const interval = 0.042 + 0.3 * Math.pow(p, 2.4);
    t += interval;
  }

  // 1. each tick: a bright click plus a soft wooden knock
  const tickLp = makeLowPass();
  for (const start of ticks) {
    const from = Math.round(start * SAMPLE_RATE);
    const len = Math.round(0.03 * SAMPLE_RATE);
    const level = 0.55 + 0.45 * (start / duration); // later ticks stand out more
    for (let i = 0; i < len && from + i < n; i += 1) {
      const dt = i / SAMPLE_RATE;
      const click = tickLp(rand(), 0.75) * Math.exp(-dt / 0.0028);
      const knock = Math.sin(2 * Math.PI * 300 * dt) * Math.exp(-dt / 0.008);
      out[from + i] += (click * 0.75 + knock * 0.3) * level;
    }
  }

  // 2. whoosh: strongest while the wheel is fast, fading as it slows down
  const airLp = makeLowPass();
  const airHp = makeHighPass();
  for (let i = 0; i < n; i += 1) {
    const p = i / SAMPLE_RATE / duration;
    const env = Math.pow(1 - p, 1.6) * 0.5 + 0.08;
    out[i] += airHp(airLp(rand(), 0.3), 0.02) * env * 0.4;
  }

  // 3. landing: a low thud as the wheel comes to rest
  const landing = makeLowPass();
  const landStart = Math.round(tickEnd * SAMPLE_RATE);
  for (let i = landStart; i < n; i += 1) {
    const dt = i / SAMPLE_RATE - tickEnd;
    out[i] += landing(rand(), 0.35) * Math.exp(-dt / 0.02) * 0.4;
    out[i] += Math.sin(2 * Math.PI * 130 * dt) * Math.exp(-dt / 0.07) * 0.45;
  }

  return fadeOutTail(normalize(out, 0.8), 0.08);
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
