import React from 'react';
import { useGameStore } from '../../store/gameStore';

export const ResultsScreen = () => {
  const { hp, xp, resetRun } = useGameStore();
  const isWin = hp > 0;

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[#061426]/90 text-[#eaf4fc] p-8 z-50">
      <div className="game-panel p-8 max-w-md w-full text-center flex flex-col gap-6">
        <h1 className={`text-3xl font-bold ${isWin ? 'text-[#30d6f2]' : 'text-[#ff4853]'}`}>
          {isWin ? 'Descent Complete' : 'Mission Failed'}
        </h1>
        
        <div className="bg-[#193b5a] p-4 border border-[#426887]">
           <div className="flex justify-between py-1 border-b border-[#426887]">
             <span className="text-[#a1b5cc]">Final HP</span>
             <span className="font-mono">{hp}</span>
           </div>
           <div className="flex justify-between py-1">
             <span className="text-[#a1b5cc]">Total XP</span>
             <span className="font-mono text-[#e6b957]">{xp}</span>
           </div>
        </div>

        {isWin && (
          <div className="text-sm text-[#a1b5cc]">
            You successfully navigated all depth zones and completed the mixed-topic review!
          </div>
        )}

        <button 
          className="game-button bg-[#30d6f2]/20 text-[#30d6f2] p-3 border-2 border-[#30d6f2]"
          onClick={resetRun}
        >
          Return to Library
        </button>
      </div>
    </div>
  );
};
