// src/pages/CaseOpeningPage.jsx
import React, { useState, useEffect, useRef } from "react";
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
} from "../utils/drops.js";
import { asset } from "../utils/assetUrl.js";

const caseOpenAudio = new Audio(asset("/sounds/case_open.mp3"));
const winAudio = new Audio(asset("/sounds/win.wav"));

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

  const [rollerSkins, setRollerSkins] = useState([]);
  const [winningSkin, setWinningSkin] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [winningItemIndex, setWinningItemIndex] = useState(-1);
  const [winnerPos, setWinnerPos] = useState(-1);
  const [showWonItemModal, setShowWonItemModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [notice, setNotice] = useState("");

  const rollerContainerRef = useRef(null);
  const rollerHolderRef = useRef(null);
  const itemRef = useRef(null);
  const animationInProgressRef = useRef(false);

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
      rollerContainerRef.current.style.transition = "transform 6s cubic-bezier(0.2, 0.8, 0.2, 1)";
      rollerContainerRef.current.style.transform = `translateX(${x}px)`;
    }
  };

  const handleGoClick = async () => {
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

    caseOpenAudio.currentTime = 0;
    caseOpenAudio.play().catch(() => {});

    const itemWidth =
      itemRef.current.offsetWidth +
      parseInt(getComputedStyle(itemRef.current).marginLeft) +
      parseInt(getComputedStyle(itemRef.current).marginRight);
    const visibleWidth = rollerHolderRef.current.offsetWidth;

    const { tempSkins, winnerSkin, winnerIndex } = generateRollerSkins();
    setRollerSkins(tempSkins);
    setWinningSkin(winnerSkin);
    setWinnerPos(winnerIndex);
    animationInProgressRef.current = true;

    rollerContainerRef.current.style.transition = "none";
    rollerContainerRef.current.style.transform = `translateX(0px)`;
    rollerContainerRef.current.offsetHeight;

    setTimeout(() => {
      animateRollerToWinner(winnerIndex, itemWidth, visibleWidth);
    }, 50);
  };

  // The Reset button was removed, so the roller is only reset by opening again.

  useEffect(() => {
    if (skinsForCase.length > 0) {
      const { tempSkins } = generateRollerSkins();
      setRollerSkins(tempSkins);
    }
  }, [caseId]);

  useEffect(() => {
    const onTransitionEnd = () => {
      if (!animationInProgressRef.current) return;
      animationInProgressRef.current = false;
      setIsRolling(false);
      setWinningItemIndex(winnerPos);

      if (winningSkin) {
        if (
          ["covert", "classified", "gold", "covert knife", "extraordinary gloves"].some((r) =>
            winningSkin.rarityClass.toLowerCase().includes(r)
          )
        ) {
          winAudio.currentTime = 0;
          winAudio.play().catch(() => {});
        }

        const price = getSkinPriceForExterior(winningSkin, winningSkin.wear_category);
        const enrichedWinner = {
          ...winningSkin,
          computedPrice: Math.round(price * 100) / 100,
        };
        setWinningSkin(enrichedWinner);
        setShowWonItemModal(true);
        // Guests keep the win in this browser only; a logged-in player also gets
        // it saved to their server inventory.
        logCaseOpeningToBackend(caseId.toUpperCase(), enrichedWinner, { isGuest });
      }
    };

    const ref = rollerContainerRef.current;
    if (ref) ref.addEventListener("transitionend", onTransitionEnd);
    return () => {
      if (ref) ref.removeEventListener("transitionend", onTransitionEnd);
    };
  }, [winningSkin, winnerPos, isGuest, caseId]);

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

        <center>
          <button className={styles.goButton} onClick={handleGoClick} disabled={isRolling}>
            {isRolling ? "Spinning..." : "Go"}
          </button>
        </center>

        {notice && <p className={styles.noticeText}>{notice}</p>}

        <SkinList initialGunSkins={gunSkins} initialSpecialSkins={specialSkins} />

        {showWonItemModal && winningSkin && (
          <div className={`${styles.wonItemModalOverlay} ${styles.show}`}>
            <div
              className={`${styles.wonItemModalContent} ${styles[getCssRarityClass(winningSkin.rarityClass)]}`}
            >
              <h3 className={styles.wonItemModalTitle}>YOU WON!</h3>
              <img src={winningSkin.img} alt={winningSkin.name} className={styles.wonItemModalImage} />
              <p className={styles.wonItemModalName}>{winningSkin.name}</p>
              {winningSkin.wear_category && (
                <p className={styles.wonItemModalWearCategory}>Exterior: {winningSkin.wear_category}</p>
              )}
              {winningSkin.float && (
                <p className={styles.wonItemModalWearRating}>Wear Rating: {winningSkin.float}</p>
              )}
              {/* The rarity class was never applied here, so the tag fell back to an
                  inherited dark colour. It now uses the rarity colour when known. */}
              <p
                className={`${styles.wonItemModalRarity} ${
                  styles[getCssRarityClass(winningSkin.rarityClass)] || ""
                }`}
              >
                {winningSkin.rarityClass.replace(/_/g, " ").toUpperCase()}
              </p>
              {winningSkin.computedPrice && (
                <p className={styles.wonItemModalPrice}>
                  Price: {formatDollar(winningSkin.computedPrice)}
                </p>
              )}
              {isGuest && (
                <p className={styles.wonItemModalWearCategory}>
                  Guest win - log in to keep this skin in your inventory.
                </p>
              )}
              <div className={styles.wonItemModalButtons}>
                <button className={styles.modalCloseButton} onClick={() => setShowWonItemModal(false)}>
                  Close
                </button>
                <button
                  className={styles.modalOpenAgainButton}
                  onClick={() => {
                    setShowWonItemModal(false);
                    handleGoClick();
                  }}
                >
                  Open Again
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