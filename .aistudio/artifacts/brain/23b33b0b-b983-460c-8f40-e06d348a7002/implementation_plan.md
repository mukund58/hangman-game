# Hangman — A Modern Multiplayer Word Guessing Game

A visually faithful, production-grade word guessing game that reproduces the tactile ruled-paper aesthetic of the reference screenshots while supporting single-player Computer mode, local Pass and Play, and server-authoritative Online Multiplayer with room codes and live chat—delivered both as an immediately playable live application and a complete, modular Python 3.11 + Flet + WebSockets + pytest codebase designed for engineering students.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following product and architectural choices were confirmed during Phase 1 and govern the implementation:

- **Confirmed Decision 1 — Dual Delivery Format**: We will deliver both a live, immediately playable application in the browser preview (with real WebSocket multiplayer, pass-and-play, and computer play) and the complete, modular Python 3.11 + Flet + WebSockets + pytest project (`main.py`, `game`, `ui`, `networking`, `data`, `tests`, `README.md`, and `requirements.txt`) with an integrated interactive Python Code & Architecture Explorer and one-click project bundle export.
- **Confirmed Decision 2 — Round Scoring Formula**: Winning a round awards **100 base points + 20 bonus points per remaining life** (up to 220 points for a flawless 6-life solve). Points are awarded strictly once per completed round and persisted across the match.
- **Confirmed Decision 3 — Progressive Sketch & Audio Feedback**: Incorrect guesses trigger progressive hand-drawn ink strokes on the ruled-paper canvas accompanied by subtle, toggleable Web Audio synthesized pencil/chime sound effects.

---

### 1. Overview & Core Concept

- **What It Does**: Players guess hidden words letter-by-letter (or attempt a full-word solve) within six lives across three distinct modes:
  1. **Computer Mode**: Solo play with streak tracking against a curated 12-category, 4-difficulty word bank (`Easy`, `Medium`, `Hard`, `Fiendish`).
  2. **Pass and Play Mode**: Two players share one device across a 4-round match, alternating between secretly locking in a custom or suggested word (with an optional clue) and guessing the word.
  3. **A Friend Online Mode**: Real-time two-player matches over WebSockets using shareable room codes, featuring an authoritative game server that keeps the secret word hidden from the guesser until the round concludes, plus a live room status banner and real-time chat panel.
- **Target Audience / Persona**: Word-game players who enjoy tactile, editorial puzzle interfaces, and Python engineering students seeking a clean, well-documented, testable reference architecture for GUI, state management, and WebSocket networking.
- **Key Value**: Combines pixel-accurate visual fidelity to the reference screenshots with rock-solid game rules, server-authoritative anti-cheat multiplayer, and beginner-friendly, modular Python code with unit tests.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  - **Computer Flow**: Select *Computer* mode in the right sidebar $\rightarrow$ filter by Difficulty (`Easy`, `Medium`, `Hard`, `Fiendish`) and Category (`Any category`, `Animals`, `Food & drink`, `Geography`, `Sport`, `Jobs`, `Nature`, `Objects`, `The body`, `Music`, `Transport`, `Clothes`, `School`) $\rightarrow$ guess letters via the 2-row `A–M` / `N–Z` keyboard or physical keyboard $\rightarrow$ click *Show clue* to reveal the hint badge in the top bar $\rightarrow$ click *Solve the word* to type the full word directly $\rightarrow$ view round summary and streak updates.
  - **Pass and Play Flow**: Select *Pass and Play* $\rightarrow$ Active word-setter sees the *"Think of a word and lock it in"* screen with a masked/toggleable secret word input (`0 / 16` character counter), category & difficulty dropdowns, *Suggest a word* button, and optional clue input $\rightarrow$ click *Set the word* $\rightarrow$ screen transitions cleanly to the ruled-paper guessing board for the other player without ever exposing the secret word $\rightarrow$ after round completion, roles swap automatically for the next round (`Round 1 / 4` through `Round 4 / 4`).
  - **Online Multiplayer Flow**: Select *A friend online* $\rightarrow$ modal overlay offers *Create a room* (dark navy CTA) or *Join a room* via code input $\rightarrow$ top room banner displays the room code, *Copy link* button, live connection status (*Waiting for your friend to join...* / *Connected*), and *Leave room* button $\rightarrow$ setter locks in a word while the guesser waits $\rightarrow$ server synchronizes masked word slots, guessed letters, life indicators, scores, and real-time chat messages.
  - **Python Flet Architecture & Codebase Inspector**: A non-intrusive toggle in the top bar lets students inspect the complete Python 3.11 + Flet + WebSockets + pytest files, read inline architectural explanations, and download the Python source files directly.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Tactile ruled-notebook paper and editorial stationery aesthetic matching the provided reference screenshots.
  - *Color Palette & Mood*:
    - **Main Canvas Background (`--background`)**: `#E6E4E2` (60% dominant warm stone neutral canvas)
    - **Paper & Card Surface (`--surface`)**: `#F7F6F3` and `#FFFFFF` with horizontal ruled paper lines (`#E2DDD5`) and a thin vertical red margin rule (`#E8B4B4`) on the left edge (30% structural surfaces)
    - **Primary Crimson Accent (`--primary`)**: `#B52D2D` for life indicator dots, incorrect letter strikethroughs, active turn badges, and send buttons (10% high-intent accent)
    - **Soft Rose Highlight (`--accent-soft`)**: `#F9E4E4` for clue pills, active status banners, active player score row, and *Show clue* / *Suggest a word* buttons
    - **Mode & Action Accents**: Dark Navy `#0C2540` (*Create a room* & *Copy link*), Royal Blue `#2B5CE6` (*Computer* mode active button), Vivid Purple `#6C2BD9` (*A friend online* active button), Forest Green `#287B5E` (*Pass and play* active button)
    - **Borders & Typography**: Warm tan border `#D5C7A6`, primary ink text `#201F1A`, secondary muted text `#716B5D`
  - *Typography & Hierarchy*:
    - **Display & Headings**: `Fraunces` / `Playfair Display` paired with bold geometric sans (`Plus Jakarta Sans`) for crisp editorial headers (`"Hangman ☆"`, `"Think of a word and lock it in."`).
    - **UI & Controls**: `Plus Jakarta Sans` (Regular 400 & SemiBold 600) with single-line button discipline (`whitespace-nowrap`) and `tabular-nums` on all scores, round counters, and character limits.
    - **Word Slots & Room Codes**: `JetBrains Mono` for spaced secret word inputs (`YOUR SECRET WORD`), room codes (`r8jhky1BLua`), and code inspection.
  - *Component Styling & Layout*:
    - Responsive two-column desktop layout (`1440px` baseline container): Left column (~68% width) houses the top status pills, the large rounded ruled-paper board with progressive Hangman canvas, hidden word slots, *Show clue* button, 2x13 virtual keyboard (`A–M`, `N–Z`), and dashed *Solve the word* button. Right column (~32% width, `340px–380px`) houses the title header, *How to play* modal trigger, Mode selector card, Status & Action card (*Restart*, *Resign*, *New game*), Player Score card, and Online Chat card.

- **Interactive Feedback & Motion**:
  - Progressive sketch stroke animation when drawing the stool, gallows, head, torso, arms, legs, and comical worried/dizzy facial expressions as lives decrease from 6 to 0.
  - Diagonal red ink strikethrough (`#B52D2D`) on incorrect keyboard keys and green/framed confirmation on correct keys.
  - Synthesized Web Audio API sound effects (pencil scratch on wrong guess, soft chime on right guess, fanfare on round win) with a mute/unmute toggle.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Pure Domain Game Engine Decoupled from UI**:
  - *Chosen Approach*: Implement the core `HangmanGame`, `ScoringEngine`, and `WordDatabase` as pure, side-effect-free classes in both the Python `game/` package and the live web runtime.
  - *Why*: Ensures 100% testability with `pytest`, guarantees identical rules across solo, pass-and-play, and online modes, and helps students clearly see the separation between business logic and Flet UI controls.
  - *Alternatives Considered*: Embedding game state directly inside UI widget callbacks, which makes automated testing and server validation brittle.

- **Decision 2 — Authoritative WebSocket Server with Masked State Broadcasts**:
  - *Chosen Approach*: The WebSocket server maintains authoritative room state and broadcasts customized payloads per player—sending the masked word (`_ _ _ _ _`) to the guessing player while keeping the raw secret word strictly on the server (and visible only to the word setter) until `status` transitions to `WON` or `LOST`.
  - *Why*: Prevents clients from inspecting network traffic to see the secret word, prevents forged score submissions, and enforces turn order and room capacity (max 2 players per room).
  - *Alternatives Considered*: Peer-to-peer or client-broadcast state, which leaks the secret word in WebSocket frames.

- **Decision 3 — Word Difficulty Classification Algorithm**:
  - *Chosen Approach*: Classify words across 12 categories into 4 tiers (`Easy`, `Medium`, `Hard`, `Fiendish`) based on word length, unique letter ratio, and frequency of uncommon consonants (`J, Q, X, Z, K, V, W, Y`):
    - **Easy**: 4–5 letters, common vowels, high familiarity.
    - **Medium**: 6–7 letters, moderate unique letter count.
    - **Hard**: 8–10 letters or compound/hyphenated terms.
    - **Fiendish**: 7–14 letters with low vowel ratios, rare consonants, or tricky orthography (e.g., `RHYTHM`, `FJORD`, `ZEPHYR`).
  - *Why*: Gives players predictable challenge scaling while supporting spaces and hyphens automatically revealed in the word display.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        HANGMAN APPLICATION LAYER                           │
│                                                                            │
│  ┌────────────────────────────────────┐  ┌──────────────────────────────┐  │
│  │        LEFT COLUMN: BOARD          │  │    RIGHT COLUMN: SIDEBAR     │  │
│  │  ┌──────────────────────────────┐  │  │  ┌────────────────────────┐  │  │
│  │  │ Top Bar: Round · Score · 6●  │  │  │  │ Title & How to Play    │  │  │
│  │  └──────────────────────────────┘  │  │  └────────────────────────┘  │  │
│  │  ┌──────────────────────────────┐  │  │  ┌────────────────────────┐  │  │
│  │  │  Ruled-Paper Canvas Area     │  │  │  │ Mode Selector Card     │  │  │
│  │  │  • Progressive Gallows/Body  │  │  │  │ (Computer/Online/Pass) │  │  │
│  │  │  • Or Word Lock-In Form      │  │  │  │ + Difficulty/Category  │  │  │
│  │  │  • Or Create/Join Room Modal │  │  │  └────────────────────────┘  │  │
│  │  │  • Masked Word Slots         │  │  │  ┌────────────────────────┐  │  │
│  │  │  • Show Clue Button          │  │  │  │ Status & Actions Card  │  │  │
│  │  │  • 2x13 Virtual Keyboard     │  │  │  │ (Restart/Resign/New)   │  │  │
│  │  │  • Solve the Word Dialog     │  │  │  └────────────────────────┘  │  │
│  │  └──────────────────────────────┘  │  │  ┌────────────────────────┐  │  │
│  └────────────────────────────────────┘  │  │ Score & Turn Card      │  │  │
│                                          │  │ + Online Chat Panel    │  │  │
│                                          │  └────────────────────────┘  │  │
│                                          └──────────────────────────────┘  │
└───────────────────┬──────────────────────────────────────┬─────────────────┘
                    │ Local Actions                        │ WebSocket JSON
                    ▼                                      ▼
┌───────────────────────────────────────┐  ┌─────────────────────────────────┐
│      CORE GAME & SCORING ENGINE       │  │   AUTHORITATIVE WS ROOM SERVER  │
│  • HangmanGame (lives, guesses, mask) │◄─┤  • Room Registry (max 2/room)   │
│  • WordDatabase (12 cats, 4 diffs)    │  │  • Role Validation (Setter/Gsr) │
│  • ScoringEngine (100 + 20 * lives)   │  │  • Secret-Word Privacy Filter   │
│  • SQLite / JSON Score Persistence    │  │  • Chat & Reconnection Handler  │
└───────────────────────────────────────┘  └─────────────────────────────────┘
```

- **Data Model & State**:
  - **WordEntry**: `word` (uppercase string), `clue` (descriptive string), `category` (one of 12 categories), `difficulty` (`Easy` | `Medium` | `Hard` | `Fiendish`).
  - **RoundState**: `secret_word` (server/local-only until round end), `masked_word` (array of characters or `_` placeholders; spaces and hyphens auto-revealed), `guessed_letters` (ordered list), `correct_letters` (set), `incorrect_letters` (set), `remaining_lives` (integer `0..6`), `max_lives` (`6`), `clue` (string), `clue_revealed` (boolean), `status` (`WAITING_FOR_WORD` | `IN_PROGRESS` | `WON` | `LOST` | `RESIGNED`), `score_awarded` (boolean guard preventing double-scoring).
  - **MatchState**: `mode` (`computer` | `pass_and_play` | `online`), `round_number` (`1..4` or endless in Computer mode), `max_rounds` (`4`), `players` (id, name, avatar, score, is_setter, is_guesser, connected), `streak` (integer for Computer mode).
  - **RoomState (Online)**: `room_code` (unique alphanumeric token), `host_id`, `guest_id`, `match_state`, `chat_messages` (id, sender, text, timestamp).

- **Interactive Component & State Mapping**:
  - **Mode Switcher (`Computer` | `A friend online` | `Pass and play`)**: Immediately transitions the active match context; switching to *Computer* reveals the Difficulty and Category pill selectors in the sidebar and starts a computer-selected round; switching to *Pass and play* opens the Player 1 secret word lock-in view; switching to *A friend online* opens the *Create a room / Join a room* overlay on the ruled paper.
  - **Word Lock-In Form (Pass & Play / Online Setter)**: Validates 2–16 alphabetic/space/hyphen characters, updates the live `0 / 16` counter, populates random matching entries when *Suggest a word* is clicked, and locks in the word + optional clue when *Set the word* is clicked, clearing the input from view.
  - **Virtual & Physical Keyboard (`A–Z`)**: Dispatches `guess_letter(char)` to the active engine or WebSocket server. Valid unguessed letters update `guessed_letters`; incorrect letters decrement `remaining_lives`, advance the Hangman drawing by one stage, and render a red diagonal cross-out on the key.
  - **Solve the Word Modal**: Opens an inline dialog allowing the guesser to submit a full-word guess; exact match immediately wins the round, while an incorrect full-word guess costs 1 life (or ends the round if 1 life remains).
  - **Game Control Buttons (*Restart*, *Resign*, *New game*)**: *Restart* resets the current round with a fresh word; *Resign* forfeits the current round, reveals the word, and advances the turn; *New game* resets match scores and returns to `Round 1 / 4`.
  - **Python Flet Codebase & Test Suite**: Complete, runnable Python modules (`main.py`, `game/logic.py`, `game/words.py`, `game/scoring.py`, `ui/home.py`, `ui/game_screen.py`, `ui/sidebar.py`, `ui/multiplayer_screen.py`, `ui/components.py`, `networking/server.py`, `networking/client.py`, `networking/protocol.py`, `data/words.json`, `tests/test_logic.py`, `tests/test_scoring.py`, `tests/test_networking.py`, `requirements.txt`, and `README.md`) created in the workspace and browsable/downloadable directly from the app interface.
