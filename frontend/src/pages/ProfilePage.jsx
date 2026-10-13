import React, { useEffect, useState } from "react";
import styles from "./ProfilePage.module.css";



import { useWallet } from "../context/WalletContext.jsx";
import { asset } from "../utils/assetUrl.js";
import { apiUrl, hasBackend } from "../utils/apiBase.js";


const ProfilePage = () => {
  const { walletBalance } = useWallet();
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState(asset("/images/user-avatar.png"));
  const [userInventory, setUserInventory] = useState([]);

  const getCssRarityClass = (rarityClassString) => {
    const lc = rarityClassString.toLowerCase();
    if (lc.includes("covert knife")) return styles.covertKnife;
    if (lc.includes("extraordinary gloves")) return styles.extraordinaryGloves;
    if (lc.includes("mil-spec")) return styles.milSpec;
    if (lc.includes("restricted")) return styles.restricted;
    if (lc.includes("classified")) return styles.classified;
    if (lc.includes("covert")) return styles.covert;
    if (lc.includes("consumer grade")) return styles.consumerGrade;
    return "";
  };

  useEffect(() => {
    async function fetchProfile() {
      // The profile lives on the backend, which is not part of the static build.
      if (!hasBackend()) return;
      try {
        const res = await fetch(apiUrl("/api/profile"), {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch profile");
        const data = await res.json();
        setUserName(data.name);
        setUserAvatar(data.avatar);
        setUserInventory(data.inventory);
      } catch (error) {
        console.error(error);
      }
    }
    fetchProfile();
  }, []);

  return (
    <>
     
      <main className={styles.pageContainer}>
        <section className={styles.userSection}>
          <img
            src={userAvatar}
            alt={`${userName} avatar`}
            className={styles.userAvatar}
          />
          <h1 className={styles.userName}>{userName}</h1>
          <p className={styles.walletBalance}>
            Wallet Balance: ${walletBalance.toFixed(2)}
          </p>
        </section>

        <section className={styles.inventorySection}>
          <h2 className={styles.inventoryTitle}>Your Inventory</h2>

          {userInventory.length === 0 ? (
            <p className={styles.emptyInventory}>You don’t have any skins yet.</p>
          ) : (
            <div className={styles.inventoryGrid}>
              {userInventory.map((skin) => {
                const rarityClass = getCssRarityClass(skin.rarityClass);
                const nameParts = skin.name.split(" | ");
                const nameTop = nameParts[0];
                const nameBottom = nameParts[1];

                return (
                  <div key={skin._id} className={`${styles.skinCard} ${rarityClass}`}>
                    <img src={skin.image} alt={skin.name} className={styles.skinCardImage} />
                    <div className={styles.skinCardNameTop}>{nameTop}</div>
                    {nameBottom && (
                      <div className={styles.skinCardNameBottom}>{nameBottom}</div>
                    )}

                    <div className={`${styles.skinCardRarityType} ${rarityClass}`}>
                      {skin.rarityClass.replace(/-/g, " ")}
                    </div>

                    <div className={styles.skinCardPrice}>
                      {typeof skin.value === "number" && !isNaN(skin.value)
                        ? `$${skin.value.toFixed(2)}`
                        : "No Price"}
                    </div>

                    <div className={styles.skinCardDetails}>
                      <span className={styles.detailLabel}>Wear:</span>{" "}
                      {parseFloat(skin.wear).toFixed(4)}
                      <br />
                      <span className={styles.detailLabel}>Exterior:</span> {skin.exterior}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
      
    </>
  );
};

export default ProfilePage;
