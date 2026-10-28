"""
Right-column Sidebar for the Flet Hangman GUI.
Includes:
1. Title ("Hangman ☆"), description, and "How to play" action
2. Mode card (Computer, A friend online, Pass and play) + Difficulty & Category filters
3. Status card (Current game status pill + Restart, Resign, New game buttons)
4. Score card for both players + integrated Chat panel in Online mode
"""

from __future__ import annotations

from typing import Any, Callable, Dict, List

import flet as ft

from game.words import CATEGORIES, DIFFICULTIES
from ui.components import (
    COLOR_BLUE,
    COLOR_BORDER,
    COLOR_GREEN,
    COLOR_LIGHT_RED,
    COLOR_PAPER,
    COLOR_PURPLE,
    COLOR_RED,
    COLOR_TEXT_PRIMARY,
    COLOR_TEXT_SECONDARY,
    COLOR_WHITE,
)


class SidebarColumn(ft.Column):
    """Right-hand sidebar containing game mode selectors, status controls, scores, and chat."""

    def __init__(
        self,
        on_mode_change: Callable[[str], None],
        on_difficulty_change: Callable[[str], None],
        on_category_change: Callable[[str], None],
        on_restart: Callable[[], None],
        on_resign: Callable[[], None],
        on_new_game: Callable[[], None],
        on_how_to_play: Callable[[], None],
        on_send_chat: Callable[[str], None],
    ) -> None:
        super().__init__(spacing=16, width=360)
        self.on_mode_change = on_mode_change
        self.on_difficulty_change = on_difficulty_change
        self.on_category_change = on_category_change
        self.on_restart = on_restart
        self.on_resign = on_resign
        self.on_new_game = on_new_game
        self.on_how_to_play = on_how_to_play
        self.on_send_chat = on_send_chat

        self.chat_input = ft.TextField(
            hint_text="Message...",
            border_radius=20,
            height=40,
            text_size=13,
            content_padding=ft.padding.symmetric(horizontal=14, vertical=8),
            expand=True,
            on_submit=lambda e: self._submit_chat(),
        )

    def _submit_chat(self) -> None:
        text = (self.chat_input.value or "").strip()
        if text:
            self.chat_input.value = ""
            self.on_send_chat(text)

    def render_sidebar(
        self,
        mode: str,
        difficulty: str,
        category: str,
        status_text: str,
        players: List[Dict[str, Any]],
        chat_messages: List[Dict[str, Any]],
        show_online_chat: bool = False,
    ) -> None:
        """Rebuilds the sidebar controls to reflect current match state."""
        header = ft.Column(
            spacing=6,
            controls=[
                ft.Row(
                    spacing=8,
                    controls=[
                        ft.Text("Hangman", size=26, weight=ft.FontWeight.W_700, color=COLOR_TEXT_PRIMARY),
                        ft.Text("☆", size=20, color=COLOR_TEXT_SECONDARY),
                    ],
                ),
                ft.Text(
                    "Guess the hidden word letter by letter — six lives, and a friend or the computer setting the traps.",
                    size=13,
                    color=COLOR_TEXT_SECONDARY,
                ),
                ft.TextButton(
                    content=ft.Text(
                        "How to play",
                        size=13,
                        weight=ft.FontWeight.W_600,
                        color=COLOR_RED,
                        style=ft.TextStyle(decoration=ft.TextDecoration.UNDERLINE),
                    ),
                    on_click=lambda _: self.on_how_to_play(),
                ),
            ],
        )

        mode_card = self._build_mode_card(mode, difficulty, category)
        status_card = self._build_status_card(mode, status_text)
        score_card = self._build_score_and_chat_card(players, chat_messages, show_online_chat)

        self.controls = [header, mode_card, status_card, score_card]

    def _build_mode_card(self, mode: str, difficulty: str, category: str) -> ft.Container:
        def mode_btn(key: str, label: str, icon_name: str, active_bg: str) -> ft.Container:
            is_active = mode == key
            return ft.Container(
                expand=True,
                height=78,
                bgcolor=active_bg if is_active else COLOR_PAPER,
                border_radius=12,
                border=ft.border.all(1.5 if is_active else 1, active_bg if is_active else COLOR_BORDER),
                alignment=ft.alignment.center,
                on_click=lambda _: self.on_mode_change(key),
                content=ft.Column(
                    alignment=ft.MainAxisAlignment.CENTER,
                    horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                    spacing=4,
                    controls=[
                        ft.Icon(name=icon_name, size=20, color=COLOR_WHITE if is_active else active_bg),
                        ft.Text(
                            label,
                            size=12,
                            weight=ft.FontWeight.W_600,
                            color=COLOR_WHITE if is_active else COLOR_TEXT_PRIMARY,
                            text_align=ft.TextAlign.CENTER,
                        ),
                    ],
                ),
            )

        card_controls: List[ft.Control] = [
            ft.Text("MODE", size=11, weight=ft.FontWeight.W_700, color=COLOR_TEXT_SECONDARY),
            ft.Row(
                spacing=8,
                controls=[
                    mode_btn("computer", "Computer", "casino_outlined", COLOR_BLUE),
                    mode_btn("online", "A friend\nonline", "link", COLOR_PURPLE),
                    mode_btn("pass_and_play", "Pass and\nplay", "people_outline", COLOR_GREEN),
                ],
            ),
        ]

        if mode == "computer":
            diff_row = ft.Row(
                spacing=4,
                controls=[
                    ft.Container(
                        expand=True,
                        padding=ft.padding.symmetric(vertical=6),
                        bgcolor=COLOR_WHITE if difficulty == d else "transparent",
                        border_radius=16,
                        alignment=ft.alignment.center,
                        on_click=lambda _, val=d: self.on_difficulty_change(val),
                        content=ft.Text(
                            d,
                            size=12,
                            weight=ft.FontWeight.W_600,
                            color=COLOR_RED if difficulty == d else COLOR_TEXT_PRIMARY,
                        ),
                    )
                    for d in DIFFICULTIES
                ],
            )
            cat_wrap = ft.Row(
                wrap=True,
                spacing=6,
                run_spacing=6,
                controls=[
                    ft.Container(
                        padding=ft.padding.symmetric(horizontal=12, vertical=6),
                        bgcolor=COLOR_LIGHT_RED if category == c else COLOR_WHITE,
                        border_radius=18,
                        border=ft.border.all(1, COLOR_RED if category == c else COLOR_BORDER),
                        on_click=lambda _, val=c: self.on_category_change(val),
                        content=ft.Text(
                            c,
                            size=12,
                            weight=ft.FontWeight.W_600,
                            color=COLOR_RED if category == c else COLOR_TEXT_PRIMARY,
                        ),
                    )
                    for c in CATEGORIES
                ],
            )
            card_controls.extend(
                [
                    ft.Text("DIFFICULTY", size=11, weight=ft.FontWeight.W_700, color=COLOR_TEXT_SECONDARY),
                    ft.Container(
                        bgcolor="#ECEAE4",
                        padding=4,
                        border_radius=20,
                        content=diff_row,
                    ),
                    ft.Text("CATEGORY", size=11, weight=ft.FontWeight.W_700, color=COLOR_TEXT_SECONDARY),
                    cat_wrap,
                ]
            )

        return ft.Container(
            bgcolor=COLOR_PAPER,
            padding=16,
            border_radius=14,
            border=ft.border.all(1, COLOR_BORDER),
            content=ft.Column(spacing=12, controls=card_controls),
        )

    def _build_status_card(self, mode: str, status_text: str) -> ft.Container:
        action_buttons: List[ft.Control] = [
            ft.Container(
                padding=ft.padding.symmetric(horizontal=14, vertical=10),
                border_radius=10,
                border=ft.border.all(1, COLOR_BORDER),
                on_click=lambda _: self.on_restart(),
                content=ft.Column(
                    spacing=4,
                    horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                    controls=[
                        ft.Icon(name="refresh", size=18, color=COLOR_TEXT_PRIMARY),
                        ft.Text("Restart", size=12, weight=ft.FontWeight.W_600, color=COLOR_TEXT_PRIMARY),
                    ],
                ),
            )
        ]

        if mode in ("pass_and_play", "online"):
            action_buttons.append(
                ft.Container(
                    padding=ft.padding.symmetric(horizontal=14, vertical=10),
                    border_radius=10,
                    border=ft.border.all(1, COLOR_BORDER),
                    on_click=lambda _: self.on_resign(),
                    content=ft.Column(
                        spacing=4,
                        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                        controls=[
                            ft.Icon(name="flag_outlined", size=18, color=COLOR_RED),
                            ft.Text("Resign", size=12, weight=ft.FontWeight.W_600, color=COLOR_RED),
                        ],
                    ),
                )
            )

        action_buttons.append(
            ft.Container(
                padding=ft.padding.symmetric(horizontal=14, vertical=10),
                border_radius=10,
                border=ft.border.all(1, COLOR_BORDER),
                on_click=lambda _: self.on_new_game(),
                content=ft.Column(
                    spacing=4,
                    horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                    controls=[
                        ft.Icon(name="add", size=18, color=COLOR_TEXT_PRIMARY),
                        ft.Text("New game", size=12, weight=ft.FontWeight.W_600, color=COLOR_TEXT_PRIMARY),
                    ],
                ),
            )
        )

        return ft.Container(
            bgcolor=COLOR_PAPER,
            padding=16,
            border_radius=14,
            border=ft.border.all(1, COLOR_BORDER),
            content=ft.Column(
                spacing=12,
                controls=[
                    ft.Container(
                        bgcolor=COLOR_LIGHT_RED,
                        padding=ft.padding.symmetric(horizontal=12, vertical=8),
                        border_radius=8,
                        content=ft.Row(
                            spacing=8,
                            controls=[
                                ft.Container(width=8, height=8, border_radius=4, bgcolor=COLOR_RED),
                                ft.Text(status_text, size=13, weight=ft.FontWeight.W_700, color=COLOR_RED),
                            ],
                        ),
                    ),
                    ft.Row(spacing=8, controls=action_buttons),
                ],
            ),
        )

    def _build_score_and_chat_card(
        self,
        players: List[Dict[str, Any]],
        chat_messages: List[Dict[str, Any]],
        show_online_chat: bool,
    ) -> ft.Container:
        player_rows: List[ft.Control] = []
        for p in players:
            is_turn = bool(p.get("is_turn"))
            initials = str(p.get("initials") or "P1")
            avatar_color = str(p.get("color") or COLOR_BLUE)
            player_rows.append(
                ft.Container(
                    bgcolor=COLOR_LIGHT_RED if is_turn else "transparent",
                    padding=ft.padding.symmetric(horizontal=12, vertical=10),
                    border_radius=10,
                    content=ft.Row(
                        alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                        controls=[
                            ft.Row(
                                spacing=10,
                                controls=[
                                    ft.Container(
                                        width=34,
                                        height=34,
                                        border_radius=17,
                                        bgcolor=avatar_color,
                                        alignment=ft.alignment.center,
                                        content=ft.Text(
                                            initials,
                                            size=13,
                                            weight=ft.FontWeight.W_700,
                                            color=COLOR_WHITE,
                                        ),
                                    ),
                                    ft.Column(
                                        spacing=2,
                                        controls=[
                                            ft.Text(
                                                str(p.get("name") or "Player"),
                                                size=14,
                                                weight=ft.FontWeight.W_600,
                                                color=COLOR_TEXT_PRIMARY,
                                            ),
                                            ft.Text(
                                                "• Your turn" if is_turn else "Waiting",
                                                size=11,
                                                weight=ft.FontWeight.W_600,
                                                color=COLOR_RED if is_turn else COLOR_TEXT_SECONDARY,
                                            ),
                                        ],
                                    ),
                                ],
                            ),
                            ft.Text(
                                str(p.get("score", 0)),
                                size=20,
                                weight=ft.FontWeight.W_700,
                                color=COLOR_TEXT_PRIMARY,
                            ),
                        ],
                    ),
                )
            )

        controls: List[ft.Control] = [
            ft.Text("Score", size=12, weight=ft.FontWeight.W_600, color=COLOR_TEXT_SECONDARY),
            *player_rows,
        ]

        if show_online_chat:
            chat_items: List[ft.Control] = []
            if not chat_messages:
                chat_items.append(
                    ft.Container(
                        height=140,
                        alignment=ft.alignment.center,
                        content=ft.Text("Say hello 👋", size=13, italic=True, color=COLOR_TEXT_SECONDARY),
                    )
                )
            else:
                for msg in chat_messages[-15:]:
                    chat_items.append(
                        ft.Text(
                            f"{msg.get('sender_name', 'Player')}: {msg.get('text', '')}",
                            size=12,
                            color=COLOR_TEXT_PRIMARY,
                        )
                    )

            controls.extend(
                [
                    ft.Divider(height=1, color=COLOR_BORDER),
                    ft.Text("CHAT", size=11, weight=ft.FontWeight.W_700, color=COLOR_TEXT_SECONDARY),
                    ft.Container(
                        height=150,
                        padding=8,
                        content=ft.ListView(controls=chat_items, spacing=6, auto_scroll=True),
                    ),
                    ft.Row(
                        spacing=8,
                        controls=[
                            self.chat_input,
                            ft.IconButton(
                                icon="send",
                                icon_color=COLOR_WHITE,
                                bgcolor=COLOR_RED,
                                on_click=lambda _: self._submit_chat(),
                            ),
                        ],
                    ),
                ]
            )

        return ft.Container(
            bgcolor=COLOR_PAPER,
            padding=16,
            border_radius=14,
            border=ft.border.all(1, COLOR_BORDER),
            content=ft.Column(spacing=10, controls=controls),
        )
