"""
Automated unit tests for `networking.server` and `networking.protocol`.
Tests:
- Room capacity (max 2 players)
- Invalid room codes
- Unauthorized player actions (wrong role or non-member)
- Secret-word privacy (guesser never receives secret_word until round ends)
- Isolation between multiplayer rooms
"""

from __future__ import annotations

import pytest

from networking.protocol import parse_json_message
from networking.server import RoomManager


def test_room_capacity_and_invalid_room_codes() -> None:
    manager = RoomManager()
    room = manager.create_room(player_id="host-1", player_name="Alice")
    code = room.room_code

    # Invalid room code raises ValueError
    with pytest.raises(ValueError, match="does not exist"):
        manager.join_room("INVALID99", player_id="guest-1", player_name="Bob")

    # Second player joins successfully
    manager.join_room(code, player_id="guest-1", player_name="Bob")
    assert room.is_full is True

    # Third distinct player is rejected because room capacity is 2
    with pytest.raises(ValueError, match="already full"):
        manager.join_room(code, player_id="intruder-3", player_name="Mallory")

    # Existing player reconnecting is allowed
    rejoined = manager.join_room(code, player_id="guest-1", player_name="Bob")
    assert rejoined.room_code == code


def test_secret_word_privacy_until_round_ends() -> None:
    manager = RoomManager()
    room = manager.create_room(player_id="host-1", player_name="Alice")
    manager.join_room(room.room_code, player_id="guest-2", player_name="Bob")

    manager.set_word(room.room_code, player_id="host-1", word="HANGAR", clue="Aircraft shed")

    # Setter (slot 1) can see the secret word
    setter_view = room.build_personalized_state(viewer_slot=1)
    assert setter_view["game"]["secret_word"] == "HANGAR"

    # Guesser (slot 2) MUST NOT receive the secret word while the round is in progress
    guesser_view = room.build_personalized_state(viewer_slot=2)
    assert guesser_view["game"]["secret_word"] is None
    assert guesser_view["game"]["masked_characters"] == ["_", "_", "_", "_", "_", "_"]

    # Once the round ends, guesser receives the revealed secret word
    for ch in ["H", "A", "N", "G", "R"]:
        manager.guess_letter(room.room_code, player_id="guest-2", letter=ch)

    guesser_end_view = room.build_personalized_state(viewer_slot=2)
    assert guesser_end_view["game"]["status"] == "WON"
    assert guesser_end_view["game"]["secret_word"] == "HANGAR"


def test_unauthorized_player_actions_rejected() -> None:
    manager = RoomManager()
    room = manager.create_room(player_id="host-1", player_name="Alice")
    manager.join_room(room.room_code, player_id="guest-2", player_name="Bob")

    # Guesser cannot set the secret word during Setter's turn
    with pytest.raises(PermissionError, match="Only the word setter"):
        manager.set_word(room.room_code, player_id="guest-2", word="TIGER")

    manager.set_word(room.room_code, player_id="host-1", word="TIGER")

    # Setter cannot guess letters on their own word
    with pytest.raises(PermissionError, match="Only the guessing player"):
        manager.guess_letter(room.room_code, player_id="host-1", letter="T")


def test_strict_isolation_between_multiplayer_rooms() -> None:
    manager = RoomManager()
    room_a = manager.create_room(player_id="p-a1", player_name="Alice")
    manager.join_room(room_a.room_code, player_id="p-a2", player_name="Bob")
    manager.set_word(room_a.room_code, player_id="p-a1", word="PLANET")

    room_b = manager.create_room(player_id="p-b1", player_name="Charlie")
    manager.join_room(room_b.room_code, player_id="p-b2", player_name="Dana")
    manager.set_word(room_b.room_code, player_id="p-b1", word="ROCKET")

    # Player in Room B cannot guess or post chat in Room A
    with pytest.raises(PermissionError, match="not authorized"):
        manager.guess_letter(room_a.room_code, player_id="p-b2", letter="P")

    with pytest.raises(PermissionError, match="not authorized"):
        manager.post_chat(room_a.room_code, player_id="p-b1", text="Hello!")

    # Guessing in Room A does not mutate Room B
    manager.guess_letter(room_a.room_code, player_id="p-a2", letter="P")
    assert "P" in room_a.game.guessed_letters
    assert "P" not in room_b.game.guessed_letters


def test_malformed_json_protocol_handling() -> None:
    ok, _, err = parse_json_message("not-json")
    assert ok is False
    assert "Malformed JSON" in err

    ok2, _, err2 = parse_json_message('{"type": "hack_score"}')
    assert ok2 is False
    assert "Unsupported" in err2
