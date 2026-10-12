// src/components/CaseCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import styles from './CaseCard.module.css';

// The image paths in the data are relative ("cases/Fever Case.png"), so make them
// absolute - otherwise they would resolve against the current route. Spaces are
// encoded so the file names survive any server.
const resolveImage = (image) => {
  if (!image) return null;
  if (/^https?:\/\//i.test(image) || image.startsWith('/')) return encodeURI(image);
  return encodeURI(`/${image}`);
};

function CaseCard({ id, name, image, price }) {
  const linkPath = `/open-case/${id}`;
  const imageSrc = resolveImage(image);

  return (
    <Link to={linkPath} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className={styles.case}>
        {imageSrc && (
          <img
            src={imageSrc}
            alt={name}
            className={styles.caseImage}
            loading="lazy"
            draggable="false"
            onError={(event) => {
              const img = event.currentTarget;
              // Remote artwork can fail transiently (rate limiting, a dropped
              // request), so retry once before giving up and hiding it.
              if (!img.dataset.retried) {
                img.dataset.retried = "1";
                const original = img.getAttribute("src");
                window.setTimeout(() => {
                  img.setAttribute(
                    "src",
                    original + (original.includes("?") ? "&" : "?") + "retry=1"
                  );
                }, 1200);
                return;
              }
              img.style.display = "none";
            }}
          />
        )}
        <h4>{name}</h4>
        <span className={styles.price}>${price.toFixed(2)}</span>
      </div>
    </Link>
  );
}

export default CaseCard;
