// src/pages/CaseBattlePage.jsx
//
// Case Battle - a 1v1 case-opening competition against a bot.
//
// Both sides open the same containers, with the same drop odds and independent
// random results. Every drop's virtual value is added to that side's total, and
// whoever finishes higher wins. Nothing here involves real money: the wallet and
// all values are part of the simulation.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import styles from "./CaseBattlePage.module.css";
import DepositModal from "../components/DepositModal.jsx";
import { useWallet } from "../context/WalletContext.jsx";
import {
  formatMoney,
  getAllContainers,
  getCssRarityClass,
  makeBattleDrop,
  totalOf,
} from "../utils/drops.js";
import {
  clearHistory,
  loadHistory,
  loadPrefs,
  makeBattleId,
  pickBot,
  saveBattle,
} from "../utils/battleStorage.js";
import { logCaseOpeningToBackend } from "../utils/logCaseOpening.js";
import { asset } from "../utils/assetUrl.js";
import { createSfx, playSfx } from "../utils/sfx.js";

const MAX_CASES = 20;
// Case-open sound: a CS2-style opening built by
// frontend/scripts/generate-sounds.mjs - an unlock clack, a decelerating reel of
// ticks while the case turns, and a bright ding timed to land on the reveal. It
// fires once per round, on the beat where the case opens for both sides.
// Playback failures (browser autoplay rules) are ignored so audio can never break
// a battle.
const CASE_OPEN_VOLUME = 0.5;
const caseOpenAudio = createSfx("/sounds/case_open_cs2.wav", CASE_OPEN_VOLUME);

// Two beats per round, and both sides are on the same beat so the openings are
// simultaneous: "opening" shows the case, "reveal" shows both drops at once.
const OPENING_MS = 1500;
const REVEAL_MS = 1700;
// The wallet is fictional, but charging for the containers keeps the battle
// economy consistent with opening a case on its own page. Set to false for
// completely free battles.
const BATTLES_COST_MONEY = true;

const KIND_FILTERS = ["All", "Case", "Terminal", "Collection", "Sticker Capsule"];

// ---------------------------------------------------------------- small pieces

function DropRow({ drop, isNew }) {
  if (!drop) return null;
  const rarityClass = getCssRarityClass(drop.rarityClass) || "";
  return (
    <div
      className={`${styles.dropItem} ${rarityClass ? styles[rarityClass] : ""} ${
        isNew ? styles.dropItemNew : ""
      }`}
    >
      <img src={drop.img} alt={drop.alt || drop.name} className={styles.dropImage} loading="lazy" />
      <div className={styles.dropInfo}>
        <span className={styles.dropName} title={drop.name}>
          {drop.name}
        </span>
        <span className={`${styles.dropRarity} ${rarityClass ? styles[rarityClass] : ""}`}>
          {(drop.rarityClass || "unknown").replace(/-/g, " ")}
        </span>
      </div>
      <span className={styles.dropValue}>{formatMoney(drop.value)}</span>
    </div>
  );
}

function FighterColumn({
  name,
  role,
  avatar,
  total,
  drops,
  isBot,
  isLeading,
  newestIndex,
  openingCase,
}) {
  return (
    <div
      className={`${styles.fighter} ${isBot ? styles.fighterBot : ""} ${
        isLeading ? styles.fighterLeading : ""
      }`}
    >
      <img src={avatar} alt={name} className={styles.fighterAvatar} />
      <span className={styles.fighterRole}>{role}</span>
      <span className={styles.fighterName}>{name}</span>
      <span className={styles.fighterTotal}>{formatMoney(total)}</span>
      <div className={styles.fighterItems}>
        {openingCase && (
          <div className={`${styles.dropItem} ${styles.dropItemNew}`}>
            <img src={openingCase.image} alt="" className={styles.dropImage} />
            <div className={styles.dropInfo}>
              <span className={styles.dropName}>{openingCase.name}</span>
              <span className={styles.dropRarity}>Opening…</span>
            </div>
          </div>
        )}
        {drops.length === 0 && !openingCase ? (
          <p className={styles.emptyState}>No drops yet</p>
        ) : (
          // Newest drop on top: the list grows downwards as the battle goes on.
          [...drops].reverse().map((drop, index) => (
            <DropRow
              key={`${drop.id}-${index}`}
              drop={drop}
              isNew={index === 0 && newestIndex >= 0}
            />
          ))
        )}
      </div>
    </div>
  );
}

function RoundPill({ round, index, isActive }) {
  const mine = round?.mine?.value ?? 0;
  const bot = round?.bot?.value ?? 0;
  const tint =
    !round || mine === bot
      ? styles.roundPillDraw
      : mine > bot
        ? styles.roundPillWin
        : styles.roundPillLose;
  return (
    <span
      className={`${styles.roundPill} ${tint} ${isActive ? styles.roundPillActive : ""}`}
      title={round ? `${round.caseName}` : `Round ${index + 1}`}
    >
      {index + 1}
    </span>
  );
}

// ---------------------------------------------------------------- the page

function CaseBattlePage() {
  const { walletBalance, spend, deposit, reset, isGuest } = useWallet();

  const containers = useMemo(() => getAllContainers(), []);

  // The battle opens straight on the container picker: picking "Case Battle" in the
  // header should put you in a battle, not in another menu.
  const [view, setView] = useState("setup"); // setup | battle | results | history
  // Selection keeps order and allows repeats: the same case can be opened several
  // times in one battle, exactly like a real case battle.
  const [selectedIds, setSelectedIds] = useState([]);
  const [phase, setPhase] = useState("idle"); // opening | reveal
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("All");
  const [battle, setBattle] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [notice, setNotice] = useState("");
  const [showDeposit, setShowDeposit] = useState(false);
  const [history, setHistory] = useState(() => loadHistory());
  const [prefs, setPrefs] = useState(() => loadPrefs());
  const finishedRef = useRef(null);
  // Which round's case-open sound has already played, so it never repeats.
  const soundRoundRef = useRef(-1);

  const selectedContainers = useMemo(
    () => selectedIds.map((id) => containers.find((c) => c.id === id)).filter(Boolean),
    [selectedIds, containers]
  );
  const totalCost = useMemo(
    () => Math.round(selectedContainers.reduce((sum, c) => sum + (c.price || 0), 0) * 100) / 100,
    [selectedContainers]
  );

  const visibleContainers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return containers.filter((container) => {
      if (kindFilter !== "All" && container.kind !== kindFilter) return false;
      if (query && !container.name.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [containers, search, kindFilter]);

  // Clicking a container adds it to the end of the opening order. Clicking the same
  // one again adds a second copy, so a battle can repeat a case.
  const addCase = (id) => {
    setNotice("");
    setSelectedIds((current) => {
      if (current.length >= MAX_CASES) {
        setNotice(`A battle can hold up to ${MAX_CASES} containers.`);
        return current;
      }
      return [...current, id];
    });
  };

  const removeCaseAt = (index) => {
    setNotice("");
    setSelectedIds((current) => current.filter((_, i) => i !== index));
  };

  // Quick picks draw from whatever the toolbar currently shows, so selecting
  // "Terminal" (or searching "fever") limits a random pick to those. Within that
  // set the cheaper 60% is sampled, so a random battle cannot land on a $30k
  // collector capsule.
  const pickRandom = (count) => {
    if (!visibleContainers.length) {
      setNotice("Nothing to pick from with this filter - clear the search or pick All.");
      return;
    }

    const byPrice = [...visibleContainers].sort((a, b) => a.price - b.price);
    const pool = byPrice.slice(0, Math.max(count, Math.ceil(byPrice.length * 0.6)));
    // The target must be computed before the loop: bag.length shrinks as items are
    // spliced out, and using it in the condition stopped the loop at half the pool.
    const target = Math.min(count, pool.length);
    const bag = [...pool];
    const picked = [];
    while (picked.length < target) {
      picked.push(bag.splice(Math.floor(Math.random() * bag.length), 1)[0].id);
    }

    setSelectedIds(picked);
    setNotice("");
  };

  // What a quick pick will draw from, for the button tooltips.
  const quickPickLabel = kindFilter === "All" ? "containers" : `${kindFilter.toLowerCase()} containers`;

  // -------------------------------------------------------------- running it

  const finishBattle = useCallback(
    (finished) => {
      if (!finished || finishedRef.current === finished.id) return;
      finishedRef.current = finished.id;

      const result =
        finished.myTotal > finished.botTotal
          ? "win"
          : finished.myTotal < finished.botTotal
            ? "lose"
            : "draw";

      // Winner takes all: a winning player collects both sides' drops. On a defeat
      // (or a draw, where there is no winner) the player keeps their own drops.
      const takesAll = result === "win";
      let awarded = 0;
      finished.rounds.forEach((round) => {
        if (round.mine) {
          logCaseOpeningToBackend(
            round.caseName,
            { ...round.mine, computedPrice: round.mine.value },
            { isGuest }
          );
          awarded += 1;
        }
        if (takesAll && round.bot) {
          logCaseOpeningToBackend(
            round.caseName,
            { ...round.bot, computedPrice: round.bot.value },
            { isGuest }
          );
          awarded += 1;
        }
      });

      const entry = {
        id: finished.id,
        date: new Date().toISOString(),
        cases: finished.cases.map((c) => ({ id: c.id, name: c.name, price: c.price, image: c.image })),
        rounds: finished.rounds,
        myTotal: finished.myTotal,
        botTotal: finished.botTotal,
        bot: finished.bot,
        result,
        takesAll,
        awarded,
      };
      setHistory(saveBattle(entry));
      setPrefs(loadPrefs());
      setPlaying(false);
      setPhase("idle");
      setView("results");
    },
    [isGuest]
  );

  // Round beat 1 - "opening": both sides sit on the same case, on the same beat.
  useEffect(() => {
    if (view !== "battle" || !battle || !playing || phase !== "opening") return undefined;
    if (battle.rounds.length >= battle.cases.length) return undefined;

    // The case opens for both sides on this beat - play the CS2 case-open sound
    // once per round. With animations off the round resolves instantly, so there
    // is nothing to hear.
    if (soundRoundRef.current !== battle.rounds.length) {
      soundRoundRef.current = battle.rounds.length;
      if (prefs.animations) playSfx(caseOpenAudio);
    }

    const timer = setTimeout(
      () => {
        setBattle((current) => {
          if (!current || current.rounds.length >= current.cases.length) return current;
          const container = current.cases[current.rounds.length];
          // Both drops are generated in this single update, so the two sides
          // always reveal at the same moment with matching timing.
          const round = {
            caseId: container.id,
            caseName: container.name,
            caseImage: container.image,
            mine: makeBattleDrop(container.id),
            bot: makeBattleDrop(container.id),
          };
          const rounds = [...current.rounds, round];
          return {
            ...current,
            rounds,
            myTotal: totalOf(rounds, "mine"),
            botTotal: totalOf(rounds, "bot"),
          };
        });
        setPhase("reveal");
      },
      prefs.animations ? OPENING_MS : 0
    );
    return () => clearTimeout(timer);
  }, [view, battle, playing, phase, prefs.animations]);

  // Round beat 2 - "reveal": hold the result on screen, then move to the next case
  // or finish the battle.
  useEffect(() => {
    if (view !== "battle" || !battle || !playing || phase !== "reveal") return undefined;
    const timer = setTimeout(
      () => {
        if (battle.rounds.length >= battle.cases.length) {
          finishBattle(battle);
        } else {
          setPhase("opening");
        }
      },
      prefs.animations ? REVEAL_MS : 0
    );
    return () => clearTimeout(timer);
  }, [view, battle, playing, phase, prefs.animations, finishBattle]);

  const beginBattle = async (ids) => {
    const chosen = ids.map((id) => containers.find((c) => c.id === id)).filter(Boolean);
    if (!chosen.length) {
      setNotice("Pick at least one container to open.");
      return;
    }
    const cost = Math.round(chosen.reduce((sum, c) => sum + (c.price || 0), 0) * 100) / 100;
    if (BATTLES_COST_MONEY && cost > 0) {
      const paid = await spend(cost);
      if (!paid) {
        setNotice(`You need ${formatMoney(cost)} to start this battle. Add funds to continue.`);
        setShowDeposit(true);
        return;
      }
    }
    setNotice("");
    finishedRef.current = null;
    soundRoundRef.current = -1;
    setBattle({
      id: makeBattleId(),
      cases: chosen,
      bot: pickBot(),
      rounds: [],
      myTotal: 0,
      botTotal: 0,
    });
    setView("battle");
    setPlaying(true);
    setPhase("opening");
  };

  // Jump straight to the end: fill in every remaining round, then settle the result.
  const skipToEnd = () => {
    if (!battle) return;
    const rounds = [...battle.rounds];
    for (let i = rounds.length; i < battle.cases.length; i += 1) {
      const container = battle.cases[i];
      rounds.push({
        caseId: container.id,
        caseName: container.name,
        caseImage: container.image,
        mine: makeBattleDrop(container.id),
        bot: makeBattleDrop(container.id),
      });
    }
    const finished = {
      ...battle,
      rounds,
      myTotal: totalOf(rounds, "mine"),
      botTotal: totalOf(rounds, "bot"),
    };
    setBattle(finished);
    setPlaying(false);
    setPhase("reveal");
    finishBattle(finished);
  };

  // -------------------------------------------------------------- rendering

  const rounds = battle?.rounds ?? [];
  const newestIndex = rounds.length - 1;
  const result =
    battle && rounds.length === battle.cases.length && battle.cases.length > 0
      ? battle.myTotal > battle.botTotal
        ? "win"
        : battle.myTotal < battle.botTotal
          ? "lose"
          : "draw"
      : null;

  return (
    <div className={styles.page}>
      {view === "setup" && (
        <>
          <div className={styles.setupLayout}>
            <div className={styles.pickerPanel}>
          <div className={styles.setupToolbar}>
            <input
              className={styles.searchInput}
              type="search"
              placeholder="Search containers…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className={styles.filterRow}>
              {KIND_FILTERS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className={`${styles.filterChip} ${
                    kindFilter === kind ? styles.filterChipActive : ""
                  }`}
                  onClick={() => setKindFilter(kind)}
                >
                  {kind}
                </button>
              ))}
            </div>
            <div className={styles.quickPicks}>
              <button
                type="button"
                className={styles.quickPickButton}
                onClick={() => pickRandom(3)}
                disabled={!visibleContainers.length}
                title={`Pick 3 random ${quickPickLabel}`}
              >
                Random 3
              </button>
              <button
                type="button"
                className={styles.quickPickButton}
                onClick={() => pickRandom(5)}
                disabled={!visibleContainers.length}
                title={`Pick 5 random ${quickPickLabel}`}
              >
                Random 5
              </button>
              <button type="button" className={styles.quickPickButton} onClick={() => setSelectedIds([])}>
                Clear
              </button>
            </div>
          </div>

          <div className={styles.containerGrid}>
            {visibleContainers.map((container) => {
              const count = selectedIds.filter((id) => id === container.id).length;
              const selected = count > 0;
              return (
                <button
                  key={container.id}
                  type="button"
                  className={`${styles.containerCard} ${
                    selected ? styles.containerCardActive : ""
                  }`}
                  onClick={() => addCase(container.id)}
                  title={`${container.name} — ${formatMoney(container.price)} (click again to add another copy)`}
                >
                  <span className={styles.containerArt}>
                    <img
                      src={container.image}
                      alt=""
                      className={styles.containerImage}
                      loading="lazy"
                    />
                    {selected && <span className={styles.containerCheck}>✓</span>}
                    {count > 1 && <span className={styles.containerCount}>×{count}</span>}
                  </span>
                  <span className={styles.containerName}>{container.name}</span>
                  <span className={styles.containerFoot}>
                    <span className={styles.containerKind}>{container.kind}</span>
                    <span className={styles.containerPrice}>{formatMoney(container.price)}</span>
                  </span>
                </button>
              );
            })}
            {visibleContainers.length === 0 && (
              <p className={styles.emptyState}>Nothing matches that search.</p>
            )}
          </div>
        </div>

        {/* RIGHT - your lineup: the exact opening order, the total and the start button. */}
        <aside className={styles.basketPanel}>
          <div className={styles.basketHeader}>
            <span className={styles.panelTitle}>Your battle</span>
            <span className={styles.basketCount}>
              {selectedContainers.length}/{MAX_CASES}
            </span>
          </div>

          <div className={styles.basketList}>
            {selectedContainers.length === 0 ? (
              <p className={styles.emptyState}>
                Click a container on the left to add it. Click it again to add another copy.
              </p>
            ) : (
              selectedContainers.map((container, index) => (
                <div key={`${container.id}-${index}`} className={styles.basketRow}>
                  <span className={styles.basketIndex}>{index + 1}</span>
                  <img src={container.image} alt="" className={styles.basketThumb} loading="lazy" />
                  <span className={styles.basketInfo}>
                    <span className={styles.basketName}>{container.name}</span>
                    <span className={styles.basketPrice}>{formatMoney(container.price)}</span>
                  </span>
                  <button
                    type="button"
                    className={styles.basketRemove}
                    onClick={() => removeCaseAt(index)}
                    aria-label={`Remove ${container.name} from round ${index + 1}`}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          <div className={styles.basketFooter}>
            <div className={styles.basketTotals}>
              <span className={styles.basketTotalLabel}>
                {selectedContainers.length} container(s)
              </span>
              <span className={styles.basketTotalValue}>{formatMoney(totalCost)}</span>
            </div>
            <p className={styles.basketBalance}>Balance {formatMoney(walletBalance)}</p>
            {notice && <p className={styles.notice}>{notice}</p>}
            <div className={styles.basketActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setSelectedIds([])}
                disabled={!selectedContainers.length}
              >
                Clear
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={!selectedContainers.length}
                onClick={() => beginBattle(selectedIds)}
              >
                Start battle
              </button>
            </div>
          </div>
        </aside>
      </div>
        </>
      )}

      {view === "battle" && battle && (
        <section className={styles.arena}>
          <div className={styles.arenaHeader}>
            <span className={styles.roundLabel}>
              Round {Math.min(rounds.length + (playing ? 1 : 0), battle.cases.length)} /{" "}
              {battle.cases.length}
            </span>
            {playing && rounds.length < battle.cases.length && (
              <button type="button" className={styles.skipButton} onClick={skipToEnd}>
                Skip to results
              </button>
            )}
          </div>

          <div className={styles.versus}>
            <FighterColumn
              name="You"
              role="Player"
              avatar={asset("/images/user-avatar.png")}
              total={battle.myTotal}
              drops={rounds.map((r) => r.mine)}
              isLeading={battle.myTotal > battle.botTotal}
              newestIndex={newestIndex}
              openingCase={phase === "opening" ? battle.cases[rounds.length] : null}
            />
            <span className={styles.vsBadge}>VS</span>
            <FighterColumn
              name={battle.bot.name}
              role="Bot"
              avatar={battle.bot.avatar}
              total={battle.botTotal}
              drops={rounds.map((r) => r.bot)}
              isBot
              isLeading={battle.botTotal > battle.myTotal}
              newestIndex={newestIndex}
              openingCase={phase === "opening" ? battle.cases[rounds.length] : null}
            />
          </div>

          {/* Live scoreboard line: who is ahead right now, in dollars. */}
          <p className={styles.resultDiff}>
            {battle.myTotal === battle.botTotal
              ? `Level at ${formatMoney(battle.myTotal)}`
              : battle.myTotal > battle.botTotal
                ? `You are winning by ${formatMoney(battle.myTotal - battle.botTotal)}`
                : `${battle.bot.name} is winning by ${formatMoney(battle.botTotal - battle.myTotal)}`}
          </p>

          <div className={styles.roundStrip}>
            {battle.cases.map((container, index) => (
              <RoundPill
                key={`${container.id}-${index}`}
                round={rounds[index]}
                index={index}
                isActive={index === rounds.length && playing}
              />
            ))}
          </div>

          {rounds.length > 0 && (
            <p className={styles.notice}>
              Last case: {rounds[rounds.length - 1].caseName}
            </p>
          )}
        </section>
      )}

      {view === "results" && battle && result && (
        <section className={styles.results}>
          <h2
            className={`${styles.resultBanner} ${
              result === "win"
                ? styles.resultBannerWin
                : result === "lose"
                  ? styles.resultBannerLose
                  : styles.resultBannerDraw
            }`}
          >
            {result === "win" ? "🏆 Victory!" : result === "lose" ? "💀 Defeat" : "🤝 Draw"}
          </h2>

          <div className={styles.resultScore}>
            <span>You {formatMoney(battle.myTotal)}</span>
            <span>·</span>
            <span>
              {battle.bot.name} {formatMoney(battle.botTotal)}
            </span>
          </div>
          <p className={styles.resultDiff}>
            {result === "draw"
              ? "Both totals are identical."
              : `Difference: ${formatMoney(Math.abs(battle.myTotal - battle.botTotal))}`}
          </p>

          <div className={styles.resultColumns}>
            <div className={styles.resultColumn}>
              <div className={styles.columnHeader}>
                <span>Your drops</span>
                <span className={styles.columnTotal}>{formatMoney(battle.myTotal)}</span>
              </div>
              {rounds.map((round, index) => (
                <DropRow key={`mine-${index}`} drop={round.mine} />
              ))}
            </div>
            <div className={styles.resultColumn}>
              <div className={styles.columnHeader}>
                <span>{battle.bot.name}</span>
                <span className={styles.columnTotal}>{formatMoney(battle.botTotal)}</span>
              </div>
              {rounds.map((round, index) => (
                <DropRow key={`bot-${index}`} drop={round.bot} />
              ))}
            </div>
          </div>

          <p className={styles.resultNote}>
            {result === "win"
              ? `Winner takes all — all ${rounds.length * 2} skins from this battle went to your inventory.`
              : `Defeat — your own ${rounds.length} drop(s) went to your inventory. The bot keeps its skins.`}
          </p>

          <div className={styles.resultActions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => beginBattle(battle.cases.map((c) => c.id))}
            >
              Play again
            </button>
            <button type="button" className={styles.secondaryButton} onClick={() => setView("setup")}>
              Back to cases
            </button>
            <button type="button" className={styles.secondaryButton} onClick={() => setView("history")}>
              Battle history
            </button>
          </div>
        </section>
      )}

      {view === "history" && (
        <>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Battle history</h2>
            <button type="button" className={styles.backButton} onClick={() => setView("setup")}>
              ← Back to cases
            </button>
          </div>

          {history.length === 0 ? (
            <p className={styles.emptyState}>No battles yet. Play one and it shows up here.</p>
          ) : (
            <div className={styles.historyList}>
              {history.map((entry) => (
                <div key={entry.id} className={styles.historyCard}>
                  <div className={styles.historyCardHeader}>
                    <span className={styles.historyMeta}>
                      {new Date(entry.date).toLocaleString()} · {entry.cases.length} container(s)
                    </span>
                    <span
                      className={`${styles.historyOutcome} ${
                        entry.result === "win"
                          ? styles.historyOutcomeWin
                          : entry.result === "lose"
                            ? styles.historyOutcomeLose
                            : styles.historyOutcomeDraw
                      }`}
                    >
                      {entry.result === "win" ? "WON" : entry.result === "lose" ? "LOST" : "DRAW"}
                    </span>
                  </div>
                  <p className={styles.historyScore}>
                    You {formatMoney(entry.myTotal)} vs {entry.bot?.name || "Bot"}{" "}
                    {formatMoney(entry.botTotal)}
                  </p>
                  <details>
                    <summary className={styles.historyRoundCase}>Round details</summary>
                    <div className={styles.historyRounds}>
                      {entry.rounds.map((round, index) => (
                        <div key={index} className={styles.historyRoundRow}>
                          <span className={styles.historyRoundCase}>{round.caseName}</span>
                          <div className={styles.historyItems}>
                            <DropRow drop={round.mine} />
                            <DropRow drop={round.bot} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              ))}
            </div>
          )}

          {history.length > 0 && (
            <div className={styles.resultActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setHistory(clearHistory() || [])}
              >
                Clear history
              </button>
            </div>
          )}
        </>
      )}

      {view !== "history" && notice && view !== "setup" && (
        <p className={styles.notice}>{notice}</p>
      )}

      <DepositModal
        isOpen={showDeposit}
        onClose={() => setShowDeposit(false)}
        onDeposit={deposit}
        onReset={reset}
      />
    </div>
  );
}

export default CaseBattlePage;
