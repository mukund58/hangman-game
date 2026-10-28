"""
Automated unit tests for `game.scoring`.
Tests:
- Base points (100) + life bonus (20 * remaining_lives)
- Zero points on loss or resignation
- Scoring strictly once per completed round
- Score consistency across multiple rounds and persistence to JSON/SQLite
"""

from __future__ import annotations

from pathlib import Path

from game.logic import HangmanGame
from game.scoring import ScoringEngine


def test_winning_round_awards_base_plus_life_bonus() -> None:
    game = HangmanGame(secret_word="CAT")
    # 1 wrong guess -> 5 lives remaining -> 100 + 5 * 20 = 200 points
    game.guess_letter("Z")
    for ch in ["C", "A", "T"]:
        game.guess_letter(ch)

    engine = ScoringEngine()
    points = engine.record_round_result(game, "Player 1")
    assert points == 200
    assert engine.register_player("Player 1").score == 200
    assert engine.register_player("Player 1").rounds_won == 1
    assert engine.register_player("Player 1").streak == 1


def test_scoring_only_once_per_completed_round() -> None:
    game = HangmanGame(secret_word="DOG")
    for ch in ["D", "O", "G"]:
        game.guess_letter(ch)

    engine = ScoringEngine()
    first_award = engine.record_round_result(game, "Player 1")
    assert first_award == 220  # 100 + 6 * 20

    # Calling record_round_result a second time on the same completed round must award 0
    second_award = engine.record_round_result(game, "Player 1")
    assert second_award == 0
    assert engine.register_player("Player 1").score == 220
    assert engine.register_player("Player 1").rounds_won == 1


def test_loss_resets_streak_and_awards_zero_points() -> None:
    engine = ScoringEngine()

    round1 = HangmanGame(secret_word="SUN")
    for ch in ["S", "U", "N"]:
        round1.guess_letter(ch)
    engine.record_round_result(round1, "Sunny Marmot")
    assert engine.register_player("Sunny Marmot").streak == 1

    round2 = HangmanGame(secret_word="SUN")
    for ch in ["A", "B", "C", "D", "E", "F"]:
        round2.guess_letter(ch)
    pts = engine.record_round_result(round2, "Sunny Marmot")
    assert pts == 0
    assert engine.register_player("Sunny Marmot").streak == 0
    assert engine.register_player("Sunny Marmot").score == 220


def test_json_and_sqlite_score_persistence(tmp_path: Path) -> None:
    json_file = tmp_path / "scores.json"
    db_file = tmp_path / "scores.db"
    engine = ScoringEngine(json_path=json_file, sqlite_path=db_file)

    game = HangmanGame(secret_word="OWL")
    for ch in ["O", "W", "L"]:
        game.guess_letter(ch)
    engine.record_round_result(game, "Alice")

    assert json_file.exists()
    assert db_file.exists()

    reloaded = ScoringEngine(json_path=json_file)
    reloaded.load_from_json()
    assert reloaded.register_player("Alice").score == 220
