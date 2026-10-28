"""
Left-column Game Board for the Flet Hangman GUI.
Handles three primary views on the left column:
1. Active Guessing Board (Ruled-paper canvas, hidden word slots, 'Show clue', 2x13 keyboard, 'Solve the word')
2. Secret Word Lock-In View ('Think of a word and lock it in.' for Pass-and-Play and Online Setter)
3. Online Room Lobby View ('Create a room / Join a room' overlay over the ruled paper)
"""

from __future__ import annotations

from typing import Callable, List, Optional, Set

import flet as ft

from game.logic import MAX_WORD_LENGTH
from game.words import CATEGORIES, DIFFICULTIES
from ui.components import (
    COLOR_BORDER,
    COLOR_LIGHT_RED,
    COLOR_PAPER,
    COLOR_RED,
    COLOR_TEXT_PRIMARY,
    COLOR_TEXT_SECONDARY,
    HangmanPaperCanvas,
    VirtualKeyboard,
    build_life_indicators,
    build_pill,
)
from ui.multiplayer_screen import OnlineLobbyModal


class GameBoardColumn(ft.Column):
    """Left-hand game board column."""

    def __init__(
        self,
        on_guess_letter: Callable[[str], None],
        on_show_clue: Callable[[], None],
        on_open_solve_modal: Callable[[], None],
        on_suggest_word: Callable[[str, str], Tuple[str, str]],
        on_lock_in_word: Callable[[str, str, str, str], None],
        on_create_room: Callable[[], None],
        on_join_room: Callable[[str], None],
        on_next_round: Callable[[], None],
    ) -> None:
        super().__init__(spacing=14, expand=True)
        self.on_guess_letter = on_guess_letter
        self.on_show_clue = on_show_clue
        self.on_open_solve_modal = on_open_solve_modal
        self.on_suggest_word = on_suggest_word
        self.on_lock_in_word = on_lock_in_word
        self.on_create_room = on_create_room
        self.on_join_room = on_join_room
        self.on_next_round = on_next_round

        self.paper_canvas = HangmanPaperCanvas(remaining_lives=6)
        self.keyboard = VirtualKeyboard(on_key_press=self.on_guess_letter)

        # Secret word lock-in controls
        self.secret_word_field = ft.TextField(
            hint_text="YOUR SECRET WORD",
            text_align=ft.TextAlign.CENTER,
            text_size=22,
            max_length=MAX_WORD_LENGTH,
            border_radius=12,
            bgcolor=COLOR_PAPER,
        )
        self.clue_field = ft.TextField(
            hint_text="Clue (optional)",
            border_radius=10,
            bgcolor=COLOR_PAPER,
            text_size=14,
        )
        self.cat_dropdown = ft.Dropdown(
            value="Any category",
            options=[ft.dropdown.Option(c) for c in CATEGORIES],
            expand=True,
        )
        self.diff_dropdown = ft.Dropdown(
            value="Medium",
            options=[ft.dropdown.Option(d) for d in DIFFICULTIES],
            expand=True,
        )

    def _handle_suggest(self) -> None:
        cat = self.cat_dropdown.value or "Any category"
        diff = self.diff_dropdown.value or "Medium"
        word, clue = self.on_suggest_word(cat, diff)
        self.secret_word_field.value = word
        self.clue_field.value = clue
        if self.page:
            self.page.update()

    def _handle_lock_in(self) -> None:
        word = (self.secret_word_field.value or "").strip()
        clue = (self.clue_field.value or "").strip()
        cat = self.cat_dropdown.value or "Any category"
        diff = self.diff_dropdown.value or "Medium"
        if word:
            self.secret_word_field.value = ""
            self.clue_field.value = ""
            self.on_lock_in_word(word, clue, cat, diff)

    def render_top_bar(
        self,
        left_badges: List[str],
        clue_badge: Optional[str],
        remaining_lives: int,
    ) -> ft.Row:
        pills: List[ft.Control] = [build_pill(text) for text in left_badges]
        if clue_badge:
            pills.append(
                build_pill(
                    clue_badge,
                    bg=COLOR_LIGHT_RED,
                    text_color=COLOR_RED,
                    border_color="#F1C4C4",
                )
            )
        return ft.Row(
            alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
            controls=[
                ft.Row(spacing=8, controls=pills, wrap=True),
                build_life_indicators(remaining_lives),
            ],
        )

    def render_word_setter_view(
        self,
        left_badges: List[str],
        setter_subtitle: str,
        remaining_lives: int = 6,
    ) -> None:
        """Renders Screenshot 2 / 3 / 4 'Think of a word and lock it in.' screen."""
        top_bar = self.render_top_bar(left_badges, None, remaining_lives)
        self.controls = [
            top_bar,
            ft.Text("Think of a word and lock it in.", size=26, weight=ft.FontWeight.W_700, color=COLOR_TEXT_PRIMARY),
            ft.Text(setter_subtitle, size=14, color=COLOR_TEXT_SECONDARY),
            self.secret_word_field,
            ft.Row(
                spacing=10,
                controls=[
                    self.cat_dropdown,
                    self.diff_dropdown,
                    ft.Container(
                        bgcolor=COLOR_LIGHT_RED,
                        padding=ft.padding.symmetric(horizontal=18, vertical=12),
                        border_radius=10,
                        border=ft.border.all(1, "#F1C4C4"),
                        on_click=lambda _: self._handle_suggest(),
                        content=ft.Text("Suggest a word", size=14, weight=ft.FontWeight.W_600, color=COLOR_RED),
                    ),
                ],
            ),
            self.clue_field,
            ft.Container(
                height=48,
                bgcolor="#C86D6D",
                border_radius=10,
                alignment=ft.alignment.center,
                on_click=lambda _: self._handle_lock_in(),
                content=ft.Text("Set the word", size=15, weight=ft.FontWeight.W_600, color="#FFFFFF"),
            ),
        ]

    def render_guessing_board(
        self,
        left_badges: List[str],
        clue_badge: Optional[str],
        remaining_lives: int,
        masked_characters: List[str],
        secret_word: Optional[str],
        correct_letters: Set[str],
        incorrect_letters: Set[str],
        is_over: bool,
        can_guess: bool,
        show_clue_button: bool,
        show_online_lobby: bool = False,
    ) -> None:
        """Renders the ruled-paper Hangman board, word slots, clue button, keyboard, and solve action."""
        top_bar = self.render_top_bar(left_badges, clue_badge, remaining_lives)
        self.paper_canvas.set_lives(remaining_lives)
        self.keyboard.update_keys(correct_letters, incorrect_letters, disabled=not can_guess or is_over)

        # Build word character slots
        slot_controls: List[ft.Control] = []
        full_chars = list(secret_word) if (is_over and secret_word) else masked_characters
        for idx, ch in enumerate(full_chars):
            if ch == " ":
                slot_controls.append(ft.Container(width=20))
                continue
            was_missed = is_over and idx < len(masked_characters) and masked_characters[idx] == "_"
            display_char = "" if ch == "_" else ch
            slot_controls.append(
                ft.Column(
                    spacing=4,
                    horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                    controls=[
                        ft.Text(
                            display_char,
                            size=28,
                            weight=ft.FontWeight.W_700,
                            color=COLOR_RED if was_missed else COLOR_TEXT_PRIMARY,
                        ),
                        ft.Container(width=34, height=3, bgcolor="#2C2A25"),
                    ],
                )
            )

        word_row = ft.Row(
            alignment=ft.MainAxisAlignment.CENTER,
            spacing=10,
            wrap=True,
            controls=slot_controls,
        )

        board_children: List[ft.Control] = [
            self.paper_canvas,
            word_row,
        ]

        if show_clue_button:
            board_children.append(
                ft.Container(
                    bgcolor=COLOR_LIGHT_RED,
                    padding=ft.padding.symmetric(horizontal=18, vertical=8),
                    border_radius=20,
                    border=ft.border.all(1, "#F1C4C4"),
                    on_click=lambda _: self.on_show_clue(),
                    content=ft.Text("💡 Show clue", size=13, weight=ft.FontWeight.W_600, color=COLOR_RED),
                )
            )

        board_children.append(self.keyboard)

        if is_over:
            board_children.append(
                ft.Container(
                    bgcolor=COLOR_RED,
                    padding=ft.padding.symmetric(horizontal=24, vertical=10),
                    border_radius=20,
                    on_click=lambda _: self.on_next_round(),
                    content=ft.Text("Next round →", size=14, weight=ft.FontWeight.W_600, color="#FFFFFF"),
                )
            )
        else:
            board_children.append(
                ft.Container(
                    padding=ft.padding.symmetric(horizontal=18, vertical=8),
                    border_radius=18,
                    border=ft.border.all(1, COLOR_BORDER),
                    on_click=(lambda _: self.on_open_solve_modal()) if can_guess else None,
                    content=ft.Text("Solve the word", size=13, weight=ft.FontWeight.W_500, color=COLOR_TEXT_SECONDARY),
                )
            )

        paper_card = ft.Container(
            bgcolor=COLOR_PAPER,
            padding=24,
            border_radius=16,
            border=ft.border.all(1, COLOR_BORDER),
            content=ft.Stack(
                alignment=ft.alignment.center,
                controls=[
                    ft.Column(
                        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                        spacing=16,
                        controls=board_children,
                    ),
                    *(
                        [OnlineLobbyModal(self.on_create_room, self.on_join_room)]
                        if show_online_lobby
                        else []
                    ),
                ],
            ),
        )

        self.controls = [top_bar, paper_card]
