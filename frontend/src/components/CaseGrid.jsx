import React from 'react';
import CaseCard from './CaseCard.jsx';
import casesData from '../data/casesData.js';
import collectionData from '../data/collectionData.js'; // Import the new data file
import { stickerCapsules } from '../data/stickerCapsules.js'; // Generated: team sticker capsules
import styles from './CaseGrid.module.css';

function CaseGrid() {
  return (
    <section className={styles.caseGridContainer}>
      <h2 className={styles.descriptionTitle}>Open Cases, Chase the Blue Gem!</h2>
      <h3 className={styles.casesTitle}>Counter-Strike 2 Cases</h3>
      <div className={styles.caseGrid}>
        {casesData.map(caseItem => (
          <CaseCard
            key={caseItem.id}
            id={caseItem.id}
            name={caseItem.name}
            image={caseItem.image}
            price={caseItem.price}
          />
        ))}
      </div>
      
      <h3 className={styles.casesTitle}>The Collections</h3>
      <div className={styles.caseGrid}>
        {collectionData.map(collectionItem => (
          <CaseCard
            key={collectionItem.id}
            id={collectionItem.id}
            name={collectionItem.name}
            image={collectionItem.image}
            price={collectionItem.price}
          />
        ))}
      </div>

      {/* Team sticker capsules only - autograph and generic sticker capsules are
          excluded in the generated data file. */}
      <h3 className={styles.casesTitle}>Team Sticker Capsules</h3>
      <div className={styles.caseGrid}>
        {stickerCapsules.map(capsule => (
          <CaseCard
            key={capsule.id}
            id={capsule.id}
            name={capsule.name}
            image={capsule.image}
            price={capsule.price}
          />
        ))}
      </div>
    </section>
  );
}

export default CaseGrid;