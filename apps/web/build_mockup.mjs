import fs from 'node:fs';
import path from 'node:path';

const files = {
  'src/mock/fixtureData.ts': `
export const mockQuestionSet = {
  id: "qs_mock123",
  documentId: "doc_mock123",
  topics: [
    { id: "t1", name: "IP Addressing" },
    { id: "t2", name: "DNS" },
    { id: "t3", name: "HTTP" }
  ],
  questions: [
    { id: "q1", topicId: "t1", difficulty: "easy", question: "What does IP stand for?", options: ["Internet Protocol", "Internal Process", "Internet Provider", "International Protocol"], correctOptionIndex: 0, explanation: "IP stands for Internet Protocol.", evidence: "Page 1: IP stands for Internet Protocol." },
    { id: "q2", topicId: "t1", difficulty: "medium", question: "How many bits are in an IPv4 address?", options: ["16", "32", "64", "128"], correctOptionIndex: 1, explanation: "IPv4 addresses are 32-bit numbers.", evidence: "Page 1: IPv4 uses a 32-bit address space." },
    { id: "q3", topicId: "t1", difficulty: "hard", question: "Which of these is a valid private IP?", options: ["8.8.8.8", "192.168.1.1", "256.0.0.1", "1.1.1.1"], correctOptionIndex: 1, explanation: "192.168.x.x is reserved for private networks.", evidence: "Page 1: Private IP ranges include 192.168.0.0/16." },
    { id: "q4", topicId: "t2", difficulty: "easy", question: "What does DNS do?", options: ["Encrypts traffic", "Translates names to IPs", "Blocks ads", "Speeds up internet"], correctOptionIndex: 1, explanation: "DNS translates domain names into IP addresses.", evidence: "Page 2: DNS acts as the phonebook of the internet, translating hostnames to IPs." },
    { id: "q5", topicId: "t2", difficulty: "medium", question: "What port does DNS typically use?", options: ["21", "22", "53", "80"], correctOptionIndex: 2, explanation: "DNS uses port 53.", evidence: "Page 2: DNS queries are typically sent over UDP port 53." },
    { id: "q6", topicId: "t2", difficulty: "hard", question: "What is an A record?", options: ["Alias", "Address record", "Mail exchange", "Text record"], correctOptionIndex: 1, explanation: "An A record maps a name to an IPv4 address.", evidence: "Page 2: A records (Address records) map a domain to an IPv4 address." },
    { id: "q7", topicId: "t3", difficulty: "easy", question: "What does HTTP stand for?", options: ["HyperText Transfer Protocol", "High-level Text Transfer", "Hyper Transfer Text", "Host Text Transfer"], correctOptionIndex: 0, explanation: "HTTP is HyperText Transfer Protocol.", evidence: "Page 3: HTTP (HyperText Transfer Protocol) is the foundation of data communication." },
    { id: "q8", topicId: "t3", difficulty: "medium", question: "Which method is used to submit data?", options: ["GET", "POST", "HEAD", "OPTIONS"], correctOptionIndex: 1, explanation: "POST is used to submit data to the server.", evidence: "Page 3: The POST method submits an entity to the specified resource." },
    { id: "q9", topicId: "t3", difficulty: "hard", question: "What does a 404 status code mean?", options: ["OK", "Not Found", "Forbidden", "Server Error"], correctOptionIndex: 1, explanation: "404 indicates the resource could not be found.", evidence: "Page 3: A 404 Not Found response indicates the server cannot find the requested resource." }
  ]
};
`,
  'src/store/gameStore.ts': `
import { create } from 'zustand';

export type ScreenState = 'LIBRARY' | 'SONAR' | 'COMBAT' | 'RESULTS';

interface GameState {
  currentScreen: ScreenState;
  hp: number;
  xp: number;
  combo: number;
  depthState: 'surface' | 'twilight' | 'midnight' | 'boss';
  setScreen: (screen: ScreenState) => void;
  updateStats: (hp: number, xp: number, combo: number) => void;
  setDepthState: (depth: 'surface' | 'twilight' | 'midnight' | 'boss') => void;
  resetRun: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  currentScreen: 'LIBRARY',
  hp: 100,
  xp: 0,
  combo: 0,
  depthState: 'surface',
  setScreen: (screen) => set({ currentScreen: screen }),
  updateStats: (hp, xp, combo) => set({ hp, xp, combo }),
  setDepthState: (depth) => set({ depthState: depth }),
  resetRun: () => set({ hp: 100, xp: 0, combo: 0, currentScreen: 'LIBRARY', depthState: 'surface' }),
}));
`,
  'src/components/mockup/LibraryScreen.tsx': `
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
`,
  'src/components/mockup/SonarLoadingScreen.tsx': `
import React, { useEffect, useState } from 'react';
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
`,
  'src/components/mockup/CombatScreen.tsx': `
import React, { useState } from 'react';
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
              <h3 className={\`text-lg font-bold \${feedback.isCorrect ? 'text-[#30d6f2]' : 'text-[#ff4853]'}\`}>
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
`,
  'src/components/mockup/ResultsScreen.tsx': `
import React from 'react';
import { useGameStore } from '../../store/gameStore';

export const ResultsScreen = () => {
  const { hp, xp, resetRun } = useGameStore();
  const isWin = hp > 0;

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[#061426]/90 text-[#eaf4fc] p-8 z-50">
      <div className="game-panel p-8 max-w-md w-full text-center flex flex-col gap-6">
        <h1 className={\`text-3xl font-bold \${isWin ? 'text-[#30d6f2]' : 'text-[#ff4853]'}\`}>
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
`,
  'src/MockupApp.tsx': `
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
      <div className={\`absolute inset-0 transition-transform duration-[3000ms] ease-in-out z-0 mockup-bg \${depthState}\`}>
         <div className="mockup-ocean-img w-full" />
      </div>

      {/* Sprites Layer (only visible in combat) */}
      <div className={\`absolute inset-0 z-10 transition-opacity duration-1000 \${currentScreen === 'COMBAT' ? 'opacity-100' : 'opacity-0 pointer-events-none'}\`}>
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
`,
  'src/mockup.css': `
@import "tailwindcss";

.game-panel {
  color: #eaf4fc;
  background: #0b1e38;
  border: 2px solid #426887;
  box-shadow: 4px 4px 0 #030912;
}

.game-button {
  font-family: inherit;
  cursor: pointer;
  box-shadow: 4px 4px 0 #030912;
  transition: all 0.1s;
}

.game-button:active {
  transform: translate(2px, 2px);
  box-shadow: 2px 2px 0 #030912;
}

.game-button:focus-visible {
  outline: 3px solid #30d6f2;
  outline-offset: 3px;
}

.pixel-art {
  image-rendering: pixelated;
}

/* Background Mockup Styles */
.mockup-ocean-img {
  background-image: url('../../assets/maps/point-nemo-abyss-ocean.png');
  background-size: cover;
  background-position: top center;
  height: 400vh; /* make it tall to scroll down */
}

.mockup-bg.surface { transform: translateY(0); }
.mockup-bg.twilight { transform: translateY(-30%); }
.mockup-bg.midnight { transform: translateY(-60%); }
.mockup-bg.boss { transform: translateY(-80%); }

/* Sprites CSS steps mock */
.explorer-sprite {
  width: 120px;
  height: 120px;
  background-image: url('../../assets/prepared/runtime/explorer.png');
  background-size: 400% 400%;
  animation: swim-idle 1s steps(3, end) infinite;
}

.enemy-sprite {
  width: 120px;
  height: 120px;
  background-image: url('../../assets/prepared/runtime/blobfish.png');
  background-size: 400% 200%;
  background-position: 0 100%;
  animation: enemy-idle 1s steps(2, end) infinite;
}

@keyframes swim-idle {
  0% { background-position: 33.33% 0; }
  100% { background-position: 100% 0; }
}

@keyframes enemy-idle {
  0% { background-position: 0 100%; }
  100% { background-position: 33.33% 100%; }
}
`
};

for (const [filepath, content] of Object.entries(files)) {
  const fullpath = path.resolve(filepath);
  fs.mkdirSync(path.dirname(fullpath), { recursive: true });
  fs.writeFileSync(fullpath, content.trim() + '\n');
  console.log('Created', filepath);
}
