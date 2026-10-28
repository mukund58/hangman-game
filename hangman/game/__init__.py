"""
Core domain package for the Hangman word guessing game.
"""

from .logic import GameStatus, GuessResult, HangmanGame
from .scoring import PlayerScore, ScoringEngine
from .words import CATEGORIES, DIFFICULTIES, WordDatabase, WordEntry

__all__ = [
    "CATEGORIES",
    "DIFFICULTIES",
    "GameStatus",
    "GuessResult",
    "HangmanGame",
    "PlayerScore",
    "ScoringEngine",
    "WordDatabase",
    "WordEntry",
]
