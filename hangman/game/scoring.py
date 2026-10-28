"""
Scoring system and persistent leaderboard storage (JSON and SQLite) for Hangman.

Scoring Rule:
- Base points for winning a round: 100 points
- Bonus per remaining life: 20 points * remaining_lives (up to +120 for 6 lives)
- Losing or resigning a round awards 0 points to the guesser.
- Points are awarded strictly once per completed round via `game.score_awarded`.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
import json
from pathlib import Path
import sqlite3
from typing import Dict, List, Optional

from .logic import GameStatus, HangmanGame


BASE_WIN_POINTS = 100
LIFE_BONUS_POINTS = 20


@dataclass
class PlayerScore:
    """Tracks a player's cumulative score, rounds won, and current streak."""

    name: str
    score: int = 0
    rounds_won: int = 0
    rounds_played: int = 0
    streak: int = 0


class ScoringEngine:
    """
    Calculates round points and prevents duplicate score awards for the same round.
    Optionally persists match scores to JSON or SQLite.
    """

    def __init__(
        self,
        json_path: Optional[Path] = None,
        sqlite_path: Optional[Path] = None,
    ) -> None:
        self.players: Dict[str, PlayerScore] = {}
        self.json_path = json_path
        self.sqlite_path = sqlite_path
        if self.sqlite_path is not None:
            self._init_sqlite()

    def _init_sqlite(self) -> None:
        assert self.sqlite_path is not None
        self.sqlite_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.sqlite_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS player_scores (
                    name TEXT PRIMARY KEY,
                    score INTEGER NOT NULL,
                    rounds_won INTEGER NOT NULL,
                    rounds_played INTEGER NOT NULL,
                    streak INTEGER NOT NULL
                )
                """
            )
            conn.commit()

    def register_player(self, name: str) -> PlayerScore:
        """Ensures a player exists in the scoring table."""
        if name not in self.players:
            self.players[name] = PlayerScore(name=name)
        return self.players[name]

    @staticmethod
    def calculate_round_points(game: HangmanGame) -> int:
        """
        Computes points earned for the given HangmanGame state:
        100 base points + 20 * remaining_lives when WON; 0 otherwise.
        """
        if game.status != GameStatus.WON:
            return 0
        return BASE_WIN_POINTS + (max(0, game.remaining_lives) * LIFE_BONUS_POINTS)

    def record_round_result(self, game: HangmanGame, guesser_name: str) -> int:
        """
        Awards points for a completed round to `guesser_name` strictly once.
        Returns the points awarded (0 if already scored or round not won).
        """
        if not game.is_over:
            return 0
        if game.score_awarded:
            return 0

        player = self.register_player(guesser_name)
        points = self.calculate_round_points(game)
        game.score_awarded = True
        player.rounds_played += 1

        if game.status == GameStatus.WON:
            player.score += points
            player.rounds_won += 1
            player.streak += 1
        else:
            player.streak = 0

        self._persist()
        return points

    def reset_match_scores(self) -> None:
        """Resets all registered players' match scores and streaks to zero."""
        for player in self.players.values():
            player.score = 0
            player.rounds_won = 0
            player.rounds_played = 0
            player.streak = 0
        self._persist()

    def _persist(self) -> None:
        if self.json_path is not None:
            self.json_path.parent.mkdir(parents=True, exist_ok=True)
            payload = {name: asdict(score) for name, score in self.players.items()}
            self.json_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

        if self.sqlite_path is not None:
            with sqlite3.connect(self.sqlite_path) as conn:
                for p in self.players.values():
                    conn.execute(
                        """
                        INSERT INTO player_scores (name, score, rounds_won, rounds_played, streak)
                        VALUES (?, ?, ?, ?, ?)
                        ON CONFLICT(name) DO UPDATE SET
                            score = excluded.score,
                            rounds_won = excluded.rounds_won,
                            rounds_played = excluded.rounds_played,
                            streak = excluded.streak
                        """,
                        (p.name, p.score, p.rounds_won, p.rounds_played, p.streak),
                    )
                conn.commit()

    def load_from_json(self) -> List[PlayerScore]:
        """Loads persisted player scores from JSON if available."""
        if self.json_path is None or not self.json_path.exists():
            return []
        raw = json.loads(self.json_path.read_text(encoding="utf-8"))
        for name, data in raw.items():
            self.players[name] = PlayerScore(**data)
        return list(self.players.values())
