// src/pages/HomePage.jsx
import React from 'react';
import GameModes from '../components/GameModes.jsx';
import CaseGrid from '../components/CaseGrid.jsx';

function HomePage() {
  return (
    <>
      {/* The three game modes first, so they are the obvious next step after the
          cases rather than something hidden in the header. */}
      <GameModes />
      <CaseGrid />
    </>
  );
}

export default HomePage;
