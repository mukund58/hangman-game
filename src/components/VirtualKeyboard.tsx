import React from "react";

interface VirtualKeyboardProps {
  correctLetters: Set<string>;
  incorrectLetters: Set<string>;
  disabled: boolean;
  onGuessLetter: (letter: string) => void;
}

const ROW_1 = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];
const ROW_2 = ["N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];

/**
 * 2-row x 13-column A–Z Virtual Keyboard matching Screenshots 5 & 6:
 * - Unguessed letters: crisp white square-ish key tiles (#FFFFFF) with subtle border (#C9C2B2)
 * - Incorrect guesses: borderless letter in muted crimson (#B52D2D) with a hand-drawn
 *   horizontal/slightly angled red strikethrough line (matching J, L, M, V in Screenshot 6)
 * - Correct guesses: highlighted with forest green (#287B5E) border and soft green tint
 */
export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({
  correctLetters,
  incorrectLetters,
  disabled,
  onGuessLetter,
}) => {
  const renderKey = (letter: string) => {
    const isCorrect = correctLetters.has(letter);
    const isWrong = incorrectLetters.has(letter);
    const isUsed = isCorrect || isWrong || disabled;

    if (isWrong) {
      return (
        <button
          key={letter}
          type="button"
          disabled
          aria-label={`Letter ${letter}, incorrect`}
          className="relative w-9 h-10 sm:w-11 sm:h-12 flex items-center justify-center select-none cursor-default"
        >
          <span className="text-[15px] font-semibold text-[#B52D2D]/80">{letter}</span>
          {/* Hand-drawn red cross-out stroke matching Screenshot 6 */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute w-6 h-[2px] bg-[#B52D2D] -rotate-6 rounded-full"
          />
        </button>
      );
    }

    if (isCorrect) {
      return (
        <button
          key={letter}
          type="button"
          disabled
          aria-label={`Letter ${letter}, correct`}
          className="w-9 h-10 sm:w-11 sm:h-12 rounded-[5px] bg-[#E6F4EE] border-2 border-[#287B5E] text-[#287B5E] text-[15px] font-bold flex items-center justify-center select-none cursor-default transition-transform"
        >
          {letter}
        </button>
      );
    }

    return (
      <button
        key={letter}
        type="button"
        disabled={isUsed}
        onClick={() => onGuessLetter(letter)}
        aria-label={`Guess letter ${letter}`}
        className={`w-9 h-10 sm:w-11 sm:h-12 rounded-[5px] bg-white border border-[#C8C2B4] text-[#201F1A] text-[15px] font-bold flex items-center justify-center transition-all duration-150 ${
          isUsed
            ? "opacity-60 cursor-not-allowed"
            : "hover:border-[#201F1A] hover:bg-[#FAF9F6] active:scale-95 shadow-[0_1px_1px_rgba(0,0,0,0.04)] cursor-pointer"
        }`}
      >
        {letter}
      </button>
    );
  };

  return (
    <div className="flex flex-col items-center gap-2 w-full" role="group" aria-label="Virtual keyboard">
      <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
        {ROW_1.map(renderKey)}
      </div>
      <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
        {ROW_2.map(renderKey)}
      </div>
    </div>
  );
};
