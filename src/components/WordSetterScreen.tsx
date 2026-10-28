import React, { useState } from "react";
import { Dices, Eye, EyeOff } from "lucide-react";
import {
  CATEGORIES,
  DIFFICULTIES,
  Difficulty,
  MAX_WORD_LENGTH,
  validateSecretWordInput,
  WordEntry,
} from "../game/engine";

interface WordSetterScreenProps {
  subtitle: string;
  words: WordEntry[];
  onLockInWord: (word: string, clue: string, category: string, difficulty: Difficulty) => void;
}

/**
 * Reproduces the "Think of a word and lock it in." screen from Screenshots 2, 3, and 4.
 */
export const WordSetterScreen: React.FC<WordSetterScreenProps> = ({
  subtitle,
  words,
  onLockInWord,
}) => {
  const [word, setWord] = useState("");
  const [clue, setClue] = useState("");
  const [category, setCategory] = useState<string>("Any category");
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [maskInput, setMaskInput] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleWordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.toUpperCase();
    // Allow only letters, spaces, and hyphens up to MAX_WORD_LENGTH
    const filtered = raw.replace(/[^A-Z -]/g, "").slice(0, MAX_WORD_LENGTH);
    setWord(filtered);
    if (error) setError(null);
  };

  const handleSuggestWord = () => {
    let pool = words.filter((entry) => {
      const catMatch = category === "Any category" || entry.category === category;
      const diffMatch = entry.difficulty === difficulty;
      return catMatch && diffMatch;
    });
    if (pool.length === 0) {
      pool = words.filter((entry) => category === "Any category" || entry.category === category);
    }
    if (pool.length === 0) {
      pool = words;
    }
    if (pool.length > 0) {
      const picked = pool[Math.floor(Math.random() * pool.length)];
      setWord(picked.word);
      setClue(picked.clue);
      setError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateSecretWordInput(word);
    if (!check.valid) {
      setError(check.error || "Invalid word.");
      return;
    }
    const submittedWord = check.normalized;
    const submittedClue = clue.trim();
    setWord("");
    setClue("");
    onLockInWord(submittedWord, submittedClue, category, difficulty);
  };

  const isReady = word.trim().length >= 2;

  return (
    <form onSubmit={handleSubmit} className="w-full pt-2 pb-6 space-y-4">
      <div className="space-y-1">
        <h2 className="text-[26px] sm:text-[28px] font-bold tracking-tight text-[#201F1A]">
          Think of a word and lock it in.
        </h2>
        <p className="text-[14px] text-[#716B5D]">{subtitle}</p>
      </div>

      {/* Large centered secret word box matching Screenshots 2, 3, and 4 */}
      <div className="relative">
        <input
          type={maskInput ? "password" : "text"}
          value={word}
          onChange={handleWordChange}
          placeholder="Y O U R   S E C R E T   W O R D"
          maxLength={MAX_WORD_LENGTH}
          autoComplete="off"
          spellCheck={false}
          className="w-full h-[76px] px-12 rounded-[14px] bg-[#ECEAE6] border border-[#D5C7A6] text-center font-mono text-[20px] sm:text-[22px] font-semibold tracking-[0.22em] text-[#201F1A] placeholder:text-[#7D786C] placeholder:tracking-[0.18em] focus:outline-none focus:border-[#B52D2D] focus:bg-[#F7F6F3] transition-colors"
        />
        {word.length > 0 && (
          <button
            type="button"
            onClick={() => setMaskInput((v) => !v)}
            title={maskInput ? "Show word" : "Hide word from nearby eyes"}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-[#716B5D] hover:text-[#201F1A] rounded-lg cursor-pointer"
          >
            {maskInput ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        )}
      </div>

      <div className="flex items-center justify-between text-[12px] text-[#716B5D] tabular-nums">
        <span>
          {word.length} / {MAX_WORD_LENGTH}
        </span>
        {error && <span className="text-[#B52D2D] font-medium">{error}</span>}
      </div>

      {/* Category dropdown, Difficulty dropdown, and "Suggest a word" button */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Word category"
          className="h-[46px] px-4 rounded-[12px] bg-[#F7F6F3] border border-[#D5C7A6] text-[14px] font-medium text-[#201F1A] focus:outline-none focus:border-[#B52D2D] cursor-pointer"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          aria-label="Word difficulty"
          className="h-[46px] px-4 rounded-[12px] bg-[#F7F6F3] border border-[#D5C7A6] text-[14px] font-medium text-[#201F1A] focus:outline-none focus:border-[#B52D2D] cursor-pointer"
        >
          {DIFFICULTIES.map((diff) => (
            <option key={diff} value={diff}>
              {diff}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleSuggestWord}
          className="h-[46px] px-5 rounded-[12px] bg-[#F9E4E4] border border-[#F1C4C4] text-[#B52D2D] text-[14px] font-bold flex items-center justify-center gap-2 hover:bg-[#F4D5D5] active:scale-[0.99] transition-all whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Dices className="w-4 h-4 shrink-0" />
          <span>Suggest a word</span>
        </button>
      </div>

      {/* Clue (optional) input */}
      <div>
        <input
          type="text"
          value={clue}
          onChange={(e) => setClue(e.target.value.slice(0, 80))}
          placeholder="Clue (optional)"
          className="w-full h-[50px] px-4 rounded-[12px] bg-[#ECEAE6] border border-[#D5C7A6] text-[14px] text-[#201F1A] placeholder:text-[#7D786C] focus:outline-none focus:border-[#B52D2D] focus:bg-[#F7F6F3] transition-colors"
        />
      </div>

      {/* Full-width "Set the word" button */}
      <button
        type="submit"
        disabled={!isReady}
        className={`w-full h-[50px] rounded-[12px] text-[15px] font-semibold text-white transition-all whitespace-nowrap ${
          isReady
            ? "bg-[#B52D2D] hover:bg-[#9D2424] active:scale-[0.99] cursor-pointer shadow-sm"
            : "bg-[#D58C8C] cursor-not-allowed"
        }`}
      >
        Set the word
      </button>
    </form>
  );
};
