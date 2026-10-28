"""
Reusable Flet UI components: color palette constants, ruled-paper Hangman canvas
(`ft.canvas.Canvas`), virtual A-Z keyboard, life indicator dots, and status pills.
"""

from __future__ import annotations

import math
from typing import Callable, Iterable, List, Set

import flet as ft
import flet.canvas as cv


# Reference Color Palette
COLOR_BG = "#E6E4E2"
COLOR_PAPER = "#F7F6F3"
COLOR_WHITE = "#FFFFFF"
COLOR_RED = "#B52D2D"
COLOR_LIGHT_RED = "#F9E4E4"
COLOR_NAVY = "#0C2540"
COLOR_GREEN = "#287B5E"
COLOR_BLUE = "#2B5CE6"
COLOR_PURPLE = "#6C2BD9"
COLOR_BORDER = "#D5C7A6"
COLOR_TEXT_PRIMARY = "#201F1A"
COLOR_TEXT_SECONDARY = "#716B5D"
COLOR_RULE_LINE = "#E2DDD5"
COLOR_MARGIN_LINE = "#E8B4B4"


def build_pill(text: str, bg: str = COLOR_PAPER, text_color: str = COLOR_TEXT_PRIMARY, border_color: str = COLOR_BORDER) -> ft.Container:
    """Creates a rounded metadata badge matching the top bar of the reference screenshots."""
    return ft.Container(
        content=ft.Text(text, size=13, weight=ft.FontWeight.W_600, color=text_color),
        bgcolor=bg,
        padding=ft.padding.symmetric(horizontal=14, vertical=6),
        border_radius=20,
        border=ft.border.all(1, border_color),
    )


def build_life_indicators(remaining_lives: int, max_lives: int = 6) -> ft.Row:
    """Builds the row of 6 circular life indicators (red when active, muted tan when lost)."""
    dots: List[ft.Control] = []
    for i in range(max_lives):
        active = i < remaining_lives
        dots.append(
            ft.Container(
                width=11,
                height=11,
                border_radius=6,
                bgcolor=COLOR_RED if active else "#B8B0A0",
            )
        )
    return ft.Row(controls=dots, spacing=6, alignment=ft.MainAxisAlignment.END)


class HangmanPaperCanvas(ft.Container):
    """
    Renders the ruled-notebook paper drawing area with thin horizontal lines,
    a red vertical margin line on the left, and the progressive hand-drawn Hangman
    character using `flet.canvas.Canvas`.
    """

    def __init__(self, remaining_lives: int = 6, max_lives: int = 6) -> None:
        super().__init__()
        self.remaining_lives = remaining_lives
        self.max_lives = max_lives
        self.canvas = cv.Canvas(width=680, height=340)
        self.content = self.canvas
        self.alignment = ft.alignment.center
        self._redraw()

    def set_lives(self, remaining_lives: int) -> None:
        """Updates the remaining lives and redraws the progressive Hangman sketch."""
        self.remaining_lives = remaining_lives
        self._redraw()

    def _redraw(self) -> None:
        shapes: List[cv.Shape] = []
        rule_paint = ft.Paint(color=COLOR_RULE_LINE, stroke_width=1, style=ft.PaintingStyle.STROKE)
        margin_paint = ft.Paint(color=COLOR_MARGIN_LINE, stroke_width=1.5, style=ft.PaintingStyle.STROKE)
        ink_paint = ft.Paint(
            color="#191919",
            stroke_width=5.5,
            stroke_cap=ft.StrokeCap.ROUND,
            stroke_join=ft.StrokeJoin.ROUND,
            style=ft.PaintingStyle.STROKE,
        )
        thin_ink = ft.Paint(
            color="#191919",
            stroke_width=3.0,
            stroke_cap=ft.StrokeCap.ROUND,
            style=ft.PaintingStyle.STROKE,
        )

        # Horizontal ruled paper lines
        for y in range(28, 340, 28):
            shapes.append(cv.Line(0, y, 680, y, paint=rule_paint))

        # Left vertical red margin rule
        shapes.append(cv.Line(28, 0, 28, 340, paint=margin_paint))

        mistakes = max(0, self.max_lives - self.remaining_lives)

        # Base character standing on stool (always visible like Screenshot 5, or progressively framed)
        # Stool
        shapes.append(cv.Line(325, 250, 395, 250, paint=ink_paint))
        shapes.append(cv.Line(334, 250, 328, 284, paint=ink_paint))
        shapes.append(cv.Line(386, 250, 390, 284, paint=ink_paint))
        shapes.append(cv.Line(332, 267, 388, 267, paint=ink_paint))

        # Stick figure (head, body, arms, legs)
        shapes.append(cv.Circle(360, 102, 28, paint=ink_paint))
        shapes.append(cv.Line(360, 130, 360, 200, paint=ink_paint))
        shapes.append(cv.Line(360, 146, 314, 182, paint=ink_paint))
        shapes.append(cv.Line(360, 146, 406, 182, paint=ink_paint))
        shapes.append(cv.Line(360, 200, 342, 250, paint=ink_paint))
        shapes.append(cv.Line(360, 200, 378, 250, paint=ink_paint))

        # Progressive gallows & expressions as mistakes increase (1..6)
        if mistakes >= 1:
            # Gallows base floor beam
            shapes.append(cv.Line(175, 286, 415, 286, paint=ink_paint))
        if mistakes >= 2:
            # Vertical gallows post
            shapes.append(cv.Line(215, 286, 215, 42, paint=ink_paint))
        if mistakes >= 3:
            # Top horizontal beam
            shapes.append(cv.Line(215, 42, 360, 42, paint=ink_paint))
        if mistakes >= 4:
            # Corner diagonal brace
            shapes.append(cv.Line(215, 82, 255, 42, paint=ink_paint))
        if mistakes >= 5:
            # Rope drop to head
            shapes.append(cv.Line(360, 42, 360, 74, paint=ink_paint))

        # Facial expressions
        if mistakes == 0:
            # Calm neutral face (Screenshot 5)
            shapes.append(cv.Circle(350, 96, 3, paint=ink_paint))
            shapes.append(cv.Circle(370, 96, 3, paint=ink_paint))
            shapes.append(cv.Line(352, 112, 368, 112, paint=thin_ink))
        elif mistakes < 6:
            # Worried / surprised face with eyebrows & O mouth (Screenshot 6)
            shapes.append(cv.Circle(350, 96, 4, paint=thin_ink))
            shapes.append(cv.Circle(370, 96, 4, paint=thin_ink))
            shapes.append(cv.Line(343, 86, 354, 83, paint=thin_ink))
            shapes.append(cv.Line(366, 83, 377, 86, paint=thin_ink))
            shapes.append(cv.Circle(360, 114, 6, paint=thin_ink))
        else:
            # Mistake 6 (Lost): Rope taut, X eyes
            shapes.append(cv.Line(360, 42, 360, 74, paint=ink_paint))
            shapes.append(cv.Line(345, 91, 355, 101, paint=thin_ink))
            shapes.append(cv.Line(355, 91, 345, 101, paint=thin_ink))
            shapes.append(cv.Line(365, 91, 375, 101, paint=thin_ink))
            shapes.append(cv.Line(375, 91, 365, 101, paint=thin_ink))
            shapes.append(cv.Line(350, 115, 370, 115, paint=thin_ink))

        self.canvas.shapes = shapes


class VirtualKeyboard(ft.Column):
    """
    2-row x 13-column A–Z virtual keyboard matching the reference screenshots.
    - Unguessed keys: crisp white rectangular tiles with dark border
    - Correct guesses: highlighted with green border/fill
    - Incorrect guesses: struck through in red (#B52D2D) and disabled
    """

    ROW_1 = list("ABCDEFGHIJKLM")
    ROW_2 = list("NOPQRSTUVWXYZ")

    def __init__(self, on_key_press: Callable[[str], None]) -> None:
        super().__init__(spacing=8, horizontal_alignment=ft.CrossAxisAlignment.CENTER)
        self.on_key_press = on_key_press
        self.update_keys(set(), set(), disabled=False)

    def update_keys(
        self,
        correct_letters: Set[str],
        incorrect_letters: Set[str],
        disabled: bool = False,
    ) -> None:
        """Rebuilds the two keyboard rows based on current guessed letters."""
        self.controls = [
            self._build_row(self.ROW_1, correct_letters, incorrect_letters, disabled),
            self._build_row(self.ROW_2, correct_letters, incorrect_letters, disabled),
        ]

    def _build_row(
        self,
        letters: Iterable[str],
        correct_letters: Set[str],
        incorrect_letters: Set[str],
        disabled: bool,
    ) -> ft.Row:
        buttons: List[ft.Control] = []
        for ch in letters:
            is_correct = ch in correct_letters
            is_wrong = ch in incorrect_letters
            is_used = is_correct or is_wrong or disabled

            if is_wrong:
                # Struck-through letter with no box border, matching Screenshot 6
                tile = ft.Container(
                    width=40,
                    height=44,
                    alignment=ft.alignment.center,
                    content=ft.Stack(
                        controls=[
                            ft.Container(
                                alignment=ft.alignment.center,
                                content=ft.Text(
                                    ch,
                                    size=15,
                                    weight=ft.FontWeight.W_600,
                                    color=COLOR_RED,
                                ),
                            ),
                            ft.Container(
                                alignment=ft.alignment.center,
                                content=ft.Container(
                                    width=24,
                                    height=2,
                                    bgcolor=COLOR_RED,
                                    rotate=ft.Rotate(angle=-0.25),
                                ),
                            ),
                        ]
                    ),
                )
            else:
                bg = "#E3F2EC" if is_correct else COLOR_WHITE
                border_col = COLOR_GREEN if is_correct else "#C9C2B2"
                txt_col = COLOR_GREEN if is_correct else COLOR_TEXT_PRIMARY
                tile = ft.Container(
                    width=40,
                    height=44,
                    bgcolor=bg,
                    border_radius=5,
                    border=ft.border.all(1.5 if is_correct else 1, border_col),
                    alignment=ft.alignment.center,
                    ink=not is_used,
                    on_click=(None if is_used else lambda e, letter=ch: self.on_key_press(letter)),
                    content=ft.Text(ch, size=15, weight=ft.FontWeight.W_700, color=txt_col),
                )
            buttons.append(tile)

        return ft.Row(
            controls=buttons,
            spacing=6,
            alignment=ft.MainAxisAlignment.CENTER,
            wrap=True,
        )
