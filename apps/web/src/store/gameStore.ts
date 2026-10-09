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
