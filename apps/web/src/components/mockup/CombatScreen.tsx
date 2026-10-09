import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { mockQuestionSet } from '../../mock/fixtureData';

export const CombatScreen = () => {
  const { hp, xp, combo, updateStats, depthState, setDepthState, setScreen } = useGameStore();
  const [qIndex, setQIndex] = useState(0);
  const [feedback, setFeedback] = useState<any>(null);

  const currentQ = mockQuestionSet.questions[qIndex];

  const handleAnswer = (idx: number) => {
    const isCorrect = idx === currentQ.correctOptionIndex;
    if (isCorrect) {
      updateStats(hp, xp + 10, combo + 1);
    } else {
      updateStats(Math.max(0, hp - 50), xp, 0);
    }
    
    setFeedback({
      isCorrect,
      explanation: currentQ.explanation,
      evidence: currentQ.evidence,
      correctIdx: currentQ.correctOptionIndex
    });
  };

  const handleNext = () => {
    setFeedback(null);
    if (hp <= 0 || qIndex >= 8) {
      setScreen('RESULTS');
    } else {
      setQIndex(prev => prev + 1);
      // Mock depth change logic
      if (qIndex === 2) setDepthState('twilight');
      if (qIndex === 5) setDepthState('midnight');
      if (qIndex === 7) setDepthState('boss');
    }
  };

  return (
    <div className="flex flex-col h-full w-full relative pt-[30%]">
      {/* Top HUD */}
      <div className="absolute top-4 left-4 right-4 flex justify-between">
         <div className="game-panel p-2 flex gap-4 font-mono text-sm">
            <div><span className="text-[#a1b5cc]">DEPTH:</span> <span className="text-[#30d6f2] uppercase">{depthState}</span></div>
            <div><span className="text-[#a1b5cc]">Q:</span> {qIndex + 1}/9</div>
         </div>
         <div className="game-panel p-2 flex gap-4 font-mono text-sm">
            <div><span className="text-[#ff4853]">HP:</span> {hp}</div>
            <div><span className="text-[#e6b957]">XP:</span> {xp}</div>
            <div><span className="text-[#30d6f2]">COMBO:</span> {combo}</div>
         </div>
      </div>

      {/* Action / Question Area */}
      <div className="absolute bottom-4 left-4 right-4 game-panel p-4 flex flex-col gap-4">
        {feedback ? (
           <div className="flex flex-col gap-3">
              <h3 className={`text-lg font-bold ${feedback.isCorrect ? 'text-[#30d6f2]' : 'text-[#ff4853]'}`}>
                {feedback.isCorrect ? 'CORRECT' : 'INCORRECT'}
              </h3>
              <p className="text-sm">{feedback.explanation}</p>
              <p className="text-xs text-[#a1b5cc] italic border-l-2 border-[#426887] pl-2">{feedback.evidence}</p>
              <button className="game-button self-end bg-[#193b5a] p-2 mt-2" onClick={handleNext}>Continue</button>
           </div>
        ) : (
          <>
            <h3 className="font-bold text-lg">{currentQ.question}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {currentQ.options.map((opt, i) => (
                <button 
                  key={i}
                  className="game-button p-2 text-left bg-[#193b5a] hover:bg-[#30d6f2]/20 border border-[#426887]"
                  onClick={() => handleAnswer(i)}
                >
                  <span className="text-[#30d6f2] mr-2">{i+1}.</span>{opt}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
