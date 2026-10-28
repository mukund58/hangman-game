"""
Pure domain logic for the Hangman word guessing game.
Completely decoupled from any GUI or networking framework so it can be unit-tested
directly with pytest and reused on both client and server.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Set


MAX_LIVES = 6
MAX_WORD_LENGTH = 16


class GameStatus(str, Enum):
    """Lifecycle states of a single Hangman round."""

    WAITING_FOR_WORD = "WAITING_FOR_WORD"
    IN_PROGRESS = "IN_PROGRESS"
    WON = "WON"
    LOST = "LOST"
    RESIGNED = "RESIGNED"


@dataclass(frozen=True)
class GuessResult:
    """Outcome of a single letter or full-word guess."""

    accepted: bool
    correct: bool
    letter: str
    message: str
    status: GameStatus
    remaining_lives: int


class HangmanGame:
    """
    Manages the rules and state of a single Hangman round.

    Responsibilities:
    - Validates and stores the secret word (letters, spaces, and hyphens allowed)
    - Tracks guessed letters (correct vs. incorrect)
    - Tracks remaining lives (starts at 6, never drops below 0)
    - Generates the masked word display (auto-revealing spaces and hyphens)
    - Detects win and loss states automatically
    - Prevents duplicate guesses or guesses after the round has ended
    """

    def __init__(
        self,
        secret_word: str = "",
        clue: str = "",
        category: str = "Any category",
        difficulty: str = "Medium",
        max_lives: int = MAX_LIVES,
    ) -> None:
        self.max_lives: int = max_lives
        self.remaining_lives: int = max_lives
        self.guessed_letters: List[str] = []
        self.correct_letters: Set[str] = set()
        self.incorrect_letters: Set[str] = set()
        self.clue: str = clue.strip()
        self.category: str = category
        self.difficulty: str = difficulty
        self.clue_revealed: bool = False
        self.score_awarded: bool = False
        self._secret_word: str = ""
        self.status: GameStatus = GameStatus.WAITING_FOR_WORD

        if secret_word.strip():
            self.set_secret_word(secret_word, clue=clue, category=category, difficulty=difficulty)

    @property
    def secret_word(self) -> str:
        """Returns the uppercase secret word."""
        return self._secret_word

    @staticmethod
    def validate_secret_word(word: str) -> str:
        """
        Validates that a candidate secret word contains at least one ASCII letter,
        uses only letters, spaces, or hyphens, and does not exceed MAX_WORD_LENGTH.
        Returns the normalized uppercase word or raises ValueError.
        """
        normalized = " ".join(word.strip().upper().split())
        if not normalized:
            raise ValueError("Secret word cannot be empty.")
        if len(normalized) < 2:
            raise ValueError("Secret word must be at least 2 characters long.")
        if len(normalized) > MAX_WORD_LENGTH:
            raise ValueError(f"Secret word cannot exceed {MAX_WORD_LENGTH} characters.")

        has_letter = False
        for ch in normalized:
            if "A" <= ch <= "Z":
                has_letter = True
            elif ch in (" ", "-"):
                continue
            else:
                raise ValueError("Secret word may only contain letters (A-Z), spaces, or hyphens.")

        if not has_letter:
            raise ValueError("Secret word must contain at least one letter.")

        return normalized

    def set_secret_word(
        self,
        word: str,
        clue: str = "",
        category: str = "Any category",
        difficulty: str = "Medium",
    ) -> None:
        """Locks in the secret word and starts the round."""
        normalized = self.validate_secret_word(word)
        self._secret_word = normalized
        self.clue = clue.strip()
        self.category = category
        self.difficulty = difficulty
        self.remaining_lives = self.max_lives
        self.guessed_letters.clear()
        self.correct_letters.clear()
        self.incorrect_letters.clear()
        self.clue_revealed = False
        self.score_awarded = False
        self.status = GameStatus.IN_PROGRESS

    @property
    def required_letters(self) -> Set[str]:
        """Set of unique alphabetic characters required to win the round."""
        return {ch for ch in self._secret_word if "A" <= ch <= "Z"}

    @property
    def is_over(self) -> bool:
        """True if the round has concluded (won, lost, or resigned)."""
        return self.status in (GameStatus.WON, GameStatus.LOST, GameStatus.RESIGNED)

    def get_masked_characters(self) -> List[str]:
        """
        Returns a list of display tokens for each character in the secret word:
        - Guessed letters are returned as uppercase characters
        - Unguessed letters are returned as '_'
        - Spaces and hyphens are always returned as-is
        """
        tokens: List[str] = []
        for ch in self._secret_word:
            if ch in (" ", "-"):
                tokens.append(ch)
            elif ch in self.correct_letters:
                tokens.append(ch)
            else:
                tokens.append("_")
        return tokens

    def get_masked_word_string(self) -> str:
        """Returns a human-readable spaced representation of the hidden word."""
        return " ".join(self.get_masked_characters())

    def reveal_clue(self) -> str:
        """Marks the clue as revealed and returns the clue text (or category fallback)."""
        self.clue_revealed = True
        if self.clue:
            return self.clue
        return f"Category: {self.category}"

    def guess_letter(self, letter: str) -> GuessResult:
        """
        Processes a single-letter guess.
        Rejects guesses when the round is not in progress, when input is not a single A-Z
        letter, or when the letter has already been guessed.
        """
        if self.status != GameStatus.IN_PROGRESS:
            return GuessResult(
                accepted=False,
                correct=False,
                letter=letter,
                message="Cannot guess when the round is not in progress.",
                status=self.status,
                remaining_lives=self.remaining_lives,
            )

        cleaned = letter.strip().upper()
        if len(cleaned) != 1 or not ("A" <= cleaned <= "Z"):
            return GuessResult(
                accepted=False,
                correct=False,
                letter=cleaned,
                message="Please enter a single letter from A to Z.",
                status=self.status,
                remaining_lives=self.remaining_lives,
            )

        if cleaned in self.guessed_letters:
            return GuessResult(
                accepted=False,
                correct=False,
                letter=cleaned,
                message=f"Letter '{cleaned}' has already been guessed.",
                status=self.status,
                remaining_lives=self.remaining_lives,
            )

        self.guessed_letters.append(cleaned)

        if cleaned in self.required_letters:
            self.correct_letters.add(cleaned)
            if self.required_letters.issubset(self.correct_letters):
                self.status = GameStatus.WON
                return GuessResult(
                    accepted=True,
                    correct=True,
                    letter=cleaned,
                    message="You guessed the word!",
                    status=self.status,
                    remaining_lives=self.remaining_lives,
                )
            return GuessResult(
                accepted=True,
                correct=True,
                letter=cleaned,
                message=f"Good guess! '{cleaned}' is in the word.",
                status=self.status,
                remaining_lives=self.remaining_lives,
            )

        self.incorrect_letters.add(cleaned)
        self.remaining_lives = max(0, self.remaining_lives - 1)
        if self.remaining_lives == 0:
            self.status = GameStatus.LOST
            return GuessResult(
                accepted=True,
                correct=False,
                letter=cleaned,
                message=f"No lives left! The word was {self._secret_word}.",
                status=self.status,
                remaining_lives=self.remaining_lives,
            )

        return GuessResult(
            accepted=True,
            correct=False,
            letter=cleaned,
            message=f"'{cleaned}' is not in the word.",
            status=self.status,
            remaining_lives=self.remaining_lives,
        )

    def solve_word(self, candidate: str) -> GuessResult:
        """
        Validates a full-word guess ('Solve the word' action).
        - If exact match: reveals all letters and marks the round as WON.
        - If wrong: deducts 1 life (and marks LOST if remaining_lives hits 0).
        """
        if self.status != GameStatus.IN_PROGRESS:
            return GuessResult(
                accepted=False,
                correct=False,
                letter="",
                message="Cannot solve when the round is not in progress.",
                status=self.status,
                remaining_lives=self.remaining_lives,
            )

        normalized = " ".join(candidate.strip().upper().split())
        if not normalized:
            return GuessResult(
                accepted=False,
                correct=False,
                letter="",
                message="Please enter a complete word to solve.",
                status=self.status,
                remaining_lives=self.remaining_lives,
            )

        if normalized == self._secret_word:
            self.correct_letters.update(self.required_letters)
            for ch in sorted(self.required_letters):
                if ch not in self.guessed_letters:
                    self.guessed_letters.append(ch)
            self.status = GameStatus.WON
            return GuessResult(
                accepted=True,
                correct=True,
                letter=normalized,
                message="Brilliant! You solved the word!",
                status=self.status,
                remaining_lives=self.remaining_lives,
            )

        self.remaining_lives = max(0, self.remaining_lives - 1)
        if self.remaining_lives == 0:
            self.status = GameStatus.LOST
            return GuessResult(
                accepted=True,
                correct=False,
                letter=normalized,
                message=f"Incorrect solve! No lives left. The word was {self._secret_word}.",
                status=self.status,
                remaining_lives=self.remaining_lives,
            )

        return GuessResult(
            accepted=True,
            correct=False,
            letter=normalized,
            message=f"'{normalized}' is not the secret word (-1 life).",
            status=self.status,
            remaining_lives=self.remaining_lives,
        )

    def resign(self) -> None:
        """Forfeits the active round immediately."""
        if self.status in (GameStatus.IN_PROGRESS, GameStatus.WAITING_FOR_WORD):
            self.remaining_lives = 0
            self.status = GameStatus.RESIGNED

    def to_public_dict(self, reveal_secret: bool = False) -> Dict[str, object]:
        """
        Serializes round state safely for network transmission.
        IMPORTANT SECURITY RULE: Only includes `secret_word` if `reveal_secret` is True
        or the round has ended (WON, LOST, RESIGNED).
        """
        should_reveal = reveal_secret or self.is_over
        return {
            "status": self.status.value,
            "masked_characters": self.get_masked_characters(),
            "guessed_letters": list(self.guessed_letters),
            "correct_letters": sorted(self.correct_letters),
            "incorrect_letters": sorted(self.incorrect_letters),
            "remaining_lives": self.remaining_lives,
            "max_lives": self.max_lives,
            "category": self.category,
            "difficulty": self.difficulty,
            "has_clue": bool(self.clue),
            "clue": self.clue if (self.clue_revealed or should_reveal) else "",
            "clue_revealed": self.clue_revealed,
            "secret_word": self._secret_word if should_reveal else None,
            "word_length": len(self._secret_word),
        }
