"""
Wire protocol definitions and message validation helpers for Hangman online multiplayer.
"""

from __future__ import annotations

from enum import Enum
import json
from typing import Any, Dict, Tuple


class ClientMessageType(str, Enum):
    """Supported message types sent from client to server."""

    CREATE_ROOM = "create_room"
    JOIN_ROOM = "join_room"
    RECONNECT_ROOM = "reconnect_room"
    LEAVE_ROOM = "leave_room"
    SET_WORD = "set_word"
    GUESS_LETTER = "guess_letter"
    SOLVE_WORD = "solve_word"
    REVEAL_CLUE = "reveal_clue"
    RESIGN_ROUND = "resign_round"
    NEXT_ROUND = "next_round"
    NEW_MATCH = "new_match"
    CHAT_MESSAGE = "chat_message"


class ServerMessageType(str, Enum):
    """Supported message types broadcast or sent from server to clients."""

    ROOM_CREATED = "room_created"
    ROOM_JOINED = "room_joined"
    STATE_UPDATE = "state_update"
    CHAT_BROADCAST = "chat_broadcast"
    ERROR = "error"
    LEFT_ROOM = "left_room"


VALID_CLIENT_TYPES = {item.value for item in ClientMessageType}


def parse_json_message(raw_message: str) -> Tuple[bool, Dict[str, Any], str]:
    """
    Safely parses and validates an incoming WebSocket JSON message.
    Returns (is_valid, payload_dict, error_message).
    """
    if not isinstance(raw_message, str) or not raw_message.strip():
        return False, {}, "Empty message payload."

    try:
        data = json.loads(raw_message)
    except json.JSONDecodeError:
        return False, {}, "Malformed JSON message."

    if not isinstance(data, dict):
        return False, {}, "JSON message root must be an object."

    msg_type = data.get("type")
    if not isinstance(msg_type, str) or msg_type not in VALID_CLIENT_TYPES:
        return False, {}, f"Unsupported or missing message type: {msg_type!r}"

    return True, data, ""
