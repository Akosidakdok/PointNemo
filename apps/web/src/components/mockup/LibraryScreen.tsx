import React from 'react';
import { useGameStore } from '../../store/gameStore';

export const LibraryScreen = () => {
  const setScreen = useGameStore(s => s.setScreen);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[#061426]/80 text-[#eaf4fc] p-8">
      <div className="game-panel p-8 max-w-md w-full flex flex-col gap-6 text-center">
        <h1 className="text-2xl font-bold text-[#30d6f2]">Point Nemo Library</h1>
        <p className="text-[#a1b5cc] text-sm">Upload a PDF to generate a new ocean descent lesson.</p>
        
        <div className="border-2 border-dashed border-[#426887] p-8 rounded bg-[#0b1e38]">
          <p>Drag & Drop PDF here</p>
          <p className="text-xs text-[#a1b5cc] mt-2">Max 5MB, 3 pages</p>
        </div>
        
        <div className="flex flex-col gap-3">
          <button 
            className="game-button bg-[#30d6f2]/20 hover:bg-[#30d6f2]/40 text-[#30d6f2] font-bold py-3 px-4 border-2 border-[#30d6f2] shadow-[4px_4px_0_#030912] active:translate-y-1 active:shadow-[2px_2px_0_#030912] transition-all"
            onClick={() => setScreen('SONAR')}
          >
            Start Mock Descent
          </button>
        </div>
      </div>
    </div>
  );
};
