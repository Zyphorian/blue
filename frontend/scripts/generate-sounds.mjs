// frontend/scripts/generate-sounds.mjs
//
// Generates the synthesized sound effects that ship in public/sounds. They are
// produced here rather than downloaded so the project stays dependency-free and
// any of them can be regenerated or retuned.
//
// quick_open.wav is NOT generated: it is the tail of public/sounds/case_open.mp3
// (the reveal "pop"), cut and trimmed once with a WebAudio decode. Leave it alone
// here so regenerating the other effects cannot overwrite it.
//
// The case-open sound for Case Battle is generated here too (case_open_cs2.wav):
// an unlock clack, a decelerating reel of ticks, and the reveal ding timed to the
// animation. public/sounds/case_open.mp3 (the CS2 rip the single-case page uses)
// is untouched.
//
// Usage (from the frontend folder):
//   node scripts/generate-sounds.mjs open     -> case_open_cs2.wav (battle)
//   node scripts/generate-sounds.mjs upgrade  -> upgrade_spin.wav  (upgrader wheel)
//   node scripts/generate-sounds.mjs win      -> win.wav
//   node scripts/generate-sounds.mjs all      -> everything
//
// Output is mono 16-bit PCM WAV at 44.1 kHz. The noise comes from a seeded PRNG,
// so running this twice produces byte-identical files (no spurious diffs in git).
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

// Companion high-pass, used to keep the metallic clicks bright.
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

// A sound that starts at a large amplitude steps the speaker cone instantly, which
// clicks. A few milliseconds of ramp removes that without softening the attack.
const fadeInHead = (samples, seconds = 0.006) => {
  const fade = Math.round(SAMPLE_RATE * seconds);
  for (let i = 0; i < fade && i < samples.length; i += 1) samples[i] *= i / fade;
  return samples;
};

// --- sounds -----------------------------------------------------------------

/**
 * CS2-style case opening, built to line up with the Case Battle round:
 *
 *   0.00s  unlock clack  - the case latch popping (two metallic clicks + a thump)
 *   0.09s  reel ticking  - items whipping past, decelerating from ~34 Hz to ~7 Hz
 *   1.36s  reveal ding   - the item landing: bright inharmonic partials
 *   2.25s  end
 *
 * The ding is deliberately placed at 1.36s because CaseBattlePage reveals both
 * drops at OPENING_MS = 1500 ms, so the sound lands exactly with the animation.
 */
const buildCs2CaseOpen = () => {
  const duration = 2.25;
  const n = Math.round(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  const rand = makePrng(880123);

  const clickLp = makeLowPass();
  const clickHp = makeHighPass();

  // 1. unlock clack: two short metallic clicks plus a low thump
  for (const start of [0, 0.055]) {
    const from = Math.round(start * SAMPLE_RATE);
    const len = Math.round(0.12 * SAMPLE_RATE);
    const level = start === 0 ? 1 : 0.72;
    for (let i = 0; i < len && from + i < n; i += 1) {
      const dt = i / SAMPLE_RATE;
      const click = clickHp(clickLp(rand(), 0.7), 0.12) * Math.exp(-dt / 0.004) * level;
      // a metallic ring so it reads as a latch rather than a noise blip
      const ring =
        (Math.sin(2 * Math.PI * 1180 * dt) + 0.5 * Math.sin(2 * Math.PI * 1790 * dt)) *
        Math.exp(-dt / 0.022) *
        0.3 *
        level;
      out[from + i] += click * 0.85 + ring;
    }
  }
  for (let i = 0; i < n; i += 1) {
    const dt = i / SAMPLE_RATE;
    if (dt > 0.16) break;
    out[i] += Math.sin(2 * Math.PI * (150 - 70 * Math.min(1, dt / 0.12)) * dt) * Math.exp(-dt / 0.05) * 0.5;
  }

  // 2. reel ticks: crisp clicks that slow down as the reel settles
  const tickStart = 0.09;
  const tickEnd = 1.4;
  const ticks = [];
  let t = tickStart;
  while (t < tickEnd) {
    ticks.push(t);
    const p = (t - tickStart) / (tickEnd - tickStart);
    t += 0.029 + 0.13 * Math.pow(p, 2.2); // ~34 Hz easing down to ~7 Hz
  }
  for (const start of ticks) {
    const from = Math.round(start * SAMPLE_RATE);
    const len = Math.round(0.05 * SAMPLE_RATE);
    const p = (start - tickStart) / (tickEnd - tickStart);
    const level = 0.5 + 0.5 * p; // the last ticks are the clearest
    for (let i = 0; i < len && from + i < n; i += 1) {
      const dt = i / SAMPLE_RATE;
      const click = clickHp(clickLp(rand(), 0.8), 0.18) * Math.exp(-dt / 0.0022);
      const ping = Math.sin(2 * Math.PI * 2650 * dt) * Math.exp(-dt / 0.01);
      out[from + i] += (click * 0.7 + ping * 0.28) * level;
    }
  }

  // 3. reveal ding: bright inharmonic partials, plus a warm low body.
  // 1.44s rather than the 1.50s reveal, so the usual audio output latency puts the
  // hit exactly on the animation.
  const dingStart = 1.44;
  const partials = [
    { freq: 2637, gain: 0.5, decay: 0.3 },
    { freq: 3951, gain: 0.3, decay: 0.22 },
    { freq: 5274, gain: 0.16, decay: 0.15 },
  ];
  for (const part of partials) {
    for (let i = Math.round(dingStart * SAMPLE_RATE); i < n; i += 1) {
      const dt = i / SAMPLE_RATE - dingStart;
      const body =
        Math.sin(2 * Math.PI * part.freq * dt) + 0.3 * Math.sin(2 * Math.PI * part.freq * 1.005 * dt);
      out[i] += body * Math.exp(-dt / part.decay) * part.gain * 0.5;
    }
  }
  for (let i = Math.round(dingStart * SAMPLE_RATE); i < n; i += 1) {
    const dt = i / SAMPLE_RATE - dingStart;
    out[i] += Math.sin(2 * Math.PI * 220 * dt) * Math.exp(-dt / 0.16) * 0.3;
  }

  return fadeInHead(fadeOutTail(normalize(out, 0.86), 0.1));
};

/**
 * The upgrader wheel, soft version. Ticks that slow down like a wheel coasting to
 * a stop, each one a muted thud with a gentle onset instead of a sharp click,
 * over a warm whoosh, landing on a fading low sine. Length matches SPIN_MS in
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

  // Deliberately quiet: this is a continuous wash that plays for 3.4s, so at the
  // same peak as a short effect it would sound loud.
  return fadeOutTail(normalize(out, 0.34), 0.14);
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

const target = (process.argv[2] || "all").toLowerCase();
if (target === "open" || target === "all") {
  writeWav("case_open_cs2.wav", buildCs2CaseOpen());
}
if (target === "upgrade" || target === "all") {
  writeWav("upgrade_spin.wav", buildUpgradeSpin());
}
if (target === "win" || target === "all") writeWav("win.wav", buildWin());
if (!["open", "upgrade", "win", "all"].includes(target)) {
  console.error(`Unknown target "${target}". Use: open | upgrade | win | all`);
  process.exit(1);
}
