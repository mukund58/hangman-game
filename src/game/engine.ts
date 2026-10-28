/**
 * Pure domain game engine and scoring rules for Hangman.
 * Mirrors `/hangman/game/logic.py`, `/hangman/game/words.py`, and `/hangman/game/scoring.py`.
 */

export type GameMode = "computer" | "online" | "pass_and_play";
export type Difficulty = "Easy" | "Medium" | "Hard" | "Fiendish";
export type GameStatus = "WAITING_FOR_WORD" | "IN_PROGRESS" | "WON" | "LOST" | "RESIGNED";

export interface WordEntry {
  word: string;
  clue: string;
  category: string;
  difficulty: Difficulty;
}

export const CATEGORIES: string[] = [
  "Any category",
  "Animals",
  "Food & drink",
  "Geography",
  "Sport",
  "Jobs",
  "Nature",
  "Objects",
  "The body",
  "Music",
  "Transport",
  "Clothes",
  "School",
];

export const DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard", "Fiendish"];

export const MAX_LIVES = 6;
export const MAX_WORD_LENGTH = 16;
export const BASE_WIN_POINTS = 100;
export const LIFE_BONUS_POINTS = 20;

export interface RoundStateData {
  secretWord: string;
  guessedLetters: string[];
  correctLetters: string[];
  incorrectLetters: string[];
  remainingLives: number;
  maxLives: number;
  clue: string;
  category: string;
  difficulty: Difficulty;
  clueRevealed: boolean;
  status: GameStatus;
  scoreAwarded: boolean;
}

export function createEmptyRoundState(): RoundStateData {
  return {
    secretWord: "",
    guessedLetters: [],
    correctLetters: [],
    incorrectLetters: [],
    remainingLives: MAX_LIVES,
    maxLives: MAX_LIVES,
    clue: "",
    category: "Any category",
    difficulty: "Medium",
    clueRevealed: false,
    status: "WAITING_FOR_WORD",
    scoreAwarded: false,
  };
}

export function validateSecretWordInput(raw: string): { valid: boolean; normalized: string; error?: string } {
  const normalized = raw.trim().toUpperCase().replace(/\s+/g, " ");
  if (!normalized) {
    return { valid: false, normalized: "", error: "Please enter a secret word." };
  }
  if (normalized.length < 2) {
    return { valid: false, normalized, error: "Secret word must be at least 2 letters long." };
  }
  if (normalized.length > MAX_WORD_LENGTH) {
    return { valid: false, normalized, error: `Secret word cannot exceed ${MAX_WORD_LENGTH} characters.` };
  }
  let hasLetter = false;
  for (const ch of normalized) {
    if (ch >= "A" && ch <= "Z") {
      hasLetter = true;
    } else if (ch === " " || ch === "-") {
      continue;
    } else {
      return {
        valid: false,
        normalized,
        error: "Use only letters (A–Z), spaces, or hyphens.",
      };
    }
  }
  if (!hasLetter) {
    return { valid: false, normalized, error: "Secret word must contain at least one letter." };
  }
  return { valid: true, normalized };
}

export function getRequiredUniqueLetters(secretWord: string): Set<string> {
  const set = new Set<string>();
  for (const ch of secretWord.toUpperCase()) {
    if (ch >= "A" && ch <= "Z") {
      set.add(ch);
    }
  }
  return set;
}

export function buildMaskedCharacters(secretWord: string, correctLetters: Iterable<string>): string[] {
  const correctSet = new Set(correctLetters);
  return Array.from(secretWord.toUpperCase()).map((ch) => {
    if (ch === " " || ch === "-") return ch;
    return correctSet.has(ch) ? ch : "_";
  });
}

export function calculateRoundScore(status: GameStatus, remainingLives: number): number {
  if (status !== "WON") return 0;
  return BASE_WIN_POINTS + Math.max(0, remainingLives) * LIFE_BONUS_POINTS;
}
