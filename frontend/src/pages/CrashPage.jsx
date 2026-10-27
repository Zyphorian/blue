// src/pages/CrashPage.jsx
//
// Crash - a multiplier that climbs until it busts. Cash out before the crash to
// take bet x multiplier; stay in one tick too long and the bet is gone.
//
// Everything is simulated: the balance and all payouts are the site's fake money.
//
// The crash point is drawn when the round starts, from a heavy-tailed distribution
// with a house edge, so the multiplier can bust instantly at 1.01x or run to
// hundreds. Risk levels change that edge (and how fast the curve climbs), which is
// what makes it harder or easier.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import styles from "./CrashPage.module.css";
import { useWallet } from "../context/WalletContext.jsx";
import { formatMoney } from "../utils/drops.js";
import { createSfx, playSfx } from "../utils/sfx.js";
import { loadPrefs } from "../utils/battleStorage.js";
import { THEME_EVENT } from "../utils/theme.js";

const MAX_CRASH = 1000;
const HISTORY_LIMIT = 14;

const RISKS = [
  { id: "easy", label: "Easy", edge: 0.005, growth: 0.16, hint: "Lower house edge, slower climb" },
  { id: "normal", label: "Normal", edge: 0.01, growth: 0.2, hint: "1% edge, standard climb" },
  { id: "insane", label: "Insane", edge: 0.03, growth: 0.28, hint: "3% edge, explosive climb" },
];

const QUICK_BETS = [1, 5, 25, 100];

// Crash point from a uniform random value, with the risk level's edge.
const drawCrashPoint = (edge) => {
  const r = Math.random();
  // P(crash >= x) = (1 - edge) / x, so the tail is heavy but the edge holds.
  const raw = (1 - edge) / Math.max(1e-9, 1 - r);
  return Math.min(MAX_CRASH, Math.max(1.0, Math.round(raw * 100) / 100));
};

const round2 = (value) => Math.round(value * 100) / 100;

// A canvas cannot resolve CSS variables, so the chart carries both palettes and
// picks one from the <html data-theme> attribute (see utils/theme.js).
const chartPalette = () => {
  const light =
    typeof document !== "undefined" && document.documentElement.dataset.theme === "light";
  return light
    ? {
        bgTop: "#ffffff",
        bgBottom: "#eef1f6",
        grid: "#e2e7ef",
        label: "#6b7280",
        line: "#b0730a",
        dot: "#96610a",
        glow: "rgba(176, 115, 10, 0.45)",
        lost: "#c02626",
        lostGlow: "rgba(192, 38, 38, 0.4)",
        fillWinTop: "rgba(176, 115, 10, 0.22)",
        fillWinBottom: "rgba(176, 115, 10, 0)",
        fillLostTop: "rgba(192, 38, 38, 0.22)",
      }
    : {
        bgTop: "#101722",
        bgBottom: "#0b0e13",
        grid: "#1e2632",
        label: "#6b7686",
        line: "#f0a30a",
        dot: "#ffd166",
        glow: "rgba(240, 163, 10, 0.8)",
        lost: "#ef4444",
        lostGlow: "rgba(239, 68, 68, 0.8)",
        fillWinTop: "rgba(240, 163, 10, 0.35)",
        fillWinBottom: "rgba(240, 163, 10, 0)",
        fillLostTop: "rgba(239, 68, 68, 0.35)",
      };
};

function CrashPage() {
  const { walletBalance, spend, deposit } = useWallet();
  const prefs = useMemo(() => loadPrefs(), []);

  const [riskId, setRiskId] = useState("normal");
  const [bet, setBet] = useState("10");
  const [autoCashout, setAutoCashout] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | running | crashed | cashed
  const [multiplier, setMultiplier] = useState(1);
  const [crashedAt, setCrashedAt] = useState(null);
  const [cashedAt, setCashedAt] = useState(null);
  const [history, setHistory] = useState([]);
  const [notice, setNotice] = useState("");

  const canvasRef = useRef(null);
  const startRef = useRef(0);
  const crashRef = useRef(0);
  const autoRef = useRef(0);
  const betRef = useRef(0);
  const growthRef = useRef(0.2);
  const rafRef = useRef(0);
  const phaseRef = useRef("idle");

  const cashoutAudio = useRef(null);
  if (cashoutAudio.current === null) {
    cashoutAudio.current = createSfx("/sounds/win.wav", 0.35);
  }

  const risk = RISKS.find((r) => r.id === riskId) || RISKS[1];
  const betValue = Math.max(0, Number(bet) || 0);
  const autoValue = Math.max(0, Number(autoCashout) || 0);
  const livePayout = round2(betValue * multiplier);

  const stats = useMemo(() => {
    const wins = history.filter((entry) => entry.won);
    const best = history.reduce((max, entry) => Math.max(max, entry.cashout || 0), 0);
    const net = history.reduce((sum, entry) => sum + entry.net, 0);
    return {
      rounds: history.length,
      wins: wins.length,
      losses: history.length - wins.length,
      best,
      net: round2(net),
    };
  }, [history]);

  const drawChart = useCallback((m, elapsed, crashed) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const c = chartPalette();
    const w = canvas.width;
    const h = canvas.height;
    const padLeft = 46;
    const padBottom = 28;
    const padTop = 16;
    const plotW = w - padLeft - 12;
    const plotH = h - padTop - padBottom;

    const xMax = Math.max(3, elapsed * 1.15);
    const yMax = Math.max(2, Math.ceil(m * 1.2));

    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, c.bgTop);
    bg.addColorStop(1, c.bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // grid + y labels
    ctx.strokeStyle = c.grid;
    ctx.lineWidth = 1;
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = c.label;
    ctx.textAlign = "right";
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i += 1) {
      const value = 1 + ((yMax - 1) * i) / ySteps;
      const y = h - padBottom - (plotH * i) / ySteps;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(w - 12, y);
      ctx.stroke();
      ctx.fillText(`${value.toFixed(1)}x`, padLeft - 8, y + 4);
    }

    // x labels
    ctx.textAlign = "center";
    const xSteps = 4;
    for (let i = 0; i <= xSteps; i += 1) {
      const seconds = (xMax * i) / xSteps;
      const x = padLeft + (plotW * i) / xSteps;
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, h - padBottom);
      ctx.stroke();
      ctx.fillText(`${seconds.toFixed(0)}s`, x, h - 8);
    }

    // curve: multiplier = e^(growth * t), sampled up to the current moment
    const points = [];
    const samples = 60;
    for (let i = 0; i <= samples; i += 1) {
      const t = (elapsed * i) / samples;
      const value = Math.exp(growthRef.current * t);
      const x = padLeft + (plotW * t) / xMax;
      const y = h - padBottom - (plotH * (value - 1)) / (yMax - 1);
      points.push([x, y]);
    }

    if (points.length > 1) {
      // glow under the curve
      const fill = ctx.createLinearGradient(0, padTop, 0, h - padBottom);
      fill.addColorStop(0, crashed ? c.fillLostTop : c.fillWinTop);
      fill.addColorStop(1, c.fillWinBottom);
      ctx.beginPath();
      ctx.moveTo(points[0][0], h - padBottom);
      points.forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.lineTo(points[points.length - 1][0], h - padBottom);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();

      ctx.beginPath();
      points.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.strokeStyle = crashed ? c.lost : c.line;
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.shadowColor = crashed ? c.lostGlow : c.glow;
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.shadowBlur = 0;

      const [lastX, lastY] = points[points.length - 1];
      ctx.beginPath();
      ctx.arc(lastX, lastY, 5, 0, Math.PI * 2);
      ctx.fillStyle = crashed ? c.lost : c.dot;
      ctx.fill();
    }
  }, []);

  const finishRound = useCallback(
    (won, at) => {
      phaseRef.current = won ? "cashed" : "crashed";
      setPhase(won ? "cashed" : "crashed");
      if (won) {
        setCashedAt(at);
      } else {
        setCrashedAt(at);
      }
      setHistory((prev) =>
        [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            crash: at,
            cashout: won ? at : null,
            bet: betRef.current,
            won,
            net: won ? round2(betRef.current * at - betRef.current) : -betRef.current,
          },
          ...prev,
        ].slice(0, HISTORY_LIMIT)
      );
    },
    []
  );

  const cashOut = useCallback(
    async (at) => {
      if (phaseRef.current !== "running") return;
      cancelAnimationFrame(rafRef.current);
      const payout = round2(betRef.current * at);
      phaseRef.current = "cashed";
      await deposit(payout);
      finishRound(true, at);
      if (prefs.animations && cashoutAudio.current) playSfx(cashoutAudio.current);
    },
    [deposit, finishRound, prefs.animations]
  );

  const tick = useCallback(
    (timestamp) => {
      if (phaseRef.current !== "running") return;
      const elapsed = (timestamp - startRef.current) / 1000;
      const m = Math.exp(growthRef.current * elapsed);
      setMultiplier(m);
      drawChart(m, elapsed, false);

      if (m >= crashRef.current) {
        cancelAnimationFrame(rafRef.current);
        setMultiplier(crashRef.current);
        drawChart(crashRef.current, Math.log(crashRef.current) / growthRef.current, true);
        finishRound(false, crashRef.current);
        return;
      }
      if (autoRef.current > 0 && m >= autoRef.current) {
        cashOut(autoRef.current);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    },
    [cashOut, drawChart, finishRound]
  );

  const startRound = async () => {
    if (phaseRef.current === "running") return;
    if (betValue <= 0) {
      setNotice("Enter a bet amount first.");
      return;
    }
    if (betValue > walletBalance) {
      setNotice(`You only have ${formatMoney(walletBalance)}. Lower the bet or add funds.`);
      return;
    }
    if (autoValue > 0 && autoValue < 1.01) {
      setNotice("Auto cash-out must be at least 1.01x.");
      return;
    }

    const paid = await spend(betValue);
    if (!paid) {
      setNotice("The bet could not be placed. Check your balance.");
      return;
    }

    setNotice("");
    setCrashedAt(null);
    setCashedAt(null);
    setMultiplier(1);
    betRef.current = betValue;
    autoRef.current = autoValue >= 1.01 ? autoValue : 0;
    growthRef.current = risk.growth;
    crashRef.current = drawCrashPoint(risk.edge);
    phaseRef.current = "running";
    setPhase("running");
    startRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  };

  // Space bar cashes out, like the real thing.
  useEffect(() => {
    const onKey = (event) => {
      if (event.code === "Space" && phaseRef.current === "running") {
        event.preventDefault();
        cashOut(Math.exp(growthRef.current * (performance.now() - startRef.current) / 1000));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cashOut]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // The canvas is drawn manually, so it has to be repainted when the theme flips.
  useEffect(() => {
    const repaint = () => {
      const m = Math.max(1, multiplier);
      drawChart(m, Math.log(m) / growthRef.current, phase === "crashed");
    };
    window.addEventListener(THEME_EVENT, repaint);
    return () => window.removeEventListener(THEME_EVENT, repaint);
  }, [multiplier, phase, drawChart]);

  // Draw the resting state whenever a round ends or the page mounts.
  useEffect(() => {
    if (phase === "idle") drawChart(1, 0.001, false);
  }, [phase, drawChart]);

  const running = phase === "running";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Crash</h1>
          <p className={styles.subtitle}>
            The multiplier climbs until it busts. Cash out in time â€” or lose the bet.
          </p>
        </div>
        <div className={styles.balanceChip}>
          <span className={styles.balanceLabel}>Balance</span>
          <span className={styles.balanceValue}>{formatMoney(walletBalance)}</span>
        </div>
      </header>

      <div className={styles.layout}>
        <section className={styles.chartPanel}>
          <div className={styles.chartTop}>
            <div
              className={`${styles.multiplier} ${
                phase === "crashed" ? styles.multiplierCrashed : ""
              } ${phase === "cashed" ? styles.multiplierWon : ""}`}
            >
              {phase === "crashed" ? `${crashedAt.toFixed(2)}x` : `${multiplier.toFixed(2)}x`}
            </div>
            <div className={styles.chartMeta}>
              {phase === "crashed" && <span className={styles.metaLost}>Busted â€” bet lost</span>}
              {phase === "cashed" && (
                <span className={styles.metaWon}>
                  Cashed out at {cashedAt.toFixed(2)}x Â· +{formatMoney(round2(bet * cashedAt))}
                </span>
              )}
              {running && (
                <span className={styles.metaLive}>
                  {autoValue >= 1.01 ? `Auto @ ${autoValue.toFixed(2)}x` : "Cash out any time"}
                </span>
              )}
              {phase === "idle" && <span className={styles.metaIdle}>Place a bet to start</span>}
            </div>
          </div>

          <div className={styles.canvasWrap}>
            <canvas ref={canvasRef} width={820} height={420} className={styles.canvas} />
            {phase === "crashed" && <div className={styles.crashFlash} aria-hidden="true" />}
          </div>

          <div className={styles.historyStrip}>
            {history.length === 0 ? (
              <span className={styles.historyEmpty}>No rounds yet</span>
            ) : (
              history.map((entry) => (
                <span
                  key={entry.id}
                  className={`${styles.historyPill} ${
                    entry.won ? styles.historyPillWon : styles.historyPillLost
                  }`}
                  title={
                    entry.won
                      ? `Cashed out at ${entry.cashout.toFixed(2)}x Â· ${formatMoney(entry.net)}`
                      : `Busted at ${entry.crash.toFixed(2)}x Â· ${formatMoney(entry.net)}`
                  }
                >
                  {entry.won ? `${entry.cashout.toFixed(2)}x` : `${entry.crash.toFixed(2)}x`}
                </span>
              ))
            )}
          </div>
        </section>

        <aside className={styles.sidePanel}>
          <div className={styles.panelBlock}>
            <span className={styles.label}>Risk</span>
            <div className={styles.riskRow}>
              {RISKS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`${styles.riskButton} ${
                    riskId === option.id ? styles.riskButtonActive : ""
                  }`}
                  onClick={() => setRiskId(option.id)}
                  disabled={running}
                  title={option.hint}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className={styles.hint}>{risk.hint}</p>
          </div>

          <div className={styles.panelBlock}>
            <label className={styles.label} htmlFor="crash-bet">
              Bet amount
            </label>
            <input
              id="crash-bet"
              className={styles.betInput}
              type="number"
              min="0"
              step="0.01"
              value={bet}
              onChange={(event) => setBet(event.target.value)}
              disabled={running}
            />
            <div className={styles.chipRow}>
              {QUICK_BETS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className={styles.chip}
                  onClick={() => setBet(String(amount))}
                  disabled={running}
                >
                  {formatMoney(amount)}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.panelBlock}>
            <label className={styles.label} htmlFor="crash-auto">
              Auto cash-out (optional)
            </label>
            <input
              id="crash-auto"
              className={styles.betInput}
              type="number"
              min="1.01"
              step="0.01"
              placeholder="e.g. 2.00"
              value={autoCashout}
              onChange={(event) => setAutoCashout(event.target.value)}
              disabled={running}
            />
            <p className={styles.hint}>
              Automatically cashes out at this multiplier. If it busts first, the bet is lost.
            </p>
          </div>

          <div className={styles.panelBlock}>
            <span className={styles.label}>This round</span>
            <div className={styles.liveRow}>
              <span className={styles.liveLabel}>Cash-out value</span>
              <span className={styles.liveValue}>
                {formatMoney(phase === "cashed" ? round2(bet * cashedAt) : livePayout)}
              </span>
            </div>
            {running ? (
              <button
                type="button"
                className={styles.cashoutButton}
                onClick={() =>
                  cashOut(Math.exp((growthRef.current * (performance.now() - startRef.current)) / 1000))
                }
              >
                Cash out {formatMoney(livePayout)}
                <span className={styles.keyHint}>space</span>
              </button>
            ) : (
              <button type="button" className={styles.actionButton} onClick={startRound}>
                {phase === "idle" ? `Bet ${formatMoney(betValue)}` : `Play again Â· ${formatMoney(betValue)}`}
              </button>
            )}
            {notice && <p className={styles.notice}>{notice}</p>}
          </div>

          <div className={styles.panelBlock}>
            <span className={styles.label}>Session</span>
            <div className={styles.statsGrid}>
              <div className={styles.statBox}>
                <span className={styles.statValue}>{stats.rounds}</span>
                <span className={styles.statLabel}>Rounds</span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statValue}>{stats.wins}</span>
                <span className={styles.statLabel}>Cashed</span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statValue}>{stats.losses}</span>
                <span className={styles.statLabel}>Busted</span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statValue}>{stats.best ? `${stats.best.toFixed(2)}x` : "â€”"}</span>
                <span className={styles.statLabel}>Best</span>
              </div>
              <div className={styles.statBox}>
                <span
                  className={`${styles.statValue} ${
                    stats.net >= 0 ? styles.profit : styles.loss
                  }`}
                >
                  {stats.net >= 0 ? "+" : ""}
                  {formatMoney(stats.net)}
                </span>
                <span className={styles.statLabel}>Net</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default CrashPage;
