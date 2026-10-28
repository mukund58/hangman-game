import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFile } from "child_process";

const PORT = 3000;
const MAX_LIVES = 6;
const MAX_WORD_LENGTH = 16;
const BASE_WIN_POINTS = 100;
const LIFE_BONUS_POINTS = 20;

type GameStatus = "WAITING_FOR_WORD" | "IN_PROGRESS" | "WON" | "LOST" | "RESIGNED";

interface RoundState {
  secretWord: string;
  guessedLetters: string[];
  correctLetters: Set<string>;
  incorrectLetters: Set<string>;
  remainingLives: number;
  maxLives: number;
  clue: string;
  category: string;
  difficulty: string;
  clueRevealed: boolean;
  status: GameStatus;
  scoreAwarded: boolean;
}

interface PlayerSlot {
  playerId: string;
  slot: 1 | 2;
  name: string;
  connected: boolean;
  score: number;
  ws: WebSocket | null;
}

interface ChatEntry {
  id: string;
  senderSlot: 1 | 2;
  senderName: string;
  text: string;
  timestamp: number;
}

interface RoomState {
  roomCode: string;
  roundNumber: number;
  maxRounds: number;
  setterSlot: 1 | 2;
  guesserSlot: 1 | 2;
  lastMessage: string;
  players: {
    1: PlayerSlot;
    2?: PlayerSlot;
  };
  round: RoundState;
  chat: ChatEntry[];
}

function createInitialRound(): RoundState {
  return {
    secretWord: "",
    guessedLetters: [],
    correctLetters: new Set<string>(),
    incorrectLetters: new Set<string>(),
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

function validateSecretWord(raw: string): string {
  const normalized = raw.trim().toUpperCase().replace(/\s+/g, " ");
  if (!normalized) {
    throw new Error("Secret word cannot be empty.");
  }
  if (normalized.length < 2) {
    throw new Error("Secret word must be at least 2 characters long.");
  }
  if (normalized.length > MAX_WORD_LENGTH) {
    throw new Error(`Secret word cannot exceed ${MAX_WORD_LENGTH} characters.`);
  }
  let hasLetter = false;
  for (const ch of normalized) {
    if (ch >= "A" && ch <= "Z") {
      hasLetter = true;
    } else if (ch === " " || ch === "-") {
      continue;
    } else {
      throw new Error("Secret word may only contain letters (A-Z), spaces, or hyphens.");
    }
  }
  if (!hasLetter) {
    throw new Error("Secret word must contain at least one letter.");
  }
  return normalized;
}

function getRequiredLetters(word: string): Set<string> {
  const req = new Set<string>();
  for (const ch of word) {
    if (ch >= "A" && ch <= "Z") {
      req.add(ch);
    }
  }
  return req;
}

function getMaskedCharacters(round: RoundState): string[] {
  const chars: string[] = [];
  for (const ch of round.secretWord) {
    if (ch === " " || ch === "-") {
      chars.push(ch);
    } else if (round.correctLetters.has(ch)) {
      chars.push(ch);
    } else {
      chars.push("_");
    }
  }
  return chars;
}

function isRoundOver(round: RoundState): boolean {
  return round.status === "WON" || round.status === "LOST" || round.status === "RESIGNED";
}

function awardRoundScoreIfEligible(room: RoomState): void {
  const r = room.round;
  if (!isRoundOver(r) || r.scoreAwarded) return;
  r.scoreAwarded = true;
  if (r.status === "WON") {
    const pts = BASE_WIN_POINTS + Math.max(0, r.remainingLives) * LIFE_BONUS_POINTS;
    const guesser = room.players[room.guesserSlot];
    if (guesser) {
      guesser.score += pts;
    }
  }
}

function buildPersonalizedState(room: RoomState, viewerSlot: 1 | 2) {
  const r = room.round;
  const over = isRoundOver(r);
  const revealSecret = viewerSlot === room.setterSlot || over;
  const p1 = room.players[1];
  const p2 = room.players[2];

  return {
    type: "state_update",
    room_code: room.roomCode,
    viewer_slot: viewerSlot,
    round_number: room.roundNumber,
    max_rounds: room.maxRounds,
    setter_slot: room.setterSlot,
    guesser_slot: room.guesserSlot,
    last_message: room.lastMessage,
    players: {
      1: {
        slot: 1,
        name: p1.name,
        connected: p1.connected,
        score: p1.score,
      },
      2: {
        slot: 2,
        name: p2 ? p2.name : "Opponent",
        connected: p2 ? p2.connected : false,
        score: p2 ? p2.score : 0,
      },
    },
    game: {
      status: r.status,
      masked_characters: getMaskedCharacters(r),
      guessed_letters: r.guessedLetters,
      correct_letters: Array.from(r.correctLetters),
      incorrect_letters: Array.from(r.incorrectLetters),
      remaining_lives: r.remainingLives,
      max_lives: r.maxLives,
      category: r.category,
      difficulty: r.difficulty,
      has_clue: Boolean(r.clue),
      clue: r.clueRevealed || revealSecret ? r.clue : "",
      clue_revealed: r.clueRevealed,
      secret_word: revealSecret ? r.secretWord : null,
      word_length: r.secretWord.length,
    },
    chat: room.chat,
  };
}

function generateRoomCode(existing: Map<string, RoomState>): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  while (true) {
    let code = "";
    for (let i = 0; i < 10; i++) {
      code += alphabet[crypto.randomInt(0, alphabet.length)];
    }
    if (!existing.has(code)) return code;
  }
}

function broadcastRoomState(room: RoomState) {
  for (const slot of [1, 2] as const) {
    const p = room.players[slot];
    if (p && p.connected && p.ws && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(JSON.stringify(buildPersonalizedState(room, slot)));
    }
  }
}

function sendError(ws: WebSocket, message: string) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "error", message }));
  }
}

const PYTHON_FILES_META: Array<{ path: string; stage: string; responsibility: string }> = [
  {
    path: "hangman/main.py",
    stage: "Stage 2 & 3",
    responsibility: "Application entry point configuring the Flet page window and mounting HangmanAppController.",
  },
  {
    path: "hangman/requirements.txt",
    stage: "Stage 1 & 7",
    responsibility: "Python package dependencies (flet, websockets, pytest, pytest-asyncio).",
  },
  {
    path: "hangman/README.md",
    stage: "Stage 7",
    responsibility: "Complete Linux setup, virtual environment commands, LAN/Internet server guide, and pytest instructions.",
  },
  {
    path: "hangman/game/logic.py",
    stage: "Stage 1",
    responsibility: "Pure HangmanGame class managing secret word validation, guesses, 6 lives, masked display, and win/loss detection.",
  },
  {
    path: "hangman/game/words.py",
    stage: "Stage 1",
    responsibility: "WordDatabase loader, category/difficulty filter, word suggestion engine, and difficulty classification algorithm.",
  },
  {
    path: "hangman/game/scoring.py",
    stage: "Stage 1 & 3",
    responsibility: "ScoringEngine (100 base + 20 per remaining life), single-award round guard, and JSON/SQLite persistence.",
  },
  {
    path: "hangman/ui/components.py",
    stage: "Stage 2",
    responsibility: "Flet ruled-paper Canvas with progressive Hangman drawing, 2x13 A-Z virtual keyboard with red strikethroughs, and life dots.",
  },
  {
    path: "hangman/ui/game_screen.py",
    stage: "Stage 2 & 4",
    responsibility: "Left-column Flet game board, word slots, Show clue button, Solve dialog, and Pass-and-Play word setter view.",
  },
  {
    path: "hangman/ui/sidebar.py",
    stage: "Stage 2 & 6",
    responsibility: "Right-column Flet sidebar with mode selector, difficulty/category pills, status actions, player score cards, and chat.",
  },
  {
    path: "hangman/ui/multiplayer_screen.py",
    stage: "Stage 5 & 6",
    responsibility: "Online Create/Join room modal card and top pink Room Code banner with copy/leave actions.",
  },
  {
    path: "hangman/ui/home.py",
    stage: "Stage 3, 4 & 6",
    responsibility: "Master responsive 2-column Flet controller wiring Computer, Pass-and-Play, and Online Multiplayer modes.",
  },
  {
    path: "hangman/networking/protocol.py",
    stage: "Stage 5",
    responsibility: "WebSocket message type enums and safe JSON payload validator.",
  },
  {
    path: "hangman/networking/server.py",
    stage: "Stage 5 & 6",
    responsibility: "Authoritative asyncio WebSockets server with room isolation, role validation, secret-word privacy, and chat.",
  },
  {
    path: "hangman/networking/client.py",
    stage: "Stage 5 & 6",
    responsibility: "Non-blocking async WebSocket client integrated with Flet's event loop via page.run_task.",
  },
  {
    path: "hangman/data/words.json",
    stage: "Stage 1",
    responsibility: "Categorized database of 120 unique words across 12 categories and 4 difficulty levels.",
  },
  {
    path: "hangman/tests/test_logic.py",
    stage: "Stage 1 & 7",
    responsibility: "Pytest unit tests for correct/incorrect/duplicate guesses, invalid input, win/loss detection, and spaces/hyphens.",
  },
  {
    path: "hangman/tests/test_scoring.py",
    stage: "Stage 1 & 7",
    responsibility: "Pytest unit tests for 100 + 20*lives scoring, single-award-per-round protection, and JSON/SQLite persistence.",
  },
  {
    path: "hangman/tests/test_networking.py",
    stage: "Stage 5 & 7",
    responsibility: "Pytest unit tests for room capacity, invalid codes, unauthorized actions, secret-word privacy, and room isolation.",
  },
];

async function startServer() {
  const app = express();
  app.use(express.json());

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  const rooms = new Map<string, RoomState>();
  const playerToRoom = new Map<string, string>();

  // API: Serve words.json from /hangman/data/words.json
  app.get("/api/words", (_req, res) => {
    try {
      const wordsPath = path.resolve(process.cwd(), "hangman/data/words.json");
      const raw = fs.readFileSync(wordsPath, "utf-8");
      res.type("application/json").send(raw);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // API: Serve complete Python Flet codebase for student inspection & download
  app.get("/api/python-project", (_req, res) => {
    try {
      const files = PYTHON_FILES_META.map((meta) => {
        const fullPath = path.resolve(process.cwd(), meta.path);
        const content = fs.existsSync(fullPath)
          ? fs.readFileSync(fullPath, "utf-8")
          : "# File not found";
        return {
          ...meta,
          content,
        };
      });
      res.json({ files });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // API: Execute real Python unit test suite (`python3 hangman/run_tests.py`)
  app.post("/api/run-pytest", (_req, res) => {
    const scriptPath = path.resolve(process.cwd(), "hangman/run_tests.py");
    execFile("python3", [scriptPath], { cwd: process.cwd(), timeout: 10000 }, (error, stdout, stderr) => {
      res.json({
        passed: !error,
        stdout: stdout || "",
        stderr: stderr || "",
      });
    });
  });

  wss.on("connection", (ws: WebSocket) => {
    let boundPlayerId: string | null = null;

    ws.on("message", (rawBuffer) => {
      let data: Record<string, any>;
      try {
        data = JSON.parse(rawBuffer.toString());
      } catch {
        sendError(ws, "Malformed JSON message.");
        return;
      }

      const type = String(data.type || "");
      const playerId = String(data.player_id || crypto.randomBytes(6).toString("hex"));
      boundPlayerId = playerId;

      try {
        if (type === "create_room") {
          const playerName = String(data.player_name || "Sunny Marmot").trim().slice(0, 24) || "Sunny Marmot";
          const code = generateRoomCode(rooms);
          const room: RoomState = {
            roomCode: code,
            roundNumber: 1,
            maxRounds: 4,
            setterSlot: 1,
            guesserSlot: 2,
            lastMessage: "Think of a word and lock it in.",
            players: {
              1: {
                playerId,
                slot: 1,
                name: playerName,
                connected: true,
                score: 0,
                ws,
              },
            },
            round: createInitialRound(),
            chat: [],
          };
          rooms.set(code, room);
          playerToRoom.set(playerId, code);
          broadcastRoomState(room);
          return;
        }

        if (type === "join_room" || type === "reconnect_room") {
          const code = String(data.room_code || "").trim();
          const playerName = String(data.player_name || "Opponent").trim().slice(0, 24) || "Opponent";
          const room = rooms.get(code);
          if (!room) {
            throw new Error(`Room '${code}' does not exist.`);
          }

          if (room.players[1].playerId === playerId) {
            room.players[1].connected = true;
            room.players[1].ws = ws;
            playerToRoom.set(playerId, code);
            broadcastRoomState(room);
            return;
          }

          if (room.players[2] && room.players[2].playerId === playerId) {
            room.players[2].connected = true;
            room.players[2].ws = ws;
            playerToRoom.set(playerId, code);
            broadcastRoomState(room);
            return;
          }

          if (room.players[2] && room.players[2].connected) {
            throw new Error(`Room '${code}' is already full (2/2 players).`);
          }

          room.players[2] = {
            playerId,
            slot: 2,
            name: playerName,
            connected: true,
            score: room.players[2]?.score ?? 0,
            ws,
          };
          playerToRoom.set(playerId, code);
          broadcastRoomState(room);
          return;
        }

        const roomCode = String(data.room_code || playerToRoom.get(playerId) || "").trim();
        const room = rooms.get(roomCode);
        if (!room) {
          throw new Error("Room does not exist.");
        }

        const viewerSlot: 1 | 2 | null =
          room.players[1].playerId === playerId
            ? 1
            : room.players[2]?.playerId === playerId
            ? 2
            : null;

        if (!viewerSlot || playerToRoom.get(playerId) !== roomCode) {
          throw new Error("Unauthorized action for this room.");
        }

        if (type === "leave_room") {
          const slotObj = room.players[viewerSlot];
          if (slotObj) {
            slotObj.connected = false;
            slotObj.ws = null;
          }
          playerToRoom.delete(playerId);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "left_room" }));
          }
          broadcastRoomState(room);
          return;
        }

        if (type === "set_word") {
          if (viewerSlot !== room.setterSlot) {
            throw new Error("Only the active word setter can lock in the secret word.");
          }
          if (room.round.status !== "WAITING_FOR_WORD") {
            throw new Error("A secret word is already active for this round.");
          }
          const validated = validateSecretWord(String(data.word || ""));
          room.round = {
            secretWord: validated,
            guessedLetters: [],
            correctLetters: new Set<string>(),
            incorrectLetters: new Set<string>(),
            remainingLives: MAX_LIVES,
            maxLives: MAX_LIVES,
            clue: String(data.clue || "").trim().slice(0, 80),
            category: String(data.category || "Any category"),
            difficulty: String(data.difficulty || "Medium"),
            clueRevealed: false,
            status: "IN_PROGRESS",
            scoreAwarded: false,
          };
          room.lastMessage = "Guess the word";
          broadcastRoomState(room);
          return;
        }

        if (type === "guess_letter") {
          if (viewerSlot !== room.guesserSlot) {
            throw new Error("Only the guessing player may guess letters.");
          }
          if (!room.players[2]) {
            throw new Error("Waiting for your friend to join before guessing.");
          }
          const r = room.round;
          if (r.status !== "IN_PROGRESS") {
            throw new Error("Round is not currently in progress.");
          }
          const letter = String(data.letter || "").trim().toUpperCase();
          if (letter.length !== 1 || letter < "A" || letter > "Z") {
            throw new Error("Please guess a single letter from A to Z.");
          }
          if (r.guessedLetters.includes(letter)) {
            throw new Error(`Letter '${letter}' has already been guessed.`);
          }

          r.guessedLetters.push(letter);
          const req = getRequiredLetters(r.secretWord);
          if (req.has(letter)) {
            r.correctLetters.add(letter);
            let allFound = true;
            for (const ch of req) {
              if (!r.correctLetters.has(ch)) {
                allFound = false;
                break;
              }
            }
            if (allFound) {
              r.status = "WON";
              room.lastMessage = "Word solved!";
              awardRoundScoreIfEligible(room);
            } else {
              room.lastMessage = "Guess the word";
            }
          } else {
            r.incorrectLetters.add(letter);
            r.remainingLives = Math.max(0, r.remainingLives - 1);
            if (r.remainingLives === 0) {
              r.status = "LOST";
              room.lastMessage = `Out of lives! The word was ${r.secretWord}.`;
              awardRoundScoreIfEligible(room);
            } else {
              room.lastMessage = "Guess the word";
            }
          }
          broadcastRoomState(room);
          return;
        }

        if (type === "solve_word") {
          if (viewerSlot !== room.guesserSlot) {
            throw new Error("Only the guessing player may solve the word.");
          }
          const r = room.round;
          if (r.status !== "IN_PROGRESS") {
            throw new Error("Round is not currently in progress.");
          }
          const candidate = String(data.word || "").trim().toUpperCase().replace(/\s+/g, " ");
          if (!candidate) {
            throw new Error("Please enter a complete word to solve.");
          }
          if (candidate === r.secretWord) {
            for (const ch of getRequiredLetters(r.secretWord)) {
              r.correctLetters.add(ch);
              if (!r.guessedLetters.includes(ch)) r.guessedLetters.push(ch);
            }
            r.status = "WON";
            room.lastMessage = "Brilliant! Solved the word!";
            awardRoundScoreIfEligible(room);
          } else {
            r.remainingLives = Math.max(0, r.remainingLives - 1);
            if (r.remainingLives === 0) {
              r.status = "LOST";
              room.lastMessage = `Wrong solve! The word was ${r.secretWord}.`;
              awardRoundScoreIfEligible(room);
            } else {
              room.lastMessage = `'${candidate}' is not the word (-1 life).`;
            }
          }
          broadcastRoomState(room);
          return;
        }

        if (type === "reveal_clue") {
          room.round.clueRevealed = true;
          broadcastRoomState(room);
          return;
        }

        if (type === "resign_round") {
          room.round.remainingLives = 0;
          room.round.status = "RESIGNED";
          room.lastMessage = `Round resigned. The word was ${room.round.secretWord || "not set"}.`;
          awardRoundScoreIfEligible(room);
          broadcastRoomState(room);
          return;
        }

        if (type === "next_round") {
          room.roundNumber = (room.roundNumber % room.maxRounds) + 1;
          const prevSetter = room.setterSlot;
          room.setterSlot = room.guesserSlot;
          room.guesserSlot = prevSetter;
          room.round = createInitialRound();
          room.lastMessage = "Think of a word and lock it in.";
          broadcastRoomState(room);
          return;
        }

        if (type === "new_match") {
          room.roundNumber = 1;
          room.setterSlot = 1;
          room.guesserSlot = 2;
          room.players[1].score = 0;
          if (room.players[2]) room.players[2].score = 0;
          room.round = createInitialRound();
          room.lastMessage = "Think of a word and lock it in.";
          broadcastRoomState(room);
          return;
        }

        if (type === "chat_message") {
          const text = String(data.text || "").trim().slice(0, 300);
          if (!text) return;
          const sender = room.players[viewerSlot];
          room.chat.push({
            id: crypto.randomBytes(6).toString("hex"),
            senderSlot: viewerSlot,
            senderName: sender ? sender.name : `Player ${viewerSlot}`,
            text,
            timestamp: Date.now(),
          });
          if (room.chat.length > 50) {
            room.chat = room.chat.slice(-50);
          }
          broadcastRoomState(room);
          return;
        }

        throw new Error(`Unsupported message type: ${type}`);
      } catch (err: any) {
        sendError(ws, err?.message || "Server error");
      }
    });

    ws.on("close", () => {
      if (!boundPlayerId) return;
      const code = playerToRoom.get(boundPlayerId);
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;
      for (const slot of [1, 2] as const) {
        const p = room.players[slot];
        if (p && p.playerId === boundPlayerId) {
          p.connected = false;
          p.ws = null;
        }
      }
      broadcastRoomState(room);
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Hangman Full-Stack Server + WebSocket listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
