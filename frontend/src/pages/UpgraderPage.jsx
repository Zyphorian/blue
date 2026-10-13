// src/pages/UpgraderPage.jsx
//
// Skin Upgrader - stake virtual skins for a chance at a more valuable one.
//
// Everything is simulated: the prices are fictional item values, nothing is
// deposited, withdrawn or exchanged for real money. The success chance shown to
// the player is exactly the chance the random roll uses, the result is generated
// once per attempt, and (as this simulator's rules specify) the staked skins are
// never destroyed - a failed attempt simply returns them.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import styles from "./UpgraderPage.module.css";
import { useWallet } from "../context/WalletContext.jsx";
import {
  battleValueOf,
  formatMoney,
  getAllContainers,
  getCssRarityClass,
  getSkinsForContainer,
} from "../utils/drops.js";
import { loadPrefs } from "../utils/battleStorage.js";
import {
  clearUpgradeHistory,
  loadUpgradeHistory,
  makeUpgradeId,
  multiplierOf,
  saveUpgrade,
  successChance,
} from "../utils/upgradeStorage.js";
import { logCaseOpeningToBackend } from "../utils/logCaseOpening.js";

const LOCAL_INVENTORY_KEY = "guestInventory";
const SPIN_MS = 3400; // matches the wheel's transition
const TURNS = 3; // full rotations before settling
const PAGE_SIZE = 60;
const SORTS = [
  { id: "price-desc", label: "Price ↓" },
  { id: "price-asc", label: "Price ↑" },
  { id: "rarity", label: "Rarity" },
];

const readInventory = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_INVENTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.name) : [];
  } catch {
    return [];
  }
};

const itemKey = (item, index) => `${item.name}-${item.obtainedAt || index}`;

const rarityRank = (rarityClass) => {
  const css = getCssRarityClass(rarityClass);
  const order = [
    "consumer-grade",
    "industrial-grade",
    "mil-spec",
    "restricted",
    "classified",
    "covert",
    "extraordinary-gloves",
    "covert-knife",
    "gold",
  ];
  return order.indexOf(css);
};

// ---------------------------------------------------------------- small pieces

function RarityLabel({ rarityClass }) {
  const css = getCssRarityClass(rarityClass) || "";
  return (
    <span className={`${styles.rarity} ${css ? styles[css] : ""}`}>
      {(rarityClass || "unknown").replace(/-/g, " ")}
    </span>
  );
}

function TargetCard({ skin, active, onSelect }) {
  const css = getCssRarityClass(skin.rarityClass) || "";
  return (
    <button
      type="button"
      className={`${styles.targetCard} ${css ? styles[css] : ""} ${
        active ? styles.targetCardActive : ""
      }`}
      onClick={() => onSelect(skin)}
      title={`${skin.name} — ${formatMoney(skin.value)}`}
    >
      <img src={skin.image} alt="" className={styles.targetImage} loading="lazy" />
      <span className={styles.targetName}>{skin.name}</span>
      <RarityLabel rarityClass={skin.rarityClass} />
      <span className={styles.targetValue}>{formatMoney(skin.value)}</span>
    </button>
  );
}

function HistoryEntry({ entry }) {
  return (
    <div className={styles.historyEntry}>
      <div className={styles.historyHeader}>
        <span className={styles.historyMeta}>
          {new Date(entry.date).toLocaleString()} · target {formatMoney(entry.targetValue)}
        </span>
        <span
          className={`${styles.historyOutcome} ${
            entry.success ? styles.historyOutcomeWin : styles.historyOutcomeLose
          }`}
        >
          {entry.success ? "SUCCESS" : "FAILED"}
        </span>
      </div>
      <div className={styles.historyValues}>
        <span>Input {formatMoney(entry.inputValue)}</span>
        <span>Target {formatMoney(entry.targetValue)}</span>
        <span>Chance {entry.chance.toFixed(1)}%</span>
        <span>Multiplier {entry.multiplier.toFixed(2)}x</span>
      </div>
      <div className={styles.historyItems}>
        {entry.inputs.map((item, index) => (
          <span key={`in-${index}`} className={styles.historyItemRow}>
            <img src={item.image} alt="" className={styles.selectedThumb} loading="lazy" />
            {item.name}
          </span>
        ))}
        <span className={styles.historyItemRow}>
          <img src={entry.target.image} alt="" className={styles.selectedThumb} loading="lazy" />→{" "}
          {entry.target.name}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the page

function UpgraderPage() {
  const { isGuest } = useWallet();
  const prefs = useMemo(() => loadPrefs(), []);

  // Straight into the upgrader: choosing "Upgrader" in the header should start an
  // upgrade attempt, not open another menu.
  const [view, setView] = useState("upgrade"); // upgrade | history
  const [inventory, setInventory] = useState(() => readInventory());
  const [selected, setSelected] = useState([]); // keys of the staked skins
  const [target, setTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("price-desc");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [history, setHistory] = useState(() => loadUpgradeHistory());
  const [notice, setNotice] = useState("");
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const spinTimer = useRef(null);

  // Keep in step with wins from other modes (and the inventory drawer).
  useEffect(() => {
    const refresh = () => setInventory(readInventory());
    window.addEventListener("dsh-inventory-updated", refresh);
    return () => window.removeEventListener("dsh-inventory-updated", refresh);
  }, []);

  useEffect(() => () => clearTimeout(spinTimer.current), []);

  // Every obtainable skin, deduplicated by name - the "Target Collection".
  // Items with no simulated value are left out: as a target they would always be
  // a 0% attempt, which is just noise in the list.
  const targets = useMemo(() => {
    const byName = new Map();
    getAllContainers().forEach((container) => {
      getSkinsForContainer(container.id).forEach((skin) => {
        const value = battleValueOf(skin);
        if (value === null || value <= 0 || byName.has(skin.name)) return;
        byName.set(skin.name, {
          id: skin.id,
          name: skin.name,
          image: skin.img,
          rarityClass: skin.rarityClass,
          value,
        });
      });
    });
    return [...byName.values()];
  }, []);

  const visibleTargets = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = targets.filter((skin) => !query || skin.name.toLowerCase().includes(query));
    const sorted = [...list];
    if (sort === "price-desc") sorted.sort((a, b) => b.value - a.value);
    else if (sort === "price-asc") sorted.sort((a, b) => a.value - b.value);
    else
      sorted.sort(
        (a, b) => rarityRank(b.rarityClass) - rarityRank(a.rarityClass) || b.value - a.value
      );
    return sorted;
  }, [targets, search, sort]);

  const keyedInventory = useMemo(
    () => inventory.map((item, index) => ({ item, key: itemKey(item, index) })),
    [inventory]
  );
  const selectedEntries = useMemo(
    () => keyedInventory.filter((entry) => selected.includes(entry.key)),
    [keyedInventory, selected]
  );
  const selectedItems = useMemo(() => selectedEntries.map((entry) => entry.item), [selectedEntries]);
  const inputValue = useMemo(
    () => Math.round(selectedItems.reduce((sum, item) => sum + (item.value || 0), 0) * 100) / 100,
    [selectedItems]
  );
  const targetValue = target?.value ?? 0;
  const chance = target ? successChance(inputValue, targetValue) : 0;
  const multiplier = target ? multiplierOf(inputValue, targetValue) : 0;
  const successArc = Math.max(0, Math.min(360, (chance / 100) * 360));

  const toggleInput = (key) => {
    setNotice("");
    setOutcome(null);
    setSelected((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key]
    );
  };

  const chooseTarget = useCallback((skin) => {
    setNotice("");
    setOutcome(null);
    setTarget(skin);
  }, []);

  const runUpgrade = () => {
    if (spinning) return;
    if (!selectedItems.length) {
      setNotice("Pick at least one skin from your inventory to upgrade with.");
      return;
    }
    if (!target) {
      setNotice("Choose a target skin first.");
      return;
    }
    if (inputValue <= 0) {
      setNotice("Those skins have no simulated value, so there is nothing to trade up.");
      return;
    }

    // Rolled once, before the animation, and never re-rolled.
    const success = Math.random() * 100 < chance;

    // The pointer lands inside the sector matching the result, so the animation
    // always shows the outcome that was already decided.
    const landing = success
      ? Math.random() * Math.max(successArc - 4, 1) + 2
      : successArc + Math.random() * Math.max(360 - successArc - 4, 1) + 2;
    const finalAngle = TURNS * 360 + landing;

    setNotice("");
    setOutcome(null);
    setSpinning(true);
    setAngle(0);

    // Let the browser paint the reset position before spinning.
    window.setTimeout(() => setAngle(finalAngle), 60);

    spinTimer.current = setTimeout(
      () => {
        setSpinning(false);
        setOutcome({
          success,
          chance,
          inputValue,
          targetValue,
          multiplier,
          target,
        });
        if (success) {
          // The target joins the inventory. The staked skins are returned by this
          // simulator's rules, so nothing is removed.
          logCaseOpeningToBackend(
            "Upgrade",
            { ...target, computedPrice: targetValue, img: target.image },
            { isGuest }
          );
        }
        setHistory(
          saveUpgrade({
            id: makeUpgradeId(),
            date: new Date().toISOString(),
            inputs: selectedItems.map((item) => ({
              name: item.name,
              image: item.image,
              value: item.value,
              rarityClass: item.rarityClass,
            })),
            inputValue,
            target: {
              name: target.name,
              image: target.image,
              value: targetValue,
              rarityClass: target.rarityClass,
            },
            targetValue,
            chance,
            multiplier,
            success,
          })
        );
      },
      prefs.animations ? SPIN_MS : 0
    );
  };

  // -------------------------------------------------------------- rendering

  return (
    <div className={styles.page}>
      {view === "upgrade" && (
        <>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Skin upgrader</h2>
          </div>

          <div className={styles.upgradeLayout}>
            {/* LEFT - the skins being staked */}
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>Your skins</span>
                <span className={styles.panelSubtotal}>{formatMoney(inputValue)}</span>
              </div>
              {inventory.length === 0 ? (
                <p className={styles.emptyState}>
                  Nothing here yet - open a case (or win a battle) and your skins appear here.
                </p>
              ) : (
                <div className={styles.inputList}>
                  {keyedInventory.map(({ item, key }) => {
                    const css = getCssRarityClass(item.rarityClass) || "";
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`${styles.inputRow} ${css ? styles[css] : ""} ${
                          selected.includes(key) ? styles.inputRowActive : ""
                        }`}
                        onClick={() => toggleInput(key)}
                      >
                        <img src={item.image} alt="" className={styles.inputImage} loading="lazy" />
                        <span className={styles.inputInfo}>
                          <span className={styles.inputName}>{item.name}</span>
                          <RarityLabel rarityClass={item.rarityClass} />
                        </span>
                        <span className={styles.inputValue}>{formatMoney(item.value)}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className={styles.selectedList}>
                {selectedEntries.length === 0 ? (
                  <p className={styles.emptyState}>Select skins to stake.</p>
                ) : (
                  selectedEntries.map(({ item, key }) => (
                    <span key={`sel-${key}`} className={styles.selectedItem}>
                      <img src={item.image} alt="" className={styles.selectedThumb} loading="lazy" />
                      <span className={styles.selectedName}>{item.name}</span>
                      <span className={styles.selectedValue}>{formatMoney(item.value)}</span>
                      <button
                        type="button"
                        className={styles.selectedRemove}
                        onClick={() =>
                          setSelected((current) => current.filter((k) => k !== key))
                        }
                        aria-label={`Remove ${item.name}`}
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
              <div className={styles.inputTotalRow}>
                <span className={styles.statLabel}>Total input value</span>
                <span className={styles.statValueAccent}>{formatMoney(inputValue)}</span>
              </div>
            </section>

            {/* CENTER - the wheel */}
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>Upgrade</span>
              </div>
              <div className={styles.wheelStage}>
                <div
                  className={styles.wheelDisc}
                  style={{
                    background: `conic-gradient(var(--cs-success) 0deg ${successArc}deg, var(--cs-danger) ${successArc}deg 360deg)`,
                  }}
                >
                  {/* The arrow shape and its pivot come from the stylesheet
                      (.wheelPointer, transform-origin 50% 100%). */}
                  <div className={styles.wheelPointer} style={{ transform: `rotate(${angle}deg)` }} />
                  <div className={styles.wheelHub}>
                    <span className={styles.wheelCenterLabel}>
                      {spinning ? "…" : `${Math.round(chance)}%`}
                    </span>
                  </div>
                </div>

                <div className={styles.oddsRow}>
                  <span className={styles.chanceBadge}>
                    <span className={styles.chanceBadgeValue}>{chance.toFixed(1)}%</span>
                  </span>
                  <span className={styles.multiplierBadge}>
                    <span className={styles.multiplierValue}>{multiplier.toFixed(2)}x</span>
                  </span>
                </div>

                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: `${successArc / 3.6}%` }} />
                </div>

                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Input value</span>
                  <span className={styles.statValue}>{formatMoney(inputValue)}</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Target value</span>
                  <span className={styles.statValue}>{formatMoney(targetValue)}</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Success chance</span>
                  <span className={styles.statValueAccent}>{chance.toFixed(1)}%</span>
                </div>

                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={runUpgrade}
                  disabled={spinning || !selectedItems.length || !target}
                >
                  {spinning ? "Upgrading…" : "Upgrade"}
                </button>
                {notice && <p className={styles.notice}>{notice}</p>}
              </div>
            </section>

            {/* RIGHT - the target */}
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>Target skin</span>
                <span className={styles.panelSubtotal}>{formatMoney(targetValue)}</span>
              </div>

              <div className={styles.targetToolbar}>
                <input
                  type="search"
                  className={styles.targetSearch}
                  placeholder="Search targets…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <div className={styles.sortRow}>
                  {SORTS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`${styles.sortButton} ${
                        sort === option.id ? styles.sortButtonActive : ""
                      }`}
                      onClick={() => setSort(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.targetList}>
                {visibleTargets.slice(0, visibleCount).map((skin) => (
                  <TargetCard
                    key={skin.name}
                    skin={skin}
                    active={target?.name === skin.name}
                    onSelect={chooseTarget}
                  />
                ))}
                {visibleTargets.length === 0 && (
                  <p className={styles.emptyState}>No targets match that search.</p>
                )}
              </div>
              {visibleCount < visibleTargets.length && (
                <button
                  type="button"
                  className={styles.showMoreButton}
                  onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                >
                  Show {Math.min(PAGE_SIZE, visibleTargets.length - visibleCount)} more
                </button>
              )}
            </section>
          </div>

          {view === "upgrade" && outcome && (
            <section className={styles.panel} style={{ marginTop: "20px" }}>
              <div
                className={`${styles.resultBanner} ${
                  outcome.success ? styles.resultBannerWin : styles.resultBannerLose
                }`}
              >
                <span className={styles.resultTitle}>
                  {outcome.success ? "✅ Upgrade successful!" : "❌ Upgrade failed"}
                </span>
                <p className={styles.resultSubtitle}>
                  {outcome.success
                    ? `You received the target skin worth ${formatMoney(outcome.targetValue)}.`
                    : `Your staked skins (${formatMoney(
                        outcome.inputValue
                      )}) were returned - nothing was lost.`}
                </p>
                <div className={styles.resultItemRow}>
                  <img src={outcome.target.image} alt="" className={styles.inputImage} loading="lazy" />
                  <span className={styles.inputInfo}>
                    <span className={styles.inputName}>{outcome.target.name}</span>
                    <RarityLabel rarityClass={outcome.target.rarityClass} />
                  </span>
                  <span className={styles.inputValue}>{formatMoney(outcome.targetValue)}</span>
                </div>
                <div className={styles.resultActions}>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => {
                      setOutcome(null);
                      runUpgrade();
                    }}
                    disabled={spinning}
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => {
                      setOutcome(null);
                      setView("history");
                    }}
                  >
                    Upgrade history
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => {
                      setOutcome(null);
                      setSelected([]);
                      setTarget(null);
                    }}
                  >
                    New selection
                  </button>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {view === "history" && (
        <>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Upgrade history</h2>
            <button type="button" className={styles.backButton} onClick={() => setView("upgrade")}>
              ← Back to the upgrader
            </button>
          </div>
          {history.length === 0 ? (
            <p className={styles.emptyState}>No attempts yet. Try an upgrade and it shows up here.</p>
          ) : (
            <>
              <div className={styles.historyList}>
                {history.map((entry) => (
                  <HistoryEntry key={entry.id} entry={entry} />
                ))}
              </div>
              <div className={styles.resultActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setHistory(clearUpgradeHistory())}
                >
                  Clear history
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default UpgraderPage;
