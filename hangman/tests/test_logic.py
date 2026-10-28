"""
Automated unit tests for `game.logic` and `game.words`.
Tests:
- Correct guesses
- Incorrect guesses
- Duplicate guesses
- Invalid input
- Win detection
- Loss detection
- Attempts never becoming negative
- No guesses after the game ends
- Handling spaces and hyphens in secret words
- Word database uniqueness and filtering
"""

from __future__ import annotations

import pytest

from game.logic import GameStatus, HangmanGame
from game.words import WordDatabase, classify_word_difficulty


def test_correct_guess_reveals_letters_and_preserves_lives() -> None:
    game = HangmanGame(secret_word="BANANA", clue="Yellow fruit")
    res = game.guess_letter("a")
    assert res.accepted is True
    assert res.correct is True
    assert game.remaining_lives == 6
    assert game.get_masked_characters() == ["_", "A", "_", "A", "_", "A"]
    assert game.status == GameStatus.IN_PROGRESS


def test_incorrect_guess_decrements_lives() -> None:
    game = HangmanGame(secret_word="TIGER")
    res = game.guess_letter("Z")
    assert res.accepted is True
    assert res.correct is False
    assert game.remaining_lives == 5
    assert "Z" in game.incorrect_letters
    assert game.status == GameStatus.IN_PROGRESS


def test_duplicate_guess_is_rejected_without_penalty() -> None:
    game = HangmanGame(secret_word="TIGER")
    first = game.guess_letter("X")
    assert first.accepted is True
    assert game.remaining_lives == 5

    duplicate_wrong = game.guess_letter("x")
    assert duplicate_wrong.accepted is False
    assert game.remaining_lives == 5

    first_right = game.guess_letter("T")
    assert first_right.accepted is True
    duplicate_right = game.guess_letter("t")
    assert duplicate_right.accepted is False
    assert game.remaining_lives == 5


@pytest.mark.parametrize("bad_input", ["", " ", "AB", "1", "!", "@"])
def test_invalid_guess_input_rejected(bad_input: str) -> None:
    game = HangmanGame(secret_word="APPLE")
    res = game.guess_letter(bad_input)
    assert res.accepted is False
    assert game.remaining_lives == 6
    assert len(game.guessed_letters) == 0


def test_win_detection_when_all_unique_letters_guessed() -> None:
    game = HangmanGame(secret_word="KOALA")
    for ch in ["K", "O", "A"]:
        res = game.guess_letter(ch)
        assert res.accepted is True
        assert game.status == GameStatus.IN_PROGRESS

    final = game.guess_letter("L")
    assert final.accepted is True
    assert final.correct is True
    assert game.status == GameStatus.WON
    assert game.is_over is True
    assert "".join(game.get_masked_characters()) == "KOALA"


def test_loss_detection_and_attempts_never_negative() -> None:
    game = HangmanGame(secret_word="APPLE")
    wrong_letters = ["Z", "X", "Q", "J", "K", "V"]
    for idx, ch in enumerate(wrong_letters, start=1):
        res = game.guess_letter(ch)
        assert res.accepted is True
        assert res.correct is False
        assert game.remaining_lives == 6 - idx

    assert game.remaining_lives == 0
    assert game.status == GameStatus.LOST

    # Attempting additional guesses after loss must be rejected and never make lives negative
    after_loss = game.guess_letter("M")
    assert after_loss.accepted is False
    assert game.remaining_lives == 0
    assert game.remaining_lives >= 0


def test_no_guesses_allowed_after_win_or_resign() -> None:
    game = HangmanGame(secret_word="CAT")
    for ch in ["C", "A", "T"]:
        game.guess_letter(ch)
    assert game.status == GameStatus.WON

    post_win = game.guess_letter("B")
    assert post_win.accepted is False
    assert "B" not in game.guessed_letters

    game2 = HangmanGame(secret_word="DOG")
    game2.resign()
    assert game2.status == GameStatus.RESIGNED
    post_resign = game2.guess_letter("D")
    assert post_resign.accepted is False


def test_spaces_and_hyphens_auto_revealed() -> None:
    game = HangmanGame(secret_word="KOMODO DRAGON")
    masked = game.get_masked_characters()
    assert masked[6] == " "

    hyphen_game = HangmanGame(secret_word="JIU-JITSU")
    assert hyphen_game.get_masked_characters()[3] == "-"
    for ch in ["J", "I", "U", "T", "S"]:
        hyphen_game.guess_letter(ch)
    assert hyphen_game.status == GameStatus.WON


def test_full_word_solve_action() -> None:
    game = HangmanGame(secret_word="HANGAR")
    wrong_solve = game.solve_word("GARAGE")
    assert wrong_solve.accepted is True
    assert wrong_solve.correct is False
    assert game.remaining_lives == 5

    right_solve = game.solve_word("hangar")
    assert right_solve.accepted is True
    assert right_solve.correct is True
    assert game.status == GameStatus.WON


def test_word_database_has_no_duplicates_and_supports_suggestions() -> None:
    db = WordDatabase()
    words = [entry.word for entry in db.entries]
    assert len(words) >= 100
    assert len(words) == len(set(words)), "Word database must not contain duplicate words."

    sample = db.suggest_word(category="Animals", difficulty="Easy")
    assert sample.category == "Animals"
    assert sample.difficulty == "Easy"
    assert classify_word_difficulty("RHYTHM") == "Fiendish"
