"""
Online Multiplayer UI components for Flet:
1. `OnlineLobbyModal` — 'Create a room' or 'Join a room' card matching Screenshot 1.
2. `OnlineRoomBanner` — Top pink room bar displaying the room code, 'Copy link',
   live player connection status, and 'Leave room' button matching Screenshot 4.
"""

from __future__ import annotations

from typing import Callable

import flet as ft

from ui.components import (
    COLOR_BORDER,
    COLOR_LIGHT_RED,
    COLOR_NAVY,
    COLOR_PAPER,
    COLOR_RED,
    COLOR_TEXT_PRIMARY,
    COLOR_TEXT_SECONDARY,
    COLOR_WHITE,
)


class OnlineLobbyModal(ft.Container):
    """Card rendered over the ruled-paper board allowing a player to create or join a room."""

    def __init__(
        self,
        on_create_room: Callable[[], None],
        on_join_room: Callable[[str], None],
    ) -> None:
        super().__init__(
            width=420,
            padding=24,
            bgcolor=COLOR_PAPER,
            border_radius=16,
            border=ft.border.all(1, COLOR_BORDER),
        )
        self.on_create_room = on_create_room
        self.on_join_room = on_join_room
        self.code_input = ft.TextField(
            hint_text="Enter room code",
            border_radius=24,
            height=44,
            text_size=14,
            content_padding=ft.padding.symmetric(horizontal=16, vertical=10),
            expand=True,
            on_submit=lambda _: self._handle_join(),
        )

        self.content = ft.Column(
            spacing=14,
            tight=True,
            controls=[
                ft.Row(
                    spacing=10,
                    controls=[
                        ft.Container(
                            width=30,
                            height=30,
                            border_radius=15,
                            bgcolor=COLOR_LIGHT_RED,
                            alignment=ft.alignment.center,
                            content=ft.Text("+", size=18, weight=ft.FontWeight.W_700, color=COLOR_RED),
                        ),
                        ft.Text("Create a room", size=16, weight=ft.FontWeight.W_700, color=COLOR_TEXT_PRIMARY),
                    ],
                ),
                ft.Text("Start a new game and get a code to share.", size=13, color=COLOR_TEXT_SECONDARY),
                ft.Container(
                    height=44,
                    bgcolor=COLOR_NAVY,
                    border_radius=22,
                    alignment=ft.alignment.center,
                    on_click=lambda _: self.on_create_room(),
                    content=ft.Text("Create a room", size=14, weight=ft.FontWeight.W_600, color=COLOR_WHITE),
                ),
                ft.Row(
                     controls=[
                        ft.Divider(expand=True, color=COLOR_BORDER),
                        ft.Text("or", size=12, color=COLOR_TEXT_SECONDARY),
                        ft.Divider(expand=True, color=COLOR_BORDER),
                    ]
                ),
                ft.Text("Join a room", size=16, weight=ft.FontWeight.W_700, color=COLOR_TEXT_PRIMARY),
                ft.Text("Have a code? Enter it to join your friend.", size=13, color=COLOR_TEXT_SECONDARY),
                ft.Row(
                    spacing=10,
                    controls=[
                        self.code_input,
                        ft.Container(
                            height=44,
                            padding=ft.padding.symmetric(horizontal=24),
                            border_radius=22,
                            border=ft.border.all(1, COLOR_BORDER),
                            alignment=ft.alignment.center,
                            on_click=lambda _: self._handle_join(),
                            content=ft.Text("Join", size=14, weight=ft.FontWeight.W_600, color=COLOR_TEXT_PRIMARY),
                        ),
                    ],
                ),
            ],
        )

    def _handle_join(self) -> None:
        code = (self.code_input.value or "").strip()
        if code:
            self.on_join_room(code)


class OnlineRoomBanner(ft.Container):
    """Top pink banner displaying the active room code, connection status, and Leave button."""

    def __init__(
        self,
        room_code: str,
        opponent_connected: bool,
        on_copy_code: Callable[[str], None],
        on_leave_room: Callable[[], None],
    ) -> None:
        super().__init__(
            bgcolor=COLOR_LIGHT_RED,
            padding=ft.padding.symmetric(horizontal=20, vertical=12),
            border_radius=12,
            border=ft.border.all(1, "#F1C4C4"),
        )
        status_label = "Opponent connected" if opponent_connected else "Waiting for your friend to join..."
        status_color = "#287B5E" if opponent_connected else "#B76E14"

        self.content = ft.Row(
            alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
            controls=[
                ft.Row(
                    spacing=14,
                    controls=[
                        ft.Column(
                            spacing=2,
                            controls=[
                                ft.Text("ROOM CODE", size=10, weight=ft.FontWeight.W_700, color=COLOR_RED),
                                ft.Text(
                                    room_code,
                                    size=20,
                                    weight=ft.FontWeight.W_700,
                                    font_family="monospace",
                                    color=COLOR_TEXT_PRIMARY,
                                ),
                            ],
                        ),
                        ft.Container(
                            bgcolor=COLOR_NAVY,
                            padding=ft.padding.symmetric(horizontal=14, vertical=8),
                            border_radius=18,
                            on_click=lambda _: on_copy_code(room_code),
                            content=ft.Text("Copy link", size=12, weight=ft.FontWeight.W_600, color=COLOR_WHITE),
                        ),
                    ],
                ),
                ft.Row(
                    spacing=16,
                    controls=[
                        ft.Text(status_label, size=13, weight=ft.FontWeight.W_600, color=status_color),
                        ft.Container(
                            bgcolor=COLOR_RED,
                            padding=ft.padding.symmetric(horizontal=16, vertical=8),
                            border_radius=18,
                            on_click=lambda _: on_leave_room(),
                            content=ft.Text("Leave room", size=12, weight=ft.FontWeight.W_600, color=COLOR_WHITE),
                        ),
                    ],
                ),
            ],
        )
