import React from 'react';
import { useGameStore } from './store/gameStore';
import { LibraryScreen } from './components/mockup/LibraryScreen';
import { SonarLoadingScreen } from './components/mockup/SonarLoadingScreen';
import { CombatScreen } from './components/mockup/CombatScreen';
import { ResultsScreen } from './components/mockup/ResultsScreen';
import './mockup.css';

export const MockupApp = () => {
  const { currentScreen, depthState } = useGameStore();

  return (
    <main className="mockup-app pixel-art w-full h-screen overflow-hidden relative font-sans bg-[#061426]">
      {/* Background Layer */}
      <div className={`absolute inset-0 transition-transform duration-[3000ms] ease-in-out z-0 mockup-bg ${depthState}`}>
         <div className="mockup-ocean-img w-full" />
      </div>

      {/* Sprites Layer (only visible in combat) */}
      <div className={`absolute inset-0 z-10 transition-opacity duration-1000 ${currentScreen === 'COMBAT' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
         <div className="absolute top-[20%] left-[20%] explorer-sprite" />
         <div className="absolute top-[20%] right-[20%] enemy-sprite" />
      </div>

      {/* UI Layer */}
      <div className="absolute inset-0 z-20 flex flex-col">
        {currentScreen === 'LIBRARY' && <LibraryScreen />}
        {currentScreen === 'SONAR' && <SonarLoadingScreen />}
        {currentScreen === 'COMBAT' && <CombatScreen />}
        {currentScreen === 'RESULTS' && <ResultsScreen />}
      </div>
    </main>
  );
};
