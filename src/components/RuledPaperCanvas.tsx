import React from "react";

interface RuledPaperCanvasProps {
  remainingLives: number;
  maxLives?: number;
  status: "WAITING_FOR_WORD" | "IN_PROGRESS" | "WON" | "LOST" | "RESIGNED";
}

/**
 * Renders the hand-drawn Hangman character on ruled notebook paper,
 * matching the uploaded reference screenshots (Screenshot 1, 5, and 6).
 *
 * Visual details:
 * - Off-white paper background (#F7F6F3) with thin horizontal gray lines (#E2DDD5)
 * - Thin vertical red margin line (#E8B4B4) near the left edge
 * - Hand-drawn SVG ink filter for organic marker/charcoal brush texture
 * - Progressive gallows strokes as incorrect guesses occur (6 lives -> 0 lives)
 * - Expressive face: calm neutral at 6 lives (Screenshot 5), worried/surprised with
 *   raised eyebrows & O-mouth when mistakes >= 1 (Screenshot 6), X-eyes when lost.
 */
export const RuledPaperCanvas: React.FC<RuledPaperCanvasProps> = ({
  remainingLives,
  maxLives = 6,
  status,
}) => {
  const mistakes = Math.max(0, maxLives - remainingLives);
  const isLost = status === "LOST" || status === "RESIGNED" || remainingLives === 0;
  const isWon = status === "WON";

  return (
    <div className="relative w-full select-none">
      <svg
        viewBox="0 0 640 310"
        className="w-full h-auto max-h-[330px] mx-auto overflow-visible"
        aria-label={`Hangman drawing with ${remainingLives} of ${maxLives} lives remaining`}
      >
        <defs>
          {/* Subtle hand-drawn organic ink displacement filter */}
          <filter id="sketch-ink" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.04"
              numOctaves="3"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="1.8"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>

        <g filter="url(#sketch-ink)" stroke="#191919" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* --- PROGRESSIVE GALLOWS FRAME (Drawn as mistakes 1..5 occur) --- */}
          {/* Mistake 1: Heavy horizontal ground base beam */}
          {mistakes >= 1 && (
            <path
              d="M 155 278 C 230 277, 340 279, 435 278"
              strokeWidth="8.5"
              className="transition-opacity duration-300"
            />
          )}

          {/* Mistake 2: Tall vertical gallows post */}
          {mistakes >= 2 && (
            <path
              d="M 202 278 C 201 190, 203 105, 202 28"
              strokeWidth="8.5"
              className="transition-opacity duration-300"
            />
          )}

          {/* Mistake 3: Top horizontal gallows beam */}
          {mistakes >= 3 && (
            <path
              d="M 200 28 C 255 28, 320 27, 372 28"
              strokeWidth="8.5"
              className="transition-opacity duration-300"
            />
          )}

          {/* Mistake 4: Diagonal corner support brace */}
          {mistakes >= 4 && (
            <path
              d="M 203 72 L 246 29"
              strokeWidth="7"
              className="transition-opacity duration-300"
            />
          )}

          {/* Mistake 5: Vertical rope dropping to the character's head */}
          {mistakes >= 5 && (
            <path
              d="M 372 28 L 372 66"
              strokeWidth="6.5"
              className="transition-opacity duration-300"
            />
          )}

          {/* --- STOOL (Knocked tilted when lost, standing upright otherwise) --- */}
          {!isLost ? (
            <g>
              {/* Stool top seat */}
              <path d="M 334 236 L 410 236" strokeWidth="7" />
              {/* Stool left leg */}
              <path d="M 345 236 L 339 276" strokeWidth="6.5" />
              {/* Stool right leg */}
              <path d="M 399 236 L 405 276" strokeWidth="6.5" />
              {/* Stool crossbar */}
              <path d="M 342 254 L 402 254" strokeWidth="5.5" />
            </g>
          ) : (
            <g transform="translate(30, 18) rotate(24 372 256)" opacity="0.75">
              <path d="M 334 236 L 410 236" strokeWidth="7" />
              <path d="M 345 236 L 339 276" strokeWidth="6.5" />
              <path d="M 399 236 L 405 276" strokeWidth="6.5" />
              <path d="M 342 254 L 402 254" strokeWidth="5.5" />
            </g>
          )}

          {/* --- STICK FIGURE CHARACTER --- */}
          {/* Head circle */}
          <circle cx="372" cy="96" r="30" strokeWidth="7.5" fill="#F7F6F3" />

          {/* Torso */}
          <path d="M 372 126 L 372 190" strokeWidth="7.5" />

          {/* Left & Right Arms */}
          {isWon ? (
            <>
              {/* Cheering arms raised on win */}
              <path d="M 372 146 L 326 112" strokeWidth="7" />
              <path d="M 372 146 L 418 112" strokeWidth="7" />
            </>
          ) : (
            <>
              <path d="M 372 142 L 322 178" strokeWidth="7" />
              <path d="M 372 142 L 422 178" strokeWidth="7" />
            </>
          )}

          {/* Left & Right Legs */}
          <path d="M 372 190 L 352 236" strokeWidth="7" />
          <path d="M 372 190 L 392 236" strokeWidth="7" />

          {/* --- FACIAL EXPRESSIONS --- */}
          {isLost ? (
            /* Dizzy X-eyes and flat/frown mouth when lost */
            <g strokeWidth="3.5">
              <path d="M 355 86 L 365 96 M 365 86 L 355 96" />
              <path d="M 379 86 L 389 96 M 389 86 L 379 96" />
              <path d="M 360 113 C 367 107, 377 107, 384 113" />
            </g>
          ) : isWon ? (
            /* Relieved happy smile when won */
            <g>
              <circle cx="360" cy="90" r="3.5" fill="#191919" stroke="none" />
              <circle cx="384" cy="90" r="3.5" fill="#191919" stroke="none" />
              <path d="M 358 105 Q 372 118 386 105" strokeWidth="4" />
            </g>
          ) : mistakes === 0 ? (
            /* Calm neutral expression at full 6 lives (matches Screenshot 5) */
            <g>
              <circle cx="360" cy="90" r="4" fill="#191919" stroke="none" />
              <circle cx="384" cy="90" r="4" fill="#191919" stroke="none" />
              <path d="M 362 107 L 382 107" strokeWidth="4" />
            </g>
          ) : (
            /* Worried expression with tilted eyebrows, wide eyes & O-mouth (matches Screenshot 6) */
            <g>
              {/* Worried eyebrows */}
              <path d="M 350 80 L 363 75" strokeWidth="3.5" />
              <path d="M 381 75 L 394 80" strokeWidth="3.5" />
              {/* Wide eyes with pupils */}
              <circle cx="360" cy="90" r="5.5" strokeWidth="3" />
              <circle cx="360" cy="90" r="2" fill="#191919" stroke="none" />
              <circle cx="384" cy="90" r="5.5" strokeWidth="3" />
              <circle cx="384" cy="90" r="2" fill="#191919" stroke="none" />
              {/* Surprised O mouth */}
              <ellipse cx="372" cy="110" rx="6" ry="7.5" strokeWidth="3.8" />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
};
