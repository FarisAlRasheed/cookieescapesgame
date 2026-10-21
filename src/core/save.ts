// Settings and progress kept in the player's browser.

export type Quality = 'low' | 'medium' | 'high';

export interface Settings {
  sfx: number; // 0..1
  sensitivity: number; // 0.4..2
  quality: Quality;
  invertY: boolean;
}

export interface Progress {
  bestTime: number | null; // seconds
  bestStars: number;
  crown: boolean; // unlocked by collecting every necklace
}

const SETTINGS_KEY = 'cookie-escapes:settings';
const PROGRESS_KEY = 'cookie-escapes:progress';

const isTouch = typeof window !== 'undefined' && (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);

export const defaultSettings: Settings = {
  sfx: 0.8,
  sensitivity: 1,
  quality: isTouch ? 'medium' : 'high',
  invertY: false,
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
  } catch {
    return { ...fallback };
  }
}

function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or storage blocked: progress just isn't remembered.
  }
}

export const loadSettings = () => load<Settings>(SETTINGS_KEY, defaultSettings);
export const saveSettings = (s: Settings) => store(SETTINGS_KEY, s);
export const loadProgress = () => load<Progress>(PROGRESS_KEY, { bestTime: null, bestStars: 0, crown: false });
export const saveProgress = (p: Progress) => store(PROGRESS_KEY, p);
