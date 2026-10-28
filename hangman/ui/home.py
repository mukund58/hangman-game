"""
Master controller and responsive two-column layout for the Flet Hangman application.
Coordinates:
- Mode A: Computer (single-player with streak, difficulty, and category selection)
- Mode B: Pass and Play (two local players alternating setter/guesser roles across 4 rounds)
- Mode C: Online Multiplayer (authoritative WebSocket client with room banner and chat)
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Set, Tuple

import flet as ft

from game.logic import GameStatus, HangmanGame
from game.scoring import ScoringEngine
from game.words import WordDatabase
from networking.client import HangmanNetworkClient
from networking.protocol import ClientMessageType
from ui.components import COLOR_BG, COLOR_BLUE, COLOR_RED
from ui.game_screen import GameBoardColumn
from ui.multiplayer_screen import OnlineRoomBanner
from ui.sidebar import SidebarColumn


class HangmanAppController:
    """Coordinates game modes, domain models, WebSocket client, and Flet UI views."""

    def __init__(self, page: ft.Page) -> None:
        self.page = page
        self.word_db = WordDatabase()
        self.game = HangmanGame()
        self.scoring = ScoringEngine()
        self.scoring.register_player("Sunny Marmot")
        self.scoring.register_player("Player 1")
        self.scoring.register_player("Player 2")

        self.mode: str = "computer"  # 'computer' | 'pass_and_play' | 'online'
        self.difficulty: str = "Medium"
        self.category: str = "Any category"
        self.round_number: int = 1
        self.max_rounds: int = 4
        self.setter_slot: int = 1
        self.guesser_slot: int = 2
        self.used_words: Set[str] = set()
        self.status_message: str = "Guess the word"

        # Online multiplayer state
        self.online_state: Optional[Dict[str, Any]] = None
        self.network_client = HangmanNetworkClient(
            on_state_update=self._on_network_state_update,
            on_error=self._on_network_error,
        )

        # UI Columns
        self.board_col = GameBoardColumn(
            on_guess_letter=self.handle_guess_letter,
            on_show_clue=self.handle_show_clue,
            on_open_solve_modal=self.open_solve_dialog,
            on_suggest_word=self.handle_suggest_word,
            on_lock_in_word=self.handle_lock_in_word,
            on_create_room=self.handle_create_room,
            on_join_room=self.handle_join_room,
            on_next_round=self.handle_next_round,
        )
        self.sidebar_col = SidebarColumn(
            on_mode_change=self.handle_mode_change,
            on_difficulty_change=self.handle_difficulty_change,
            on_category_change=self.handle_category_change,
            on_restart=self.handle_restart,
            on_resign=self.handle_resign,
            on_new_game=self.handle_new_game,
            on_how_to_play=self.open_how_to_play_dialog,
            on_send_chat=self.handle_send_chat,
        )

        self.root_container = ft.Column(spacing=16, expand=True)
        self.page.on_keyboard_event = self._on_keyboard_event
        self._start_computer_round()

    def build(self) -> ft.Control:
        """Returns the root Flet control tree."""
        self.refresh_ui()
        return self.root_container

    def _on_keyboard_event(self, e: ft.KeyboardEvent) -> None:
        if e.key and len(e.key) == 1 and "A" <= e.key.upper() <= "Z":
            if self.mode == "pass_and_play" and self.game.status == GameStatus.WAITING_FOR_WORD:
                return
            self.handle_guess_letter(e.key.upper())

    def _start_computer_round(self) -> None:
        entry = self.word_db.suggest_word(
            category=self.category,
            difficulty=self.difficulty,
            exclude_words=self.used_words,
        )
        self.used_words.add(entry.word)
        self.game.set_secret_word(
            entry.word,
            clue=entry.clue,
            category=entry.category,
            difficulty=entry.difficulty,
        )
        self.status_message = "Guess the word"
        self.refresh_ui()

    def handle_mode_change(self, new_mode: str) -> None:
        self.mode = new_mode
        if new_mode == "computer":
            self._start_computer_round()
        elif new_mode == "pass_and_play":
            self.round_number = 1
            self.setter_slot = 1
            self.guesser_slot = 2
            self.game = HangmanGame()
            self.status_message = "Think of a word and lock it in."
            self.refresh_ui()
        elif new_mode == "online":
            self.status_message = "Create or join a room"
            self.refresh_ui()

    def handle_difficulty_change(self, difficulty: str) -> None:
        self.difficulty = difficulty
        if self.mode == "computer":
            self._start_computer_round()

    def handle_category_change(self, category: str) -> None:
        self.category = category
        if self.mode == "computer":
            self._start_computer_round()

    def handle_suggest_word(self, category: str, difficulty: str) -> Tuple[str, str]:
        entry = self.word_db.suggest_word(category=category, difficulty=difficulty)
        return entry.word, entry.clue

    def handle_lock_in_word(self, word: str, clue: str, category: str, difficulty: str) -> None:
        if self.mode == "online":
            self.page.run_task(
                self.network_client.send_action,
                ClientMessageType.SET_WORD,
                word=word,
                clue=clue,
                category=category,
                difficulty=difficulty,
            )
            return

        try:
            self.game.set_secret_word(word, clue=clue, category=category, difficulty=difficulty)
            self.status_message = "Guess the word"
            self.refresh_ui()
        except ValueError as exc:
            self._show_snackbar(str(exc))

    def handle_guess_letter(self, letter: str) -> None:
        if self.mode == "online":
            self.page.run_task(
                self.network_client.send_action,
                ClientMessageType.GUESS_LETTER,
                letter=letter,
            )
            return

        result = self.game.guess_letter(letter)
        if not result.accepted:
            return
        self.status_message = result.message
        if self.game.is_over:
            guesser = "Sunny Marmot" if self.mode == "computer" else f"Player {self.guesser_slot}"
            self.scoring.record_round_result(self.game, guesser)
        self.refresh_ui()

    def handle_show_clue(self) -> None:
        if self.mode == "online":
            self.page.run_task(self.network_client.send_action, ClientMessageType.REVEAL_CLUE)
            return
        self.game.reveal_clue()
        self.refresh_ui()

    def handle_restart(self) -> None:
        if self.mode == "computer":
            self._start_computer_round()
        elif self.mode == "pass_and_play":
            self.game = HangmanGame()
            self.status_message = "Think of a word and lock it in."
            self.refresh_ui()
        elif self.mode == "online" and self.online_state:
            self.page.run_task(self.network_client.send_action, ClientMessageType.NEXT_ROUND)

    def handle_resign(self) -> None:
        if self.mode == "online":
            self.page.run_task(self.network_client.send_action, ClientMessageType.RESIGN_ROUND)
            return
        self.game.resign()
        guesser = "Sunny Marmot" if self.mode == "computer" else f"Player {self.guesser_slot}"
        self.scoring.record_round_result(self.game, guesser)
        self.status_message = f"Resigned! The word was {self.game.secret_word}."
        self.refresh_ui()

    def handle_new_game(self) -> None:
        if self.mode == "online":
            self.page.run_task(self.network_client.send_action, ClientMessageType.NEW_MATCH)
            return
        self.scoring.reset_match_scores()
        self.round_number = 1
        self.setter_slot = 1
        self.guesser_slot = 2
        if self.mode == "computer":
            self._start_computer_round()
        else:
            self.game = HangmanGame()
            self.status_message = "Think of a word and lock it in."
            self.refresh_ui()

    def handle_next_round(self) -> None:
        if self.mode == "computer":
            self._start_computer_round()
        elif self.mode == "pass_and_play":
            self.round_number = (self.round_number % self.max_rounds) + 1
            self.setter_slot, self.guesser_slot = self.guesser_slot, self.setter_slot
            self.game = HangmanGame()
            self.status_message = "Think of a word and lock it in."
            self.refresh_ui()
        elif self.mode == "online":
            self.page.run_task(self.network_client.send_action, ClientMessageType.NEXT_ROUND)

    # Online Multiplayer Handlers
    def handle_create_room(self) -> None:
        self.page.run_task(
            self.network_client.send_action,
            ClientMessageType.CREATE_ROOM,
            player_name="Sunny Marmot",
        )

    def handle_join_room(self, code: str) -> None:
        self.page.run_task(
            self.network_client.send_action,
            ClientMessageType.JOIN_ROOM,
            room_code=code,
            player_name="Opponent",
        )

    def handle_leave_room(self) -> None:
        self.page.run_task(self.network_client.send_action, ClientMessageType.LEAVE_ROOM)
        self.online_state = None
        self.refresh_ui()

    def handle_send_chat(self, text: str) -> None:
        if self.mode == "online" and self.online_state:
            self.page.run_task(
                self.network_client.send_action,
                ClientMessageType.CHAT_MESSAGE,
                text=text,
            )

    def _on_network_state_update(self, state: Dict[str, Any]) -> None:
        self.online_state = state
        self.refresh_ui()

    def _on_network_error(self, message: str) -> None:
        self._show_snackbar(message)

    def _show_snackbar(self, message: str) -> None:
        self.page.snack_bar = ft.SnackBar(content=ft.Text(message))
        self.page.snack_bar.open = True
        self.page.update()

    def open_solve_dialog(self) -> None:
        solve_input = ft.TextField(hint_text="Type the complete word", autofocus=True)

        def submit_solve(_: Any) -> None:
            candidate = (solve_input.value or "").strip()
            dialog.open = False
            self.page.update()
            if not candidate:
                return
            if self.mode == "online":
                self.page.run_task(
                    self.network_client.send_action,
                    ClientMessageType.SOLVE_WORD,
                    word=candidate,
                )
            else:
                res = self.game.solve_word(candidate)
                self.status_message = res.message
                if self.game.is_over:
                    guesser = "Sunny Marmot" if self.mode == "computer" else f"Player {self.guesser_slot}"
                    self.scoring.record_round_result(self.game, guesser)
                self.refresh_ui()

        dialog = ft.AlertDialog(
            title=ft.Text("Solve the word"),
            content=solve_input,
            actions=[
                ft.TextButton("Cancel", on_click=lambda _: setattr(dialog, "open", False) or self.page.update()),
                ft.ElevatedButton("Guess word", on_click=submit_solve),
            ],
        )
        self.page.dialog = dialog
        dialog.open = True
        self.page.update()

    def open_how_to_play_dialog(self) -> None:
        dialog = ft.AlertDialog(
            title=ft.Text("How to play Hangman"),
            content=ft.Text(
                "1. You have 6 lives to guess the hidden word letter by letter.\n"
                "2. Each wrong letter adds another stroke to the gallows.\n"
                "3. Winning a round awards 100 base points + 20 bonus points per remaining life.\n"
                "4. In Pass & Play or Online mode, players alternate setting and guessing words over 4 rounds."
            ),
            actions=[
                ft.TextButton("Got it", on_click=lambda _: setattr(dialog, "open", False) or self.page.update()),
            ],
        )
        self.page.dialog = dialog
        dialog.open = True
        self.page.update()

    def refresh_ui(self) -> None:
        """Synchronizes both columns with the active game mode state."""
        top_banner: List[ft.Control] = []

        if self.mode == "computer":
            p = self.scoring.register_player("Sunny Marmot")
            clue_badge = f"Clue: {self.game.clue}" if self.game.clue_revealed else f"Clue: {self.game.category}"
            self.board_col.render_guessing_board(
                left_badges=[f"Streak {p.streak}"],
                clue_badge=clue_badge,
                remaining_lives=self.game.remaining_lives,
                masked_characters=self.game.get_masked_characters(),
                secret_word=self.game.secret_word if self.game.is_over else None,
                correct_letters=self.game.correct_letters,
                incorrect_letters=self.game.incorrect_letters,
                is_over=self.game.is_over,
                can_guess=not self.game.is_over,
                show_clue_button=not self.game.clue_revealed and not self.game.is_over,
            )
            self.sidebar_col.render_sidebar(
                mode=self.mode,
                difficulty=self.difficulty,
                category=self.category,
                status_text=self.status_message,
                players=[
                    {
                        "name": "Sunny Marmot",
                        "initials": "SM",
                        "color": COLOR_BLUE,
                        "score": p.score,
                        "is_turn": True,
                    }
                ],
                chat_messages=[],
                show_online_chat=False,
            )

        elif self.mode == "pass_and_play":
            p1 = self.scoring.register_player("Player 1")
            p2 = self.scoring.register_player("Player 2")
            badges = [
                f"Round {self.round_number} / {self.max_rounds}",
                f"Player 1 {p1.score} · Player 2 {p2.score}",
            ]
            if self.game.status == GameStatus.WAITING_FOR_WORD:
                self.board_col.render_word_setter_view(
                    left_badges=badges,
                    setter_subtitle=f"Player {self.setter_slot} — write a word for Player {self.guesser_slot}",
                )
                active_slot = self.setter_slot
            else:
                clue_badge = f"Clue: {self.game.clue}" if (self.game.clue and self.game.clue_revealed) else None
                self.board_col.render_guessing_board(
                    left_badges=badges,
                    clue_badge=clue_badge,
                    remaining_lives=self.game.remaining_lives,
                    masked_characters=self.game.get_masked_characters(),
                    secret_word=self.game.secret_word if self.game.is_over else None,
                    correct_letters=self.game.correct_letters,
                    incorrect_letters=self.game.incorrect_letters,
                    is_over=self.game.is_over,
                    can_guess=not self.game.is_over,
                    show_clue_button=bool(self.game.clue) and not self.game.clue_revealed and not self.game.is_over,
                )
                active_slot = self.guesser_slot

            self.sidebar_col.render_sidebar(
                mode=self.mode,
                difficulty=self.difficulty,
                category=self.category,
                status_text=self.status_message,
                players=[
                    {
                        "name": "Player 1",
                        "initials": "P1",
                        "color": COLOR_BLUE,
                        "score": p1.score,
                        "is_turn": active_slot == 1,
                    },
                    {
                        "name": "Player 2",
                        "initials": "P2",
                        "color": COLOR_RED,
                        "score": p2.score,
                        "is_turn": active_slot == 2,
                    },
                ],
                chat_messages=[],
                show_online_chat=False,
            )

        elif self.mode == "online":
            if not self.online_state:
                self.board_col.render_guessing_board(
                    left_badges=["Online Multiplayer"],
                    clue_badge=None,
                    remaining_lives=6,
                    masked_characters=["_", "R", "_", "_", "E"],
                    secret_word=None,
                    correct_letters={"R", "E"},
                    incorrect_letters=set(),
                    is_over=False,
                    can_guess=False,
                    show_clue_button=False,
                    show_online_lobby=True,
                )
                self.sidebar_col.render_sidebar(
                    mode=self.mode,
                    difficulty=self.difficulty,
                    category=self.category,
                    status_text="Create or join a room",
                    players=[],
                    chat_messages=[],
                    show_online_chat=False,
                )
            else:
                st = self.online_state
                viewer_slot = int(st["viewer_slot"])
                setter_slot = int(st["setter_slot"])
                guesser_slot = int(st["guesser_slot"])
                p1_info = st["players"]["1"]
                p2_info = st["players"]["2"]
                g_state = st["game"]

                top_banner.append(
                    OnlineRoomBanner(
                        room_code=str(st["room_code"]),
                        opponent_connected=bool(p2_info["connected"]),
                        on_copy_code=lambda code: self.page.set_clipboard(code),
                        on_leave_room=self.handle_leave_room,
                    )
                )

                badges = [
                    f"Round {st['round_number']} / {st['max_rounds']}",
                    f"You {st['players'][str(viewer_slot)]['score']} · Opponent {st['players'][str(3 - viewer_slot)]['score']}",
                ]

                if g_state["status"] == GameStatus.WAITING_FOR_WORD.value:
                    if viewer_slot == setter_slot:
                        self.board_col.render_word_setter_view(
                            left_badges=badges,
                            setter_subtitle="You — write a word for Opponent",
                        )
                    else:
                        self.board_col.render_guessing_board(
                            left_badges=badges,
                            clue_badge="Waiting for opponent to lock in a word...",
                            remaining_lives=6,
                            masked_characters=["_", "_", "_", "_", "_"],
                            secret_word=None,
                            correct_letters=set(),
                            incorrect_letters=set(),
                            is_over=False,
                            can_guess=False,
                            show_clue_button=False,
                        )
                    active_slot = setter_slot
                else:
                    is_over = g_state["status"] in ("WON", "LOST", "RESIGNED")
                    clue_badge = f"Clue: {g_state['clue']}" if g_state.get("clue") else None
                    self.board_col.render_guessing_board(
                        left_badges=badges,
                        clue_badge=clue_badge,
                        remaining_lives=int(g_state["remaining_lives"]),
                        masked_characters=list(g_state["masked_characters"]),
                        secret_word=g_state.get("secret_word"),
                        correct_letters=set(g_state["correct_letters"]),
                        incorrect_letters=set(g_state["incorrect_letters"]),
                        is_over=is_over,
                        can_guess=(viewer_slot == guesser_slot and not is_over),
                        show_clue_button=bool(g_state.get("has_clue")) and not g_state.get("clue_revealed") and not is_over,
                    )
                    active_slot = guesser_slot

                self.sidebar_col.render_sidebar(
                    mode=self.mode,
                    difficulty=self.difficulty,
                    category=self.category,
                    status_text=str(st.get("last_message") or "Guess the word"),
                    players=[
                        {
                            "name": p2_info["name"],
                            "initials": "O",
                            "color": COLOR_RED,
                            "score": p2_info["score"],
                            "is_turn": active_slot == 2,
                        },
                        {
                            "name": p1_info["name"],
                            "initials": "SM",
                            "color": COLOR_BLUE,
                            "score": p1_info["score"],
                            "is_turn": active_slot == 1,
                        },
                    ],
                    chat_messages=list(st.get("chat") or []),
                    show_online_chat=True,
                )

        # Responsive 2-column layout: stacks sidebar below game board on narrow screens
        responsive_layout = ft.ResponsiveRow(
            columns=12,
            spacing=24,
            run_spacing=24,
            controls=[
                ft.Column(col={"xs": 12, "md": 8, "lg": 8}, controls=[self.board_col]),
                ft.Column(col={"xs": 12, "md": 4, "lg": 4}, controls=[self.sidebar_col]),
            ],
        )

        self.root_container.controls = [*top_banner, responsive_layout]
        if self.page:
            self.page.update()
