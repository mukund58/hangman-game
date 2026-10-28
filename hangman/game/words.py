"""
Word database management and difficulty classification for Hangman.

Difficulty Classification Rules:
- Easy: Short, familiar words (typically 5 letters) with common vowels and high frequency.
- Medium: Moderate length (6–7 letters) with distinct syllables or common clusters.
- Hard: Longer words (8–13 letters) or multi-word / compound concepts.
- Fiendish: Words with rare consonants (J, Q, X, Z, K, V, Y), low vowel ratios
  (e.g., RHYTHM, FJORD), or tricky spelling patterns (e.g., VICHYSSOISE, AXOLOTL).
"""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import random
from typing import Iterable, List, Optional


CATEGORIES: List[str] = [
    "Any category",
    "Animals",
    "Food & drink",
    "Geography",
    "Sport",
    "Jobs",
    "Nature",
    "Objects",
    "The body",
    "Music",
    "Transport",
    "Clothes",
    "School",
]

DIFFICULTIES: List[str] = [
    "Easy",
    "Medium",
    "Hard",
    "Fiendish",
]

RARE_CONSONANTS = set("JQXZKVWY")
VOWELS = set("AEIOU")


@dataclass(frozen=True)
class WordEntry:
    """Represents a single categorized word entry with its clue and difficulty."""

    word: str
    clue: str
    category: str
    difficulty: str

    def __post_init__(self) -> None:
        object.__setattr__(self, "word", self.word.strip().upper())


def classify_word_difficulty(word: str) -> str:
    """
    Classifies an arbitrary word into Easy, Medium, Hard, or Fiendish
    based on letter count, vowel ratio, and rare consonant presence.
    """
    cleaned = [ch for ch in word.upper() if ch.isalpha()]
    if not cleaned:
        return "Easy"

    length = len(cleaned)
    vowel_count = sum(1 for ch in cleaned if ch in VOWELS)
    vowel_ratio = vowel_count / length
    rare_count = sum(1 for ch in set(cleaned) if ch in RARE_CONSONANTS)

    if vowel_ratio < 0.22 or rare_count >= 2:
        return "Fiendish"
    if length <= 5 and rare_count == 0:
        return "Easy"
    if length <= 7 and rare_count <= 1:
        return "Medium"
    if length <= 10:
        return "Hard"
    return "Fiendish"


class WordDatabase:
    """Loads, validates, filters, and selects words from data/words.json."""

    def __init__(self, json_path: Optional[Path] = None) -> None:
        if json_path is None:
            json_path = Path(__file__).resolve().parent.parent / "data" / "words.json"
        self.json_path = json_path
        self._entries: List[WordEntry] = []
        self._load()

    def _load(self) -> None:
        if not self.json_path.exists():
            raise FileNotFoundError(f"Word database file not found at {self.json_path}")

        raw_data = json.loads(self.json_path.read_text(encoding="utf-8"))
        seen_words = set()
        entries: List[WordEntry] = []

        for item in raw_data:
            word_upper = str(item["word"]).strip().upper()
            if not word_upper or word_upper in seen_words:
                continue
            seen_words.add(word_upper)
            entries.append(
                WordEntry(
                    word=word_upper,
                    clue=str(item["clue"]).strip(),
                    category=str(item["category"]).strip(),
                    difficulty=str(item["difficulty"]).strip(),
                )
            )

        self._entries = entries

    @property
    def entries(self) -> List[WordEntry]:
        """Returns a copy of all loaded word entries."""
        return list(self._entries)

    def filter_words(
        self,
        category: str = "Any category",
        difficulty: Optional[str] = None,
        exclude_words: Optional[Iterable[str]] = None,
    ) -> List[WordEntry]:
        """Filters words by category and difficulty, optionally excluding already used words."""
        excluded = {w.strip().upper() for w in (exclude_words or [])}
        results: List[WordEntry] = []

        for entry in self._entries:
            if entry.word in excluded:
                continue
            if category and category != "Any category" and entry.category != category:
                continue
            if difficulty and difficulty != "Any" and entry.difficulty != difficulty:
                continue
            results.append(entry)

        return results

    def suggest_word(
        self,
        category: str = "Any category",
        difficulty: Optional[str] = "Medium",
        exclude_words: Optional[Iterable[str]] = None,
    ) -> WordEntry:
        """
        Selects a random appropriate word matching the requested category and difficulty.
        Falls back gracefully if all words in a narrow filter have been exhausted.
        """
        candidates = self.filter_words(category, difficulty, exclude_words)
        if not candidates and exclude_words:
            candidates = self.filter_words(category, difficulty, exclude_words=None)
        if not candidates:
            candidates = self.filter_words(category="Any category", difficulty=difficulty)
        if not candidates:
            candidates = self._entries
        return random.choice(candidates)
