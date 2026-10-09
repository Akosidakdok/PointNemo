import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';

export const SonarLoadingScreen = () => {
  const setScreen = useGameStore(s => s.setScreen);
  const [status, setStatus] = useState('Extracting text...');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => { setStatus('Generating questions...'); setProgress(40); }, 1500);
    const t2 = setTimeout(() => { setStatus('Validating structure...'); setProgress(80); }, 3000);
    const t3 = setTimeout(() => { setScreen('COMBAT'); }, 4500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [setScreen]);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[#061426]/90 text-[#eaf4fc]">
      <div className="game-panel p-8 max-w-md w-full text-center flex flex-col items-center gap-6">
        <div className="relative w-32 h-32 border-4 border-[#426887] rounded-full flex items-center justify-center overflow-hidden">
           <div className="absolute inset-0 border-4 border-[#30d6f2] rounded-full animate-ping opacity-20"></div>
           <div className="w-full h-1 bg-[#30d6f2] absolute top-1/2 left-0 origin-left animate-[spin_2s_linear_infinite] opacity-50"></div>
           <span className="text-[#30d6f2] font-mono">{progress}%</span>
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2">Sonar Scan Active</h2>
          <p className="text-[#a1b5cc] font-mono h-6">{status}</p>
        </div>
        <button 
          className="mt-4 px-4 py-2 border-2 border-[#ff4853] text-[#ff4853] hover:bg-[#ff4853]/20 transition-colors shadow-[2px_2px_0_#030912]"
          onClick={() => setScreen('LIBRARY')}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
