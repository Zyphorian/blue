import React, { useState, useEffect, useRef } from "react";
import styles from "./CrashPage.module.css";


const CrashPage = () => {
  const [multiplier, setMultiplier] = useState(1.0);
  const [isCrashed, setIsCrashed] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [bet, setBet] = useState("");
  const [crashPoint, setCrashPoint] = useState(null);
  const [history, setHistory] = useState([]);
  const canvasRef = useRef(null);
  const pointsRef = useRef([]);

  const xScale = 180; // pixels per second
  const maxTime = 5; // seconds
  const canvasWidth = 40 + xScale * maxTime;

  const getRandomCrashPoint = () => {
    const rand = Math.random();
    if (rand < 0.2) return +(Math.random() * 2 + 1.01).toFixed(2); // 20% early crash (1.01x–3x)
    if (rand < 0.6) return +(Math.random() * 5 + 3).toFixed(2);    // 40% mid (3x–8x)
    return +(Math.random() * 30 + 10).toFixed(2);                   // 40% high (10x–40x)
  };

  const startGame = () => {
    setMultiplier(1.0);
    setIsCrashed(false);
    pointsRef.current = [];
    const crash = getRandomCrashPoint();
    setCrashPoint(crash);
    setIsRunning(true);
  };

  const cashOut = () => {
    if (!isCrashed && isRunning) {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    let animationFrameId;
    let startTime;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;

      // Slower growth multiplier
      const newMultiplier = +(1 * Math.pow(1.025, elapsed * 40)).toFixed(2);
      setMultiplier(newMultiplier);
      pointsRef.current.push({ x: elapsed, y: newMultiplier });

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Canvas colours mirror the CS2 theme tokens (a canvas cannot resolve CSS vars).
        ctx.fillStyle = "#10151d"; // --cs-bg-soft
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = "#232a35"; // --cs-panel-3
        ctx.lineWidth = 1;
        ctx.font = "10px Arial";
        ctx.fillStyle = "#9aa4b2"; // --cs-text-dim

        for (let i = 1; i <= 5; i++) {
          const y = canvas.height - 30 - i * 30;
          ctx.beginPath();
          ctx.moveTo(40, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
          ctx.fillText(`${i}x`, 10, y + 3);
        }

        for (let i = 1; i <= maxTime; i++) {
          const x = 40 + i * xScale;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height - 30);
          ctx.stroke();
          ctx.fillText(`${i}s`, x - 8, canvas.height - 10);
        }

        ctx.strokeStyle = "#3a4453"; // --cs-border-strong
        ctx.beginPath();
        ctx.moveTo(40, 0);
        ctx.lineTo(40, canvas.height - 30);
        ctx.lineTo(canvas.width, canvas.height - 30);
        ctx.stroke();

        const points = pointsRef.current;
        if (points.length > 0) {
          ctx.beginPath();
          points.forEach((point, idx) => {
            const x = 40 + point.x * xScale;
            const y = canvas.height - 30 - point.y * 15;
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.strokeStyle = isCrashed ? "#ef4444" : "#4ade80"; // --cs-danger / --cs-success
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        ctx.fillStyle = isCrashed ? "#ef4444" : "#f0a30a"; // --cs-danger / --cs-accent
        ctx.font = "bold 48px Orbitron, sans-serif";
        ctx.textAlign = "center";
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 20;
        ctx.fillText(`${newMultiplier.toFixed(2)}x`, canvas.width / 2, canvas.height / 2);
        ctx.shadowBlur = 0;
      }

      if (crashPoint && newMultiplier >= crashPoint) {
        setIsCrashed(true);
        setIsRunning(false);
        setHistory((prev) => [crashPoint, ...prev.slice(0, 6)]);
        return;
      }

      if (elapsed >= maxTime) {
        setIsCrashed(true);
        setIsRunning(false);
        setHistory((prev) => [newMultiplier, ...prev.slice(0, 6)]);
        return;
      }

      if (isRunning) animationFrameId = requestAnimationFrame(animate);
    };

    if (isRunning) animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isRunning, crashPoint, isCrashed]);

  return (
    <>
      
      <main className={styles.crashContainer}>
        <h1 className={styles.crashTitle}>🚀 Crash Game</h1>
        <section className={styles.gameWrapper}>
          <div className={styles.canvasWrapper}>
            <canvas
              ref={canvasRef}
              width={canvasWidth}
              height={500}
              className={styles.canvas}
            />
          </div>

          <div className={styles.historyInline}>
            <span>Last games: </span>
            {history.map((h, idx) => (
              <span
                key={idx}
                className={styles.historyItem}
                style={{ backgroundColor: h < crashPoint ? "var(--cs-danger)" : "var(--cs-success)" }}
              >
                {h}x
              </span>
            ))}
          </div>

          <div className={styles.controlPanel}>
            <input
              type="number"
              placeholder="Enter your bet"
              value={bet}
              onChange={(e) => setBet(e.target.value)}
              disabled={isRunning}
            />
            {!isRunning ? (
              <button onClick={startGame}>Start</button>
            ) : (
              <button onClick={cashOut}>Cash Out</button>
            )}
          </div>
        </section>
      </main>
    </>
  );
};

export default CrashPage;
