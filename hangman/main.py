"""
Entry point for the Python Flet Hangman application.
Run locally with:
    python main.py
or in a web browser with:
    flet run --web main.py
"""

from __future__ import annotations

import flet as ft

from ui.components import COLOR_BG
from ui.home import HangmanAppController


def main(page: ft.Page) -> None:
    """Configures the Flet window and mounts the HangmanAppController."""
    page.title = "Hangman — A Modern Multiplayer Word Guessing Game"
    page.bgcolor = COLOR_BG
    page.padding = 24
    page.scroll = ft.ScrollMode.AUTO
    page.window_width = 1280
    page.window_height = 860
    page.window_min_width = 480

    controller = HangmanAppController(page)
    page.add(controller.build())


if __name__ == "__main__":
    ft.app(target=main)
