// src/pages/CaseOpeningPage.jsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";

import SkinList from "../components/SkinList.jsx";
import DepositModal from "../components/DepositModal.jsx";
// The file on disk is AllSkinsData.js - this import was lower-cased, which works
// on Windows but breaks the build on any case-sensitive file system (Linux, CI).
import allSkinsData from "../data/AllSkinsData.js";
import collectionsData from "../data/collection.js";
import styles from "./CaseOpeningPage.module.css";
import { useWallet } from "../context/WalletContext";
import casesData from "../data/casesData";
import collectionData from "../data/collectionData.js";
// Generated data for the team sticker capsules (see CS2-Skin-Fetcher).
import { stickerCapsules, stickerCapsuleSkins } from "../data/stickerCapsules.js";
import { specialRarityClasses, getCssRarityClass } from "../components/SkinList.jsx";
import { logCaseOpeningToBackend } from "../utils/logCaseOpening";
import { getSkinPriceForExterior } from "../utils/skinUtils.js";
// Shared drop odds - the same tables the Case Battle mode uses, so both modes
// always agree on rarity and exterior probabilities.
import {
  getRandomInt,
  generateFloatForExterior,
  selectRandomRarity,
  selectRandomExterior,
  getSkinsByRarityCategory,
  RARITY_PROBABILITIES,
} from "../utils/drops.js";
import { asset } from "../utils/assetUrl.js";
import { createSfx, playSfx } from "../utils/sfx.js";

// Built through createSfx so they are tracked and stopped cleanly when the page
// goes away - a media element destroyed mid-playback pops through the speakers.
const caseOpenAudio = createSfx("/sounds/case_open.mp3", 1);
const quickOpenAudio = createSfx("/sounds/quick_open.mp3", 0.9);
// Titan Holo Mod: the sticker sound, offered only on the capsule that contains it.
const titanHoloAudio = createSfx("/sounds/titan_holo.mp3", 0.85);
const TITAN_MOD_CAPSULE = "ems-katowice-2014-legends";

// How long the reel spins. Quick open skips this entirely.
const ROLL_MS = 6000;
// Quick open shows the popup almost immediately, before the reel reveals anything.
const QUICK_REVEAL_MS = 40;

const formatDollar = (value) => {
  if (typeof value !== "number" || isNaN(value)) {
    return "N/A";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
};

const getRarityLineColor = (rarityClass) => {
  const css = getCssRarityClass(rarityClass);
  switch (css) {
    case "covert":
      return "#eb4b4b";
    case "classified":
      return "#d22fe6";
    case "restricted":
      return "#8846fe";
    case "mil-spec":
      return "#4b68fe";
    case "industrial-grade":
      return "#5e98d9";
    case "consumer-grade":
      return "#b0c3d9";
    case "gold":
    case "covert-knife":
    case "extraordinary-gloves":
      return "#fed600";
    default:
      return "rgba(255, 255, 255, 0.2)";
  }
};

function CaseOpeningPage() {
  const { caseId } = useParams();
  const { walletBalance, spend, deposit, reset, loading: walletLoading, isGuest } = useWallet();
  const caseDetails = casesData.find((c) => c.id === caseId);
  const collectionDetails = collectionData.find((c) => c.id === caseId);
  const capsuleDetails = stickerCapsules.find((c) => c.id === caseId);
  const casePrice =
    caseDetails?.price ?? collectionDetails?.price ?? capsuleDetails?.price ?? 0;
  // Collections and sticker capsules live in their own files, so fall back to them
  // when the id is not one of the main cases.
  const skinsForCase =
    allSkinsData[caseId] ||
    collectionsData[caseId] ||
    stickerCapsuleSkins[caseId] ||
    [];
  const canOpenCase = walletBalance >= casePrice;

  // Chances for each rarity colour, from the same table the roller itself uses.
  // "gold" covers both knifes and gloves, so it is shown as two entries whose
  // shares still add up to the single gold probability - nothing is invented, the
  // total chance of a gold drop is unchanged.
  const rarityOdds = (() => {
    const GOLD_SPLIT = [
      { key: "knife", label: "Knife", share: 0.962, color: "#f7c948" },
      { key: "gloves", label: "Gloves", share: 0.038, color: "#3ddad7" },
    ];

    const entries = RARITY_PROBABILITIES.flatMap((entry) => {
      const split = entry.name === "gold" ? GOLD_SPLIT : null;
      if (split) {
        return split.map((part) => ({
          key: part.key,
          label: part.label,
          color: part.color,
          probability: entry.probability * part.share,
        }));
      }
      return [
        {
          key: entry.name,
          label: entry.name.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
          color: getRarityLineColor(entry.name),
          probability: entry.probability,
        },
      ];
    });

    // Normalised so the printed percentages add up to exactly 100% and the bar
    // segment widths match the numbers beside them.
    const total = entries.reduce((sum, entry) => sum + entry.probability, 0);
    return entries.map((entry) => ({
      ...entry,
      percent: (entry.probability / total) * 100,
      probability: entry.probability / total,
    }));
  })();

  const [rollerSkins, setRollerSkins] = useState([]);
  const [winningSkin, setWinningSkin] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [winningItemIndex, setWinningItemIndex] = useState(-1);
  const [showWonItemModal, setShowWonItemModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [notice, setNotice] = useState("");
  // Only the EMS Katowice 2014 Legends capsule offers the Titan Holo Mod.
  const [titanMod, setTitanMod] = useState(false);
  const hasTitanMod = caseId === TITAN_MOD_CAPSULE;

  const rollerContainerRef = useRef(null);
  const rollerHolderRef = useRef(null);
  const itemRef = useRef(null);
  const animationInProgressRef = useRef(false);
  // The resolved winner of the round in flight, kept in a ref so the reveal can be
  // triggered by the transition, the quick-open timer or the safety net.
  const winnerRef = useRef(null);
  const revealTimerRef = useRef(null);
  const fallbackTimerRef = useRef(null);
  // Whether the round was quick-opened, and where the reel has to stop so it can be
  // parked behind the popup instead of spoiling the result.
  const quickRef = useRef(false);
  const winnerXRef = useRef(0);
  // Which button started the last round, so "Open Again" repeats that mode.
  const lastQuickRef = useRef(false);

  const specialSkins = skinsForCase.filter((skin) =>
    specialRarityClasses.includes(skin.rarityClass.toLowerCase())
  );
  const gunSkins = skinsForCase.filter(
    (skin) => !specialRarityClasses.includes(skin.rarityClass.toLowerCase())
  );

  const generateRollerSkins = () => {
    const tempSkins = [];
    const numRandomSkins = getRandomInt(150, 200);
    for (let i = 0; i < numRandomSkins; i++) {
      const rarity = selectRandomRarity();
      const skinsOfRarity = getSkinsByRarityCategory(rarity, skinsForCase);
      const skin = skinsOfRarity.length
        ? skinsOfRarity[getRandomInt(0, skinsOfRarity.length - 1)]
        : skinsForCase[getRandomInt(0, skinsForCase.length - 1)];
      const exterior = selectRandomExterior();
      const float = generateFloatForExterior(exterior);
      tempSkins.push({ ...skin, wear_category: exterior, float });
    }

    const winnerSkins = getSkinsByRarityCategory(selectRandomRarity(), skinsForCase);
    const winner = winnerSkins.length
      ? winnerSkins[getRandomInt(0, winnerSkins.length - 1)]
      : skinsForCase[getRandomInt(0, skinsForCase.length - 1)];

    const exterior = selectRandomExterior();
    const float = generateFloatForExterior(exterior);
    const finalWinner = { ...winner, wear_category: exterior, float };
    const winnerIndex = getRandomInt(numRandomSkins - 30, numRandomSkins - 10);
    tempSkins.splice(winnerIndex, 0, finalWinner);

    return { tempSkins, winnerSkin: finalWinner, winnerIndex };
  };

  const animateRollerToWinner = (index, itemWidth, visibleWidth) => {
    const x = visibleWidth / 2 - (index * itemWidth + itemWidth / 2);
    if (rollerContainerRef.current) {
      rollerContainerRef.current.style.transition = `transform ${ROLL_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
      rollerContainerRef.current.style.transform = `translateX(${x}px)`;
    }
  };

  // The only place a round ends. Guarded by the in-progress flag, so a bubbling
  // child transition, a late timer or a double click can never reveal twice - and
  // never before the reel has actually rolled.
  const revealWinner = useCallback(() => {
    if (!animationInProgressRef.current) return;
    animationInProgressRef.current = false;
    clearTimeout(revealTimerRef.current);
    clearTimeout(fallbackTimerRef.current);
    revealTimerRef.current = null;
    fallbackTimerRef.current = null;

    const resolved = winnerRef.current;
    setIsRolling(false);
    setWinningItemIndex(resolved ? resolved.index : -1);
    if (!resolved) return;

    const skin = resolved.skin;

    const price = getSkinPriceForExterior(skin, skin.wear_category);
    const enrichedWinner = { ...skin, computedPrice: Math.round(price * 100) / 100 };
    setWinningSkin(enrichedWinner);
    setShowWonItemModal(true);

    // A quick open leaves the reel at the start until now; park it on the winning
    // item while the popup covers the screen, so closing it shows a sane reel.
    if (quickRef.current && rollerContainerRef.current) {
      rollerContainerRef.current.style.transition = "none";
      rollerContainerRef.current.style.transform = `translateX(${winnerXRef.current}px)`;
    }
    // Guests keep the win in this browser only; a logged-in player also gets it
    // saved to their server inventory.
    logCaseOpeningToBackend(caseId.toUpperCase(), enrichedWinner, { isGuest });
  }, [caseId, isGuest]);

  const handleGoClick = async (quick = false) => {
    if (isRolling || animationInProgressRef.current) return;
    if (!canOpenCase) {
      // Broke: offer to top up right here instead of sending the player away.
      // Guests deposit fake money, so anyone can keep playing.
      setNotice(
        `You need ${formatDollar(casePrice)} to open this case. Add funds to continue.`
      );
      setShowDepositModal(true);
      return;
    }

    setNotice("");
    const success = await spend(casePrice);
    if (!success) {
      setNotice("That opening could not be paid for. Please try again.");
      return;
    }

    if (!rollerContainerRef.current || !rollerHolderRef.current || !itemRef.current) return;

    setIsRolling(true);
    setWinningItemIndex(-1);
    setShowWonItemModal(false);

    // Quick open is instant, so it plays a short snap instead of the long reel
    // sound - which would just be a click under a 260ms reveal.
    // Quick open always keeps its own short snap - the Titan Holo Mod only applies
    // to a full reel spin, so the mod never fires on an instant open.
    if (quick) {
      playSfx(quickOpenAudio);
    } else if (titanMod && hasTitanMod) {
      playSfx(titanHoloAudio);
    } else {
      playSfx(caseOpenAudio);
    }

    const itemWidth =
      itemRef.current.offsetWidth +
      parseInt(getComputedStyle(itemRef.current).marginLeft) +
      parseInt(getComputedStyle(itemRef.current).marginRight);
    const visibleWidth = rollerHolderRef.current.offsetWidth;

    const { tempSkins, winnerSkin, winnerIndex } = generateRollerSkins();
    setRollerSkins(tempSkins);
    setWinningSkin(winnerSkin);
    // The index lives in the ref too, so the reveal does not depend on state timing.
    winnerRef.current = { skin: winnerSkin, index: winnerIndex };
    animationInProgressRef.current = true;

    // Park the reel at the start with transitions off, so the reset never emits a
    // transitionend of its own.
    rollerContainerRef.current.style.transition = "none";
    rollerContainerRef.current.style.transform = "translateX(0px)";
    rollerContainerRef.current.offsetHeight;

    // Quick open: the reel stays where it is until the popup covers it, so the
    // winning item is never visible before the reveal.
    quickRef.current = quick;
    lastQuickRef.current = quick;
    winnerXRef.current = visibleWidth / 2 - (winnerIndex * itemWidth + itemWidth / 2);

    if (quick) {
      revealTimerRef.current = setTimeout(revealWinner, QUICK_REVEAL_MS);
      return;
    }

    revealTimerRef.current = setTimeout(() => {
      animateRollerToWinner(winnerIndex, itemWidth, visibleWidth);
    }, 50);

    // Safety net: if transitionend never arrives (hidden tab, interrupted
    // transition), the round still resolves instead of hanging on "Spinning...".
    fallbackTimerRef.current = setTimeout(revealWinner, ROLL_MS + 900);
  };

  // The Reset button was removed, so the roller is only reset by opening again.

  useEffect(() => {
    if (skinsForCase.length > 0) {
      const { tempSkins } = generateRollerSkins();
      setRollerSkins(tempSkins);
    }
  }, [caseId]);

  useEffect(() => {
    const onTransitionEnd = (event) => {
      // Child elements bubble their transitions up here too - that is what used to
      // pop the win modal before the reel had even started moving. Only the
      // roller's own transform transition is allowed to end a round.
      if (event.target !== rollerContainerRef.current) return;
      if (event.propertyName !== "transform") return;
      revealWinner();
    };

    const ref = rollerContainerRef.current;
    if (ref) ref.addEventListener("transitionend", onTransitionEnd);
    return () => {
      if (ref) ref.removeEventListener("transitionend", onTransitionEnd);
    };
  }, [revealWinner]);

  // Never leave a reveal timer running after the page is left.
  useEffect(
    () => () => {
      clearTimeout(revealTimerRef.current);
      clearTimeout(fallbackTimerRef.current);
    },
    []
  );

  // Note the braces: an effect must never return a value. The concise form
  // (() => window.scrollTo(0, 0)) returns whatever scrollTo returns, and React
  // treats any returned value as a cleanup function - so on unmount (StrictMode
  // does this right after mount) it called a string and the whole page died with
  // "destroy is not a function". Extensions such as Google Translate replace
  // window.scrollTo with a version that does return a value.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Anyone can look at a case, guests included: there is no redirect away when
  // the balance is empty. The Go button offers to add funds instead.

  // While the balance is still being fetched we know nothing yet, so show a
  // loading state. Rendering nothing here is what caused a blank white page.
  if (walletLoading) {
    return (
      <div className={styles.pageContainer}>
        <h2 className={styles.caseTitle}>Loading...</h2>
      </div>
    );
  }

  if (!caseId || skinsForCase.length === 0) {
    return (
      <>
        
        <div className={styles.pageContainer}>
          <h2 className={styles.caseTitle}>Error</h2>
          <p className={styles.errorText}>
            Case "{caseId}" not found or contains no skins. Please go back.
          </p>
          <Link to="/" className={styles.backButton}>
            Back to Home
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      
      <div className={styles.pageContent}>
        <h2 className={styles.caseTitle}>{caseId.toUpperCase()}</h2>

        <div className={styles.raffleRoller}>
          <div className={styles.raffleRollerHolder} ref={rollerHolderRef}>
            <div className={styles.raffleRollerContainer} ref={rollerContainerRef}>
              {rollerSkins.map((skin, index) => {
                const isWinner = index === winningItemIndex && !isRolling;
                const isMystery = specialRarityClasses.includes(skin.rarityClass.toLowerCase());
                const imageSrc = isMystery ? asset("/images/gold.png") : skin.img;
                const rarityColor = getRarityLineColor(skin.rarityClass);

                return (
                  <div
                    key={`${skin.id}-${index}`}
                    ref={index === 0 ? itemRef : null}
                    className={`${styles.item} ${isWinner ? styles.winningItem : ""}`}
                    data-rarity-css={getCssRarityClass(skin.rarityClass)}
                    style={{ backgroundImage: `url(${imageSrc})` }}
                  >
                    <div
                      className={styles.rarityLine}
                      style={{
                        background: `linear-gradient(to top, ${rarityColor} 10%, transparent 100%)`,
                      }}
                    ></div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className={styles.winningLine}></div>
        </div>

        <div className={styles.openButtons}>
          <button
            className={styles.goButton}
            onClick={() => handleGoClick(false)}
            disabled={isRolling}
          >
            {isRolling ? "Spinning..." : "Go"}
          </button>
          <button
            className={styles.quickButton}
            onClick={() => handleGoClick(true)}
            disabled={isRolling}
            title="Open instantly, without the reel animation"
          >
            Quick open
          </button>

          {/* Titan Holo Mod: this capsule only. Sliding it on swaps the opening
              sound for the Titan Holo sticker sound. */}
          {hasTitanMod && (
            <button
              type="button"
              role="switch"
              aria-checked={titanMod}
              className={`${styles.titanMod} ${titanMod ? styles.titanModOn : ""}`}
              onClick={() => setTitanMod((on) => !on)}
              disabled={isRolling}
              title="Play the Titan Holo (Katowice 2014) sound when opening"
            >
              <span className={styles.titanTrack} aria-hidden="true">
                <span className={styles.titanKnob} />
              </span>
              <span className={styles.titanLabel}>
                Titan Holo Mod
                <span className={styles.titanState}>{titanMod ? "On" : "Off"}</span>
              </span>
            </button>
          )}
        </div>

        {notice && <p className={styles.noticeText}>{notice}</p>}

        {/* Drop chances per rarity colour and the best items in this case. */}
        <div className={styles.infoPanels}>
          <section className={styles.oddsPanel}>
            <h3 className={styles.panelTitle}>Drop Odds</h3>
            <div className={styles.oddsBar} aria-hidden="true">
              {rarityOdds.map((entry) => (
                <span
                  key={entry.key}
                  className={styles.oddsSegment}
                  style={{ flexGrow: entry.probability, background: entry.color }}
                  title={`${entry.label} ${entry.percent.toFixed(2)}%`}
                />
              ))}
            </div>
            <ul className={styles.oddsList}>
              {rarityOdds.map((entry) => (
                <li key={entry.key}>
                  <span className={styles.oddsLabelRow}>
                    <span className={styles.oddsDot} style={{ background: entry.color }} />
                    <span className={styles.oddsName}>{entry.label}</span>
                  </span>
                  <b className={styles.oddsPct}>{entry.percent.toFixed(2)}%</b>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div id="case-skins">
          <SkinList initialGunSkins={gunSkins} initialSpecialSkins={specialSkins} />
        </div>

        {showWonItemModal && winningSkin && (
          <div
            className={styles.winOverlay}
            onClick={() => setShowWonItemModal(false)}
            role="dialog"
            aria-modal="true"
            aria-label="You won"
          >
            <div
              className={styles.winCard}
              style={{ "--win-accent": getRarityLineColor(winningSkin.rarityClass) }}
              onClick={(event) => event.stopPropagation()}
            >
              <span className={styles.winRibbon} aria-hidden="true" />

              <div className={styles.winHead}>
                <span className={styles.winEyebrow}>{caseId.toUpperCase()}</span>
                <h3 className={styles.winTitle}>You Won</h3>
              </div>

              <div className={styles.winArt}>
                <img src={winningSkin.img} alt={winningSkin.name} className={styles.winArtImage} />
              </div>

              <span className={styles.winName}>{winningSkin.name}</span>

              <span className={styles.winRarity}>
                <i style={{ background: getRarityLineColor(winningSkin.rarityClass) }} />
                {winningSkin.rarityClass.replace(/_/g, " ").toUpperCase()}
              </span>

              <div className={styles.winStats}>
                {winningSkin.wear_category && (
                  <div className={styles.winStatRow}>
                    <span>Exterior</span>
                    <b>{winningSkin.wear_category}</b>
                  </div>
                )}
                {winningSkin.float && (
                  <div className={styles.winStatRow}>
                    <span>Wear rating</span>
                    <b>{winningSkin.float}</b>
                  </div>
                )}
              </div>

              {winningSkin.computedPrice && (
                <div className={styles.winValue}>
                  <span className={styles.winValueLabel}>Value</span>
                  <span className={styles.winValueAmount}>
                    {formatDollar(winningSkin.computedPrice)}
                  </span>
                </div>
              )}

              {isGuest && (
                <p className={styles.winNote}>
                  Guest win — log in to keep this skin in your inventory.
                </p>
              )}

              <div className={styles.winActions}>
                <button
                  className={styles.winGhost}
                  onClick={() => setShowWonItemModal(false)}
                >
                  Close
                </button>
                <button
                  className={styles.winPrimary}
                  onClick={() => {
                    setShowWonItemModal(false);
                    // Repeat whichever mode was used last: quick stays quick,
                    // normal stays normal.
                    handleGoClick(lastQuickRef.current);
                  }}
                >
                  {lastQuickRef.current ? "Quick Open" : "Open Again"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <DepositModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        onDeposit={deposit}
        onReset={reset}
      />
    </>
  );
}

export default CaseOpeningPage;