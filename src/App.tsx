/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Lightbulb,
  Volume2,
  VolumeX,
  Code2,
  X,
  Star,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import {
  CATEGORIES,
  Difficulty,
  GameMode,
  RoundStateData,
  WordEntry,
  buildMaskedCharacters,
  calculateRoundScore,
  createEmptyRoundState,
  getRequiredUniqueLetters,
} from "./game/engine";
import { RuledPaperCanvas } from "./components/RuledPaperCanvas";
import { VirtualKeyboard } from "./components/VirtualKeyboard";
import { WordSetterScreen } from "./components/WordSetterScreen";
import { OnlineLobbyModal, OnlineRoomBanner } from "./components/OnlineLobbyModal";
import { ChatMessageItem, PlayerScoreCardItem, Sidebar } from "./components/Sidebar";
import { PythonProjectModal } from "./components/PythonProjectModal";
import { CompanionOnlineClient } from "./components/CompanionOnlineClient";
import { soundFX } from "./utils/sound";

const FALLBACK_WORDS: WordEntry[] = [
  { word: "HANGAR", clue: "Shed big enough to hold aircraft", category: "Objects", difficulty: "Medium" },
  { word: "DOLPHIN", clue: "Intelligent marine mammal known for echolocation", category: "Animals", difficulty: "Medium" },
  { word: "CROISSANT", clue: "Flaky crescent-shaped French pastry", category: "Food & drink", difficulty: "Hard" },
  { word: "ARCHERY", clue: "Precision sport of shooting arrows with a bow", category: "Sport", difficulty: "Medium" },
  { word: "VOLCANO", clue: "Mountain rupture allowing magma to escape", category: "Geography", difficulty: "Medium" },
  { word: "SAXOPHONE", clue: "Single-reed woodwind instrument made of brass", category: "Music", difficulty: "Hard" },
];

export default function App() {
  // Word Database loaded from /hangman/data/words.json
  const [words, setWords] = useState<WordEntry[]>(FALLBACK_WORDS);
  const usedWordsRef = useRef<Set<string>>(new Set());

  // Game Mode & Filter State
  const [mode, setMode] = useState<GameMode>("computer");
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [category, setCategory] = useState<string>("Any category");

  // Local Match State (Computer & Pass-and-Play)
  const [roundNumber, setRoundNumber] = useState<number>(1);
  const maxRounds = 4;
  const [setterSlot, setSetterSlot] = useState<1 | 2>(1);
  const [guesserSlot, setGuesserSlot] = useState<1 | 2>(2);
  const [roundState, setRoundState] = useState<RoundStateData>(() => createEmptyRoundState());
  const [statusMessage, setStatusMessage] = useState<string>("Guess the word");

  // Scores & Streaks
  const [computerScore, setComputerScore] = useState<number>(0);
  const [computerStreak, setComputerStreak] = useState<number>(0);
  const [p1Score, setP1Score] = useState<number>(0);
  const [p2Score, setP2Score] = useState<number>(0);

  // Audio & Modals
  const [muted, setMuted] = useState<boolean>(false);
  const [showSolveModal, setShowSolveModal] = useState<boolean>(false);
  const [solveInput, setSolveInput] = useState<string>("");
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);
  const [showPythonModal, setShowPythonModal] = useState<boolean>(false);

  // Online Multiplayer State
  const wsRef = useRef<WebSocket | null>(null);
  const playerIdRef = useRef<string>(
    "player-" + Math.random().toString(36).slice(2, 10)
  );
  const [onlineState, setOnlineState] = useState<any>(null);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [showCompanionClient, setShowCompanionClient] = useState<boolean>(false);

  // Pick a random word from the database matching category and difficulty
  const pickWordFromDatabase = useCallback(
    (cat: string, diff: Difficulty, bank: WordEntry[] = words): WordEntry => {
      let candidates = bank.filter((w) => {
        if (usedWordsRef.current.has(w.word)) return false;
        const catOk = cat === "Any category" || w.category === cat;
        const diffOk = w.difficulty === diff;
        return catOk && diffOk;
      });
      if (candidates.length === 0) {
        candidates = bank.filter(
          (w) => (cat === "Any category" || w.category === cat) && w.difficulty === diff
        );
      }
      if (candidates.length === 0) {
        candidates = bank.filter((w) => cat === "Any category" || w.category === cat);
      }
      if (candidates.length === 0) {
        candidates = bank.length > 0 ? bank : FALLBACK_WORDS;
      }
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      usedWordsRef.current.add(chosen.word);
      return chosen;
    },
    [words]
  );

  // Start a fresh Computer round
  const startComputerRound = useCallback(
    (cat: string = category, diff: Difficulty = difficulty, bank: WordEntry[] = words) => {
      const entry = pickWordFromDatabase(cat, diff, bank);
      setRoundState({
        secretWord: entry.word,
        guessedLetters: [],
        correctLetters: [],
        incorrectLetters: [],
        remainingLives: 6,
        maxLives: 6,
        clue: entry.clue,
        category: entry.category,
        difficulty: entry.difficulty,
        clueRevealed: false,
        status: "IN_PROGRESS",
        scoreAwarded: false,
      });
      setStatusMessage("Guess the word");
    },
    [category, difficulty, pickWordFromDatabase, words]
  );

  // Load 120 words from /api/words on mount & check URL for ?room=CODE
  useEffect(() => {
    fetch("/api/words")
      .then((r) => r.json())
      .then((data: WordEntry[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setWords(data);
          startComputerRound("Any category", "Medium", data);
        } else {
          startComputerRound("Any category", "Medium", FALLBACK_WORDS);
        }
      })
      .catch(() => {
        startComputerRound("Any category", "Medium", FALLBACK_WORDS);
      });

    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    if (roomParam) {
      setMode("online");
      setTimeout(() => {
        sendOnlineAction("join_room", {
          room_code: roomParam,
          player_name: "Opponent",
        });
      }, 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ensure WebSocket connection when using Online Multiplayer
  const ensureWebSocket = useCallback((): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        resolve(wsRef.current);
        return;
      }
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => resolve(ws);
      ws.onerror = () => reject(new Error("Could not connect to multiplayer server."));
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "state_update") {
            setOnlineState(msg);
            setOnlineError(null);
          } else if (msg.type === "error") {
            setOnlineError(msg.message);
          } else if (msg.type === "left_room") {
            setOnlineState(null);
          }
        } catch {
          // ignore malformed
        }
      };
    });
  }, []);

  const sendOnlineAction = useCallback(
    async (type: string, payload: Record<string, any> = {}) => {
      try {
        const ws = await ensureWebSocket();
        ws.send(
          JSON.stringify({
            type,
            player_id: playerIdRef.current,
            room_code: payload.room_code || onlineState?.room_code || "",
            ...payload,
          })
        );
      } catch (err: any) {
        setOnlineError(err?.message || "Failed to send network message.");
      }
    },
    [ensureWebSocket, onlineState?.room_code]
  );

  // Handle single-letter guess
  const handleGuessLetter = useCallback(
    (rawLetter: string) => {
      const letter = rawLetter.trim().toUpperCase();
      if (letter.length !== 1 || letter < "A" || letter > "Z") return;

      if (mode === "online") {
        if (!onlineState) return;
        sendOnlineAction("guess_letter", { letter });
        return;
      }

      setRoundState((prev) => {
        if (prev.status !== "IN_PROGRESS") return prev;
        if (prev.guessedLetters.includes(letter)) return prev;

        const nextGuessed = [...prev.guessedLetters, letter];
        const reqLetters = getRequiredUniqueLetters(prev.secretWord);

        if (reqLetters.has(letter)) {
          const nextCorrect = [...prev.correctLetters, letter];
          const allFound = Array.from(reqLetters).every((ch) =>
            nextCorrect.includes(ch)
          );

          if (allFound) {
            soundFX.playWinFanfare();
            const pts = calculateRoundScore("WON", prev.remainingLives);
            if (!prev.scoreAwarded) {
              if (mode === "computer") {
                setComputerScore((s) => s + pts);
                setComputerStreak((st) => st + 1);
              } else if (guesserSlot === 1) {
                setP1Score((s) => s + pts);
              } else {
                setP2Score((s) => s + pts);
              }
            }
            setStatusMessage(`You won! (+${pts} pts)`);
            return {
              ...prev,
              guessedLetters: nextGuessed,
              correctLetters: nextCorrect,
              status: "WON",
              scoreAwarded: true,
            };
          }

          soundFX.playCorrectGuess();
          setStatusMessage("Guess the word");
          return {
            ...prev,
            guessedLetters: nextGuessed,
            correctLetters: nextCorrect,
          };
        } else {
          const nextIncorrect = [...prev.incorrectLetters, letter];
          const nextLives = Math.max(0, prev.remainingLives - 1);

          if (nextLives === 0) {
            soundFX.playLossTone();
            if (mode === "computer") {
              setComputerStreak(0);
            }
            setStatusMessage(`Out of lives! Word: ${prev.secretWord}`);
            return {
              ...prev,
              guessedLetters: nextGuessed,
              incorrectLetters: nextIncorrect,
              remainingLives: 0,
              status: "LOST",
              scoreAwarded: true,
            };
          }

          soundFX.playPencilSketch();
          setStatusMessage("Guess the word");
          return {
            ...prev,
            guessedLetters: nextGuessed,
            incorrectLetters: nextIncorrect,
            remainingLives: nextLives,
          };
        }
      });
    },
    [guesserSlot, mode, onlineState, sendOnlineAction]
  );

  // Physical keyboard support for A–Z
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") {
        return;
      }
      if (showSolveModal || showHowToPlay || showPythonModal) return;

      const key = e.key.toUpperCase();
      if (key.length === 1 && key >= "A" && key <= "Z") {
        handleGuessLetter(key);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleGuessLetter, showHowToPlay, showPythonModal, showSolveModal]);

  // Mode switching
  const handleModeChange = (newMode: GameMode) => {
    setMode(newMode);
    setOnlineError(null);
    if (newMode === "computer") {
      startComputerRound(category, difficulty);
    } else if (newMode === "pass_and_play") {
      setRoundNumber(1);
      setSetterSlot(1);
      setGuesserSlot(2);
      setRoundState(createEmptyRoundState());
      setStatusMessage("Think of a word and lock it in.");
    } else if (newMode === "online") {
      setStatusMessage("Create or join a room");
    }
  };

  // Difficulty & Category changes in Computer mode
  const handleDifficultyChange = (newDiff: Difficulty) => {
    setDifficulty(newDiff);
    if (mode === "computer") {
      startComputerRound(category, newDiff);
    }
  };

  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat);
    if (mode === "computer") {
      startComputerRound(newCat, difficulty);
    }
  };

  // Lock in secret word (Pass-and-Play or Online Setter)
  const handleLockInWord = (
    word: string,
    clue: string,
    cat: string,
    diff: Difficulty
  ) => {
    if (mode === "online") {
      sendOnlineAction("set_word", {
        word,
        clue,
        category: cat,
        difficulty: diff,
      });
      return;
    }

    setRoundState({
      secretWord: word,
      guessedLetters: [],
      correctLetters: [],
      incorrectLetters: [],
      remainingLives: 6,
      maxLives: 6,
      clue,
      category: cat,
      difficulty: diff,
      clueRevealed: false,
      status: "IN_PROGRESS",
      scoreAwarded: false,
    });
    setStatusMessage("Guess the word");
  };

  // Show Clue handler
  const handleShowClue = () => {
    if (mode === "online") {
      sendOnlineAction("reveal_clue");
      return;
    }
    setRoundState((prev) => ({
      ...prev,
      clueRevealed: true,
    }));
  };

  // Solve the complete word handler
  const handleSolveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const candidate = solveInput.trim().toUpperCase().replace(/\s+/g, " ");
    if (!candidate) return;
    setShowSolveModal(false);
    setSolveInput("");

    if (mode === "online") {
      sendOnlineAction("solve_word", { word: candidate });
      return;
    }

    setRoundState((prev) => {
      if (prev.status !== "IN_PROGRESS") return prev;
      const req = Array.from(getRequiredUniqueLetters(prev.secretWord));
      if (candidate === prev.secretWord) {
        soundFX.playWinFanfare();
        const pts = calculateRoundScore("WON", prev.remainingLives);
        if (!prev.scoreAwarded) {
          if (mode === "computer") {
            setComputerScore((s) => s + pts);
            setComputerStreak((st) => st + 1);
          } else if (guesserSlot === 1) {
            setP1Score((s) => s + pts);
          } else {
            setP2Score((s) => s + pts);
          }
        }
        setStatusMessage(`Brilliant solve! (+${pts} pts)`);
        return {
          ...prev,
          guessedLetters: Array.from(new Set([...prev.guessedLetters, ...req])),
          correctLetters: req,
          status: "WON",
          scoreAwarded: true,
        };
      } else {
        const nextLives = Math.max(0, prev.remainingLives - 1);
        if (nextLives === 0) {
          soundFX.playLossTone();
          if (mode === "computer") setComputerStreak(0);
          setStatusMessage(`Wrong solve! The word was ${prev.secretWord}`);
          return {
            ...prev,
            remainingLives: 0,
            status: "LOST",
            scoreAwarded: true,
          };
        }
        soundFX.playPencilSketch();
        setStatusMessage(`'${candidate}' is not the word (-1 life)`);
        return {
          ...prev,
          remainingLives: nextLives,
        };
      }
    });
  };

  // Restart / Resign / New Game / Next Round handlers
  const handleRestart = () => {
    if (mode === "computer") {
      startComputerRound(category, difficulty);
    } else if (mode === "pass_and_play") {
      setRoundState(createEmptyRoundState());
      setStatusMessage("Think of a word and lock it in.");
    } else if (mode === "online" && onlineState) {
      sendOnlineAction("next_round");
    }
  };

  const handleResign = () => {
    if (mode === "online" && onlineState) {
      sendOnlineAction("resign_round");
      return;
    }
    soundFX.playLossTone();
    if (mode === "computer") setComputerStreak(0);
    setRoundState((prev) => ({
      ...prev,
      remainingLives: 0,
      status: "RESIGNED",
      scoreAwarded: true,
    }));
    setStatusMessage(
      roundState.secretWord
        ? `Resigned! Word: ${roundState.secretWord}`
        : "Round resigned."
    );
  };

  const handleNewGame = () => {
    if (mode === "online" && onlineState) {
      sendOnlineAction("new_match");
      return;
    }
    if (mode === "computer") {
      setComputerScore(0);
      setComputerStreak(0);
      startComputerRound(category, difficulty);
    } else {
      setP1Score(0);
      setP2Score(0);
      setRoundNumber(1);
      setSetterSlot(1);
      setGuesserSlot(2);
      setRoundState(createEmptyRoundState());
      setStatusMessage("Think of a word and lock it in.");
    }
  };

  const handleNextRound = () => {
    if (mode === "computer") {
      startComputerRound(category, difficulty);
    } else if (mode === "pass_and_play") {
      setRoundNumber((r) => (r % maxRounds) + 1);
      setSetterSlot(guesserSlot);
      setGuesserSlot(setterSlot);
      setRoundState(createEmptyRoundState());
      setStatusMessage("Think of a word and lock it in.");
    } else if (mode === "online" && onlineState) {
      sendOnlineAction("next_round");
    }
  };

  const toggleMute = () => {
    soundFX.muted = !muted;
    setMuted(!muted);
  };

  // --- DERIVE VIEW MODEL FOR CURRENT ACTIVE MODE ---
  const isOnlineInRoom = mode === "online" && Boolean(onlineState);
  const isOnlineLobby = mode === "online" && !onlineState;

  let activeRemainingLives = roundState.remainingLives;
  let activeStatus = roundState.status;
  let activeMaskedChars: string[] = [];
  let activeSecretWord: string | null = null;
  let activeCorrectSet = new Set(roundState.correctLetters);
  let activeIncorrectSet = new Set(roundState.incorrectLetters);
  let activeCanGuess = false;
  let showWordSetter = false;
  let wordSetterSubtitle = "";
  let topPills: Array<{ text: string; variant?: "neutral" | "clue" }> = [];
  let showClueButton = false;
  let sidebarPlayers: PlayerScoreCardItem[] = [];
  let sidebarStatusText = statusMessage;
  let chatMessages: ChatMessageItem[] = [];

  if (mode === "computer") {
    activeMaskedChars = buildMaskedCharacters(
      roundState.secretWord,
      roundState.correctLetters
    );
    const isOver = ["WON", "LOST", "RESIGNED"].includes(roundState.status);
    activeSecretWord = isOver ? roundState.secretWord : null;
    activeCanGuess = !isOver;
    topPills = [
      { text: `Streak ${computerStreak}`, variant: "neutral" },
      {
        text: roundState.clueRevealed
          ? `Clue: ${roundState.clue}`
          : `Clue: ${roundState.category}`,
        variant: "clue",
      },
    ];
    showClueButton = !roundState.clueRevealed && !isOver;
    sidebarPlayers = [
      {
        id: "solo",
        name: "Sunny Marmot",
        initials: "SM",
        avatarColor: "#2B5CE6",
        score: computerScore,
        isTurn: true,
      },
    ];
  } else if (mode === "pass_and_play") {
    topPills = [
      { text: `Round ${roundNumber} / ${maxRounds}`, variant: "neutral" },
      { text: `Player 1 ${p1Score} · Player 2 ${p2Score}`, variant: "neutral" },
    ];
    if (roundState.status === "WAITING_FOR_WORD") {
      showWordSetter = true;
      wordSetterSubtitle = `Player ${setterSlot} — write a word for Player ${guesserSlot}`;
      activeRemainingLives = 6;
    } else {
      const isOver = ["WON", "LOST", "RESIGNED"].includes(roundState.status);
      activeMaskedChars = buildMaskedCharacters(
        roundState.secretWord,
        roundState.correctLetters
      );
      activeSecretWord = isOver ? roundState.secretWord : null;
      activeCanGuess = !isOver;
      if (roundState.clue && roundState.clueRevealed) {
        topPills.push({ text: `Clue: ${roundState.clue}`, variant: "clue" });
      }
      showClueButton =
        Boolean(roundState.clue) && !roundState.clueRevealed && !isOver;
    }
    const activeTurnSlot =
      roundState.status === "WAITING_FOR_WORD" ? setterSlot : guesserSlot;
    sidebarPlayers = [
      {
        id: "p1",
        name: "Player 1",
        initials: "P1",
        avatarColor: "#2B5CE6",
        score: p1Score,
        isTurn: activeTurnSlot === 1,
      },
      {
        id: "p2",
        name: "Player 2",
        initials: "P2",
        avatarColor: "#B52D2D",
        score: p2Score,
        isTurn: activeTurnSlot === 2,
      },
    ];
  } else if (mode === "online") {
    if (isOnlineLobby) {
      // Background decorative board behind Create/Join Room Modal (matches Screenshot 1: _ R _ _ E)
      activeRemainingLives = 0;
      activeStatus = "LOST";
      activeMaskedChars = ["_", "_", "_", "_", "_"];
      activeSecretWord = " R  E";
      activeCorrectSet = new Set();
      activeIncorrectSet = new Set();
      activeCanGuess = false;
      sidebarPlayers = [];
    } else if (onlineState) {
      const viewerSlot: 1 | 2 = onlineState.viewer_slot;
      const oppSlot: 1 | 2 = viewerSlot === 1 ? 2 : 1;
      const myPlayer = onlineState.players[viewerSlot];
      const oppPlayer = onlineState.players[oppSlot];
      const g = onlineState.game;

      activeRemainingLives = g.remaining_lives;
      activeStatus = g.status;
      activeMaskedChars = g.masked_characters || [];
      activeSecretWord = g.secret_word || null;
      activeCorrectSet = new Set(g.correct_letters || []);
      activeIncorrectSet = new Set(g.incorrect_letters || []);
      sidebarStatusText = onlineState.last_message || "Guess the word";
      chatMessages = onlineState.chat || [];

      topPills = [
        {
          text: `Round ${onlineState.round_number} / ${onlineState.max_rounds}`,
          variant: "neutral",
        },
        {
          text: `You ${myPlayer.score} · Opponent ${oppPlayer.score}`,
          variant: "neutral",
        },
      ];

      if (g.status === "WAITING_FOR_WORD") {
        if (viewerSlot === onlineState.setter_slot) {
          showWordSetter = true;
          wordSetterSubtitle = "You — write a word for Opponent";
        } else {
          activeMaskedChars = ["_", "_", "_", "_", "_"];
          activeCanGuess = false;
          topPills.push({
            text: "Opponent is choosing a secret word...",
            variant: "clue",
          });
        }
      } else {
        const isOver = ["WON", "LOST", "RESIGNED"].includes(g.status);
        activeCanGuess = viewerSlot === onlineState.guesser_slot && !isOver;
        if (g.clue) {
          topPills.push({ text: `Clue: ${g.clue}`, variant: "clue" });
        }
        showClueButton =
          Boolean(g.has_clue) && !g.clue_revealed && !isOver && activeCanGuess;
      }

      const activeTurnSlot =
        g.status === "WAITING_FOR_WORD"
          ? onlineState.setter_slot
          : onlineState.guesser_slot;

      sidebarPlayers = [
        {
          id: "opp",
          name: oppPlayer.name || "Opponent",
          initials: "O",
          avatarColor: "#B52D2D",
          score: oppPlayer.score,
          isTurn: activeTurnSlot === oppSlot,
        },
        {
          id: "me",
          name: myPlayer.name || "Sunny Marmot",
          initials: "SM",
          avatarColor: "#2B5CE6",
          score: myPlayer.score,
          isTurn: activeTurnSlot === viewerSlot,
        },
      ];
    }
  }

  const isRoundEnded = ["WON", "LOST", "RESIGNED"].includes(activeStatus) && !isOnlineLobby;

  return (
    <div className="min-h-screen bg-[#E6E4E2] text-[#201F1A] flex flex-col">
      {/* Subtle Top Utility Strip for Student Python Codebase & Sound Toggle */}
      <div className="w-full max-w-[1340px] mx-auto px-4 sm:px-8 pt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={toggleMute}
          title={muted ? "Unmute pencil & game sounds" : "Mute sounds"}
          className="h-[32px] px-3 rounded-full bg-[#F7F6F3] hover:bg-white border border-[#D5C7A6] text-[12px] font-semibold text-[#716B5D] hover:text-[#201F1A] flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          <span>{muted ? "Sound Off" : "Sound On"}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowPythonModal(true)}
          className="h-[32px] px-3.5 rounded-full bg-[#0C2540] hover:bg-[#173A60] text-white text-[12px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Python 3.11 + Flet Codebase & pytest</span>
        </button>
      </div>

      {/* Main Content Container */}
      <main className="w-full max-w-[1340px] mx-auto px-4 sm:px-8 py-4 flex-1">
        {/* Online Multiplayer Header & Pink Room Banner (Screenshot 4) */}
        {isOnlineInRoom && onlineState && (
          <div className="mb-4">
            <div className="mb-3 space-y-1">
              <div className="flex items-center gap-2.5">
                <h1 className="text-[28px] font-bold tracking-tight text-[#201F1A]">
                  Hangman
                </h1>
                <Star className="w-5 h-5 text-[#716B5D]" />
                <span className="px-2.5 py-0.5 rounded-full bg-[#F9E4E4] border border-[#F1C4C4] text-[10px] font-bold tracking-wider uppercase text-[#B52D2D]">
                  WORDS
                </span>
              </div>
              <p className="text-[13px] text-[#716B5D]">
                Guess the hidden word letter by letter — six lives, and a friend or the computer setting the traps.{" "}
                <button
                  type="button"
                  onClick={() => setShowHowToPlay(true)}
                  className="text-[#B52D2D] font-semibold underline underline-offset-2 cursor-pointer"
                >
                  How to play
                </button>
              </p>
            </div>

            <OnlineRoomBanner
              roomCode={onlineState.room_code}
              viewerSlot={onlineState.viewer_slot}
              opponentConnected={Boolean(onlineState.players[2]?.connected)}
              onLeaveRoom={() => {
                sendOnlineAction("leave_room");
                setOnlineState(null);
                setShowCompanionClient(false);
              }}
              onOpenCompanionWindow={() => setShowCompanionClient(true)}
            />
          </div>
        )}

        {/* Two-Column Responsive Layout (Stacks Sidebar below Game Board on narrow screens) */}
        <div className="flex flex-col lg:flex-row items-start gap-6 xl:gap-8">
          {/* LEFT COLUMN — GAME BOARD */}
          <div className="w-full flex-1 min-w-0 space-y-3">
            {/* 1. Top Row: Round / Score / Streak Pills + Clue Badge + 6 Life Dots */}
            {!isOnlineLobby && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  {topPills.map((pill, idx) => (
                    <span
                      key={idx}
                      className={`px-3.5 py-1 rounded-full text-[12px] font-semibold border tabular-nums ${
                        pill.variant === "clue"
                          ? "bg-[#F9E4E4] border-[#F1C4C4] text-[#B52D2D]"
                          : "bg-[#F7F6F3] border-[#D5C7A6] text-[#201F1A]"
                      }`}
                    >
                      {pill.text}
                    </span>
                  ))}
                </div>

                {/* Six Life Indicators */}
                <div
                  className="flex items-center gap-1.5"
                  aria-label={`${activeRemainingLives} of 6 lives remaining`}
                >
                  {Array.from({ length: 6 }).map((_, idx) => {
                    const alive = idx < activeRemainingLives;
                    return (
                      <span
                        key={idx}
                        className={`w-2.5 h-2.5 rounded-full transition-colors duration-200 ${
                          alive ? "bg-[#B52D2D]" : "bg-[#B4AC9B]"
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Main Board Surface: Either Secret Word Lock-In OR Ruled-Paper Canvas */}
            {showWordSetter ? (
              <WordSetterScreen
                subtitle={wordSetterSubtitle}
                words={words}
                onLockInWord={handleLockInWord}
              />
            ) : (
              <div className="relative w-full rounded-[18px] ruled-notebook-paper border border-[#D5C7A6] shadow-[0_2px_10px_rgba(0,0,0,0.03)] px-4 sm:px-10 py-6 flex flex-col items-center justify-between min-h-[590px]">
                {/* Hand-drawn Gallows & Hangman Character */}
                <div className="w-full flex-1 flex items-center justify-center pt-2">
                  <RuledPaperCanvas
                    remainingLives={activeRemainingLives}
                    maxLives={6}
                    status={activeStatus}
                  />
                </div>

                {/* 3. Hidden-Word Display Below the Drawing */}
                <div className="w-full py-4 flex flex-col items-center gap-4">
                  <div
                    className="flex flex-wrap items-center justify-center gap-2 sm:gap-3"
                    aria-label="Hidden word"
                  >
                    {(activeSecretWord && (isRoundEnded || isOnlineLobby)
                      ? Array.from(activeSecretWord)
                      : activeMaskedChars
                    ).map((ch, idx) => {
                      if (ch === " " && !isOnlineLobby) {
                        return <span key={idx} className="w-4 sm:w-6" />;
                      }
                      if (ch === "-") {
                        return (
                          <span
                            key={idx}
                            className="text-[24px] font-bold text-[#201F1A] px-1"
                          >
                            -
                          </span>
                        );
                      }
                      const wasUnrevealed =
                        (isRoundEnded || isOnlineLobby) &&
                        activeMaskedChars[idx] === "_";
                      const displayLetter = ch === "_" || ch === " " ? "" : ch;

                      return (
                        <div
                          key={idx}
                          className="flex flex-col items-center justify-end min-w-[28px] sm:min-w-[38px]"
                        >
                          <span
                            className={`h-8 sm:h-10 text-[24px] sm:text-[30px] font-bold leading-none select-none ${
                              wasUnrevealed ? "text-[#B52D2D]" : "text-[#201F1A]"
                            }`}
                          >
                            {displayLetter}
                          </span>
                          <span className="w-full h-[3px] sm:h-[4px] rounded-full bg-[#24221E] mt-1" />
                        </div>
                      );
                    })}
                  </div>

                  {/* Subtle dotted separator line matching Screenshots 5 & 6 */}
                  {!isOnlineLobby && (
                    <div className="w-full max-w-[600px] border-b border-dotted border-[#C9C2B2]" />
                  )}
                </div>

                {/* 4, 5 & 6. Show Clue, Virtual Keyboard A–Z, and Solve the Word */}
                {!isOnlineLobby && (
                  <div className="w-full flex flex-col items-center gap-4 pt-1">
                    {showClueButton && (
                      <button
                        type="button"
                        onClick={handleShowClue}
                        className="h-[36px] px-5 rounded-full bg-[#F9E4E4] hover:bg-[#F3D2D2] border border-[#F1C4C4] text-[#B52D2D] text-[13px] font-bold flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Lightbulb className="w-4 h-4" />
                        <span>Show clue</span>
                      </button>
                    )}

                    <VirtualKeyboard
                      correctLetters={activeCorrectSet}
                      incorrectLetters={activeIncorrectSet}
                      disabled={!activeCanGuess || isRoundEnded}
                      onGuessLetter={handleGuessLetter}
                    />

                    {/* Bottom Action: Solve the Word OR Round Summary CTA */}
                    <div className="pt-1">
                      {isRoundEnded ? (
                        <div className="flex flex-wrap items-center justify-center gap-3">
                          <span
                            className={`px-4 py-1.5 rounded-full text-[13px] font-bold ${
                              activeStatus === "WON"
                                ? "bg-[#E6F4EE] text-[#287B5E] border border-[#287B5E]"
                                : "bg-[#F9E4E4] text-[#B52D2D] border border-[#F1C4C4]"
                            }`}
                          >
                            {activeStatus === "WON"
                              ? `Round Won! The word was ${activeSecretWord}`
                              : `Round Over — The word was ${activeSecretWord}`}
                          </span>
                          <button
                            type="button"
                            onClick={handleNextRound}
                            className="h-[36px] px-5 rounded-full bg-[#0C2540] hover:bg-[#173A60] text-white text-[13px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <span>
                              {mode === "computer" ? "Next word" : "Next round (Swap roles)"}
                            </span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={!activeCanGuess}
                          onClick={() => setShowSolveModal(true)}
                          className="h-[34px] px-5 rounded-full bg-[#F7F6F3] hover:bg-white border border-dashed border-[#B5AC99] text-[12px] font-semibold text-[#716B5D] hover:text-[#201F1A] disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          Solve the word
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Online Lobby Overlay Modal (Screenshot 1) */}
                {isOnlineLobby && (
                  <div className="absolute inset-0 bg-[#E6E4E2]/35 rounded-[18px] flex items-center justify-center p-4">
                    <OnlineLobbyModal
                      onCreateRoom={() =>
                        sendOnlineAction("create_room", {
                          player_name: "Sunny Marmot",
                        })
                      }
                      onJoinRoom={(code) =>
                        sendOnlineAction("join_room", {
                          room_code: code,
                          player_name: "Opponent",
                        })
                      }
                      errorMessage={onlineError}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Bottom Category Dropdown (matching bottom-left of Screenshot 5) */}
            {mode === "computer" && !showWordSetter && (
              <div className="pt-2 flex items-center gap-3">
                <span className="text-[11px] font-bold tracking-wider uppercase text-[#716B5D]">
                  CATEGORY
                </span>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    aria-label="Select category"
                    className="appearance-none h-[36px] pl-3.5 pr-8 rounded-[10px] bg-[#F7F6F3] border border-[#D5C7A6] text-[13px] font-medium text-[#201F1A] focus:outline-none focus:border-[#B52D2D] cursor-pointer"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#716B5D]" />
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN — SIDEBAR */}
          <Sidebar
            mode={mode}
            difficulty={difficulty}
            category={category}
            statusText={sidebarStatusText}
            players={sidebarPlayers}
            showResign={mode === "pass_and_play" || isOnlineInRoom}
            showOnlineChat={isOnlineInRoom}
            chatMessages={chatMessages}
            hideModeSwitcher={isOnlineInRoom}
            onModeChange={handleModeChange}
            onDifficultyChange={handleDifficultyChange}
            onCategoryChange={handleCategoryChange}
            onRestart={handleRestart}
            onResign={handleResign}
            onNewGame={handleNewGame}
            onHowToPlay={() => setShowHowToPlay(true)}
            onSendChat={(text) => sendOnlineAction("chat_message", { text })}
          />
        </div>
      </main>

      {/* Solve the Word Modal */}
      {showSolveModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleSolveSubmit}
            className="w-full max-w-[400px] rounded-[18px] bg-[#F7F6F3] border border-[#D5C7A6] shadow-xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[18px] font-bold text-[#201F1A]">
                Solve the word
              </h3>
              <button
                type="button"
                onClick={() => setShowSolveModal(false)}
                className="p-1 text-[#716B5D] hover:text-[#201F1A] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[13px] text-[#716B5D]">
              Enter the complete secret word. A correct solve wins immediately; an incorrect guess costs 1 life.
            </p>
            <input
              type="text"
              value={solveInput}
              onChange={(e) =>
                setSolveInput(e.target.value.toUpperCase().replace(/[^A-Z -]/g, ""))
              }
              placeholder="TYPE FULL WORD"
              autoFocus
              className="w-full h-[46px] px-4 rounded-[12px] bg-white border border-[#D5C7A6] text-center font-mono text-[18px] font-bold tracking-widest text-[#201F1A] focus:outline-none focus:border-[#B52D2D]"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowSolveModal(false)}
                className="h-[38px] px-4 rounded-full border border-[#D5C7A6] text-[13px] font-semibold text-[#716B5D] hover:text-[#201F1A] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!solveInput.trim()}
                className="h-[38px] px-5 rounded-full bg-[#B52D2D] hover:bg-[#992222] text-white text-[13px] font-semibold disabled:opacity-50 cursor-pointer"
              >
                Submit solve
              </button>
            </div>
          </form>
        </div>
      )}

      {/* How to Play Modal */}
      {showHowToPlay && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-[460px] rounded-[18px] bg-[#F7F6F3] border border-[#D5C7A6] shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[19px] font-bold text-[#201F1A]">
                How to play Hangman
              </h3>
              <button
                type="button"
                onClick={() => setShowHowToPlay(false)}
                className="p-1 text-[#716B5D] hover:text-[#201F1A] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ul className="space-y-2.5 text-[13.5px] text-[#201F1A] leading-relaxed list-disc pl-5">
              <li>
                <strong>Six Lives:</strong> Guess the hidden word one letter at a time before all 6 strokes of the gallows are drawn.
              </li>
              <li>
                <strong>Scoring Rule:</strong> Winning a round awards <strong>100 base points + 20 bonus points per remaining life</strong> (up to 220 points for a flawless solve).
              </li>
              <li>
                <strong>Three Modes:</strong>
                <ul className="list-circle pl-5 mt-1 space-y-1 text-[#716B5D]">
                  <li>
                    <strong>Computer:</strong> Solo play across 12 categories and 4 difficulties (Easy, Medium, Hard, Fiendish).
                  </li>
                  <li>
                    <strong>Pass and play:</strong> Two players share one device across 4 rounds, taking turns locking in a secret word and guessing.
                  </li>
                  <li>
                    <strong>A friend online:</strong> Real-time WebSocket rooms with room codes, authoritative server validation, and live chat.
                  </li>
                </ul>
              </li>
            </ul>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowHowToPlay(false)}
                className="h-[38px] px-6 rounded-full bg-[#0C2540] text-white text-[13px] font-semibold cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Companion 2nd Online Player Drawer for Single-Monitor Testing */}
      {showCompanionClient && onlineState?.room_code && (
        <CompanionOnlineClient
          roomCode={onlineState.room_code}
          onClose={() => setShowCompanionClient(false)}
        />
      )}

      {/* Python 3.11 + Flet Codebase & Pytest Modal */}
      <PythonProjectModal
        isOpen={showPythonModal}
        onClose={() => setShowPythonModal(false)}
      />
    </div>
  );
}
