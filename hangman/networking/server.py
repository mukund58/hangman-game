"""
Authoritative WebSocket server and room state manager for Hangman online multiplayer.

Security & Integrity Guarantees:
1. Server is authoritative for all online game state and scores.
2. Secret word is NEVER transmitted to the guessing player's client until the round ends.
3. Server validates room capacity (max 2 players), room membership, and role permissions
   (only the active setter may lock in a word; only the active guesser may submit guesses).
4. Rooms are strictly isolated; a connection bound to Room A cannot read or mutate Room B.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
import json
import os
import secrets
import string
import time
from typing import Any, Dict, List, Optional

from game.logic import GameStatus, HangmanGame
from game.scoring import ScoringEngine
from networking.protocol import ClientMessageType, ServerMessageType, parse_json_message


ROOM_CODE_ALPHABET = string.ascii_letters + string.digits
MAX_PLAYERS_PER_ROOM = 2
MAX_CHAT_HISTORY = 50


def generate_room_code(length: int = 8) -> str:
    """Generates a cryptographically random alphanumeric room code."""
    return "".join(secrets.choice(ROOM_CODE_ALPHABET) for _ in range(length))


@dataclass
class ConnectedPlayer:
    """Represents a player slot inside a multiplayer room."""

    player_id: str
    slot: int  # 1 for Host (Player 1), 2 for Guest (Player 2)
    name: str
    connected: bool = True
    websocket: Optional[Any] = None


@dataclass
class ChatMessage:
    """Represents a validated chat message in a multiplayer room."""

    sender_slot: int
    sender_name: str
    text: str
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sender_slot": self.sender_slot,
            "sender_name": self.sender_name,
            "text": self.text,
            "timestamp": self.timestamp,
        }


class MultiplayerRoom:
    """
    Encapsulates an authoritative two-player Hangman match in a single room.
    """

    def __init__(self, room_code: str, host_id: str, host_name: str = "Sunny Marmot") -> None:
        self.room_code: str = room_code
        self.players: Dict[int, ConnectedPlayer] = {
            1: ConnectedPlayer(player_id=host_id, slot=1, name=host_name, connected=True)
        }
        self.round_number: int = 1
        self.max_rounds: int = 4
        self.setter_slot: int = 1
        self.guesser_slot: int = 2
        self.game: HangmanGame = HangmanGame()
        self.scoring: ScoringEngine = ScoringEngine()
        self.scoring.register_player("p1")
        self.scoring.register_player("p2")
        self.chat_history: List[ChatMessage] = []
        self.last_message: str = "Think of a word and lock it in."

    def get_slot_by_player_id(self, player_id: str) -> Optional[int]:
        """Returns 1 or 2 if `player_id` belongs to this room, else None."""
        for slot, player in self.players.items():
            if player.player_id == player_id:
                return slot
        return None

    @property
    def is_full(self) -> bool:
        """True if two distinct players have joined the room."""
        return len(self.players) >= MAX_PLAYERS_PER_ROOM

    def build_personalized_state(self, viewer_slot: int) -> Dict[str, Any]:
        """
        Builds a state snapshot tailored to `viewer_slot`.
        CRITICAL SECURITY RULE: The secret word is revealed ONLY if:
        - `viewer_slot == self.setter_slot`, OR
        - the round has ended (`self.game.is_over`).
        """
        reveal_secret = (viewer_slot == self.setter_slot) or self.game.is_over
        game_dict = self.game.to_public_dict(reveal_secret=reveal_secret)

        p1 = self.players.get(1)
        p2 = self.players.get(2)
        p1_score = self.scoring.register_player("p1").score
        p2_score = self.scoring.register_player("p2").score

        return {
            "type": ServerMessageType.STATE_UPDATE.value,
            "room_code": self.room_code,
            "viewer_slot": viewer_slot,
            "round_number": self.round_number,
            "max_rounds": self.max_rounds,
            "setter_slot": self.setter_slot,
            "guesser_slot": self.guesser_slot,
            "last_message": self.last_message,
            "players": {
                "1": {
                    "slot": 1,
                    "name": p1.name if p1 else "Player 1",
                    "connected": p1.connected if p1 else False,
                    "score": p1_score,
                },
                "2": {
                    "slot": 2,
                    "name": p2.name if p2 else "Waiting for friend...",
                    "connected": p2.connected if p2 else False,
                    "score": p2_score,
                },
            },
            "game": game_dict,
            "chat": [msg.to_dict() for msg in self.chat_history],
        }


class RoomManager:
    """
    Authoritative registry and action dispatcher for all active multiplayer rooms.
    Can be exercised directly in unit tests without opening network sockets.
    """

    def __init__(self) -> None:
        self.rooms: Dict[str, MultiplayerRoom] = {}
        self.player_to_room: Dict[str, str] = {}

    def create_room(self, player_id: str, player_name: str = "Sunny Marmot") -> MultiplayerRoom:
        """Creates a new isolated room with a unique room code."""
        while True:
            code = generate_room_code(8)
            if code not in self.rooms:
                break

        room = MultiplayerRoom(room_code=code, host_id=player_id, host_name=player_name)
        self.rooms[code] = room
        self.player_to_room[player_id] = code
        return room

    def join_room(
        self,
        room_code: str,
        player_id: str,
        player_name: str = "Opponent",
    ) -> MultiplayerRoom:
        """
        Adds a second player (or reconnects an existing player) to `room_code`.
        Raises ValueError if the room does not exist or is already full.
        """
        normalized_code = room_code.strip()
        room = self.rooms.get(normalized_code)
        if room is None:
            raise ValueError(f"Room '{normalized_code}' does not exist.")

        existing_slot = room.get_slot_by_player_id(player_id)
        if existing_slot is not None:
            room.players[existing_slot].connected = True
            self.player_to_room[player_id] = normalized_code
            return room

        if room.is_full:
            raise ValueError(f"Room '{normalized_code}' is already full (2/2 players).")

        room.players[2] = ConnectedPlayer(
            player_id=player_id,
            slot=2,
            name=player_name or "Opponent",
            connected=True,
        )
        self.player_to_room[player_id] = normalized_code
        return room

    def _verify_access(self, room_code: str, player_id: str) -> Tuple[MultiplayerRoom, int]:
        """
        Verifies that `room_code` exists and `player_id` is a registered member of that room.
        Prevents cross-room state access or unauthorized actions.
        """
        room = self.rooms.get(room_code)
        if room is None:
            raise PermissionError("Room does not exist.")

        bound_room = self.player_to_room.get(player_id)
        slot = room.get_slot_by_player_id(player_id)
        if bound_room != room_code or slot is None:
            raise PermissionError("Player is not authorized for this room.")

        return room, slot

    def set_word(
        self,
        room_code: str,
        player_id: str,
        word: str,
        clue: str = "",
        category: str = "Any category",
        difficulty: str = "Medium",
    ) -> MultiplayerRoom:
        """Locks in the secret word if `player_id` is the designated word setter."""
        room, slot = self._verify_access(room_code, player_id)
        if slot != room.setter_slot:
            raise PermissionError("Only the word setter can lock in the secret word.")
        if room.game.status != GameStatus.WAITING_FOR_WORD:
            raise ValueError("A secret word is already active for this round.")

        room.game.set_secret_word(word, clue=clue, category=category, difficulty=difficulty)
        room.last_message = "Guess the word"
        return room

    def guess_letter(self, room_code: str, player_id: str, letter: str) -> MultiplayerRoom:
        """Processes a letter guess from the designated guesser."""
        room, slot = self._verify_access(room_code, player_id)
        if slot != room.guesser_slot:
            raise PermissionError("Only the guessing player may guess letters.")
        if not room.is_full:
            raise ValueError("Waiting for your opponent to join before guessing.")

        result = room.game.guess_letter(letter)
        if not result.accepted:
            raise ValueError(result.message)

        room.last_message = result.message
        if room.game.is_over:
            guesser_key = f"p{room.guesser_slot}"
            room.scoring.record_round_result(room.game, guesser_key)
        return room

    def solve_word(self, room_code: str, player_id: str, candidate: str) -> MultiplayerRoom:
        """Processes a full-word solve attempt from the designated guesser."""
        room, slot = self._verify_access(room_code, player_id)
        if slot != room.guesser_slot:
            raise PermissionError("Only the guessing player may solve the word.")
        if not room.is_full:
            raise ValueError("Waiting for your opponent to join before solving.")

        result = room.game.solve_word(candidate)
        if not result.accepted:
            raise ValueError(result.message)

        room.last_message = result.message
        if room.game.is_over:
            guesser_key = f"p{room.guesser_slot}"
            room.scoring.record_round_result(room.game, guesser_key)
        return room

    def reveal_clue(self, room_code: str, player_id: str) -> MultiplayerRoom:
        """Reveals the clue badge for the active round."""
        room, _ = self._verify_access(room_code, player_id)
        room.game.reveal_clue()
        return room

    def resign_round(self, room_code: str, player_id: str) -> MultiplayerRoom:
        """Allows the active player to resign the current round."""
        room, _ = self._verify_access(room_code, player_id)
        room.game.resign()
        guesser_key = f"p{room.guesser_slot}"
        room.scoring.record_round_result(room.game, guesser_key)
        room.last_message = "Round resigned."
        return room

    def next_round(self, room_code: str, player_id: str) -> MultiplayerRoom:
        """Swaps setter and guesser roles and starts the next round in the same room."""
        room, _ = self._verify_access(room_code, player_id)
        if not room.game.is_over:
            raise ValueError("Cannot advance to the next round before the current round ends.")

        room.round_number = (room.round_number % room.max_rounds) + 1
        room.setter_slot, room.guesser_slot = room.guesser_slot, room.setter_slot
        room.game = HangmanGame()
        room.last_message = "Think of a word and lock it in."
        return room

    def new_match(self, room_code: str, player_id: str) -> MultiplayerRoom:
        """Resets scores and restarts a 4-round match in the same room."""
        room, _ = self._verify_access(room_code, player_id)
        room.round_number = 1
        room.setter_slot = 1
        room.guesser_slot = 2
        room.scoring.reset_match_scores()
        room.game = HangmanGame()
        room.last_message = "Think of a word and lock it in."
        return room

    def post_chat(self, room_code: str, player_id: str, text: str) -> ChatMessage:
        """Validates and appends a chat message to the room."""
        room, slot = self._verify_access(room_code, player_id)
        cleaned = text.strip()
        if not cleaned:
            raise ValueError("Chat message cannot be empty.")
        cleaned = cleaned[:300]
        sender_name = room.players[slot].name
        msg = ChatMessage(sender_slot=slot, sender_name=sender_name, text=cleaned)
        room.chat_history.append(msg)
        if len(room.chat_history) > MAX_CHAT_HISTORY:
            room.chat_history = room.chat_history[-MAX_CHAT_HISTORY:]
        return msg

    def mark_disconnected(self, player_id: str) -> Optional[MultiplayerRoom]:
        """Marks a player as disconnected without destroying their room state."""
        room_code = self.player_to_room.get(player_id)
        if not room_code:
            return None
        room = self.rooms.get(room_code)
        if not room:
            return None
        slot = room.get_slot_by_player_id(player_id)
        if slot is not None:
            room.players[slot].connected = False
            room.players[slot].websocket = None
        return room


async def _send_json(websocket: Any, payload: Dict[str, Any]) -> None:
    try:
        await websocket.send(json.dumps(payload))
    except Exception:
        pass


async def _broadcast_room_state(room: MultiplayerRoom) -> None:
    for slot, player in room.players.items():
        if player.connected and player.websocket is not None:
            state = room.build_personalized_state(viewer_slot=slot)
            await _send_json(player.websocket, state)


async def handle_client(websocket: Any, manager: RoomManager) -> None:
    """Asyncio WebSocket connection handler for a single client."""
    bound_player_id: Optional[str] = None
    try:
        async for raw_message in websocket:
            ok, data, err = parse_json_message(raw_message)
            if not ok:
                await _send_json(
                    websocket,
                    {"type": ServerMessageType.ERROR.value, "message": err},
                )
                continue

            msg_type = data["type"]
            player_id = str(data.get("player_id") or secrets.token_hex(8))
            bound_player_id = player_id

            try:
                if msg_type == ClientMessageType.CREATE_ROOM.value:
                    name = str(data.get("player_name") or "Sunny Marmot")
                    room = manager.create_room(player_id=player_id, player_name=name)
                    room.players[1].websocket = websocket
                    await _broadcast_room_state(room)

                elif msg_type in (
                    ClientMessageType.JOIN_ROOM.value,
                    ClientMessageType.RECONNECT_ROOM.value,
                ):
                    code = str(data.get("room_code") or "")
                    name = str(data.get("player_name") or "Opponent")
                    room = manager.join_room(room_code=code, player_id=player_id, player_name=name)
                    slot = room.get_slot_by_player_id(player_id)
                    if slot is not None:
                        room.players[slot].websocket = websocket
                    await _broadcast_room_state(room)

                elif msg_type == ClientMessageType.LEAVE_ROOM.value:
                    room = manager.mark_disconnected(player_id)
                    await _send_json(websocket, {"type": ServerMessageType.LEFT_ROOM.value})
                    if room:
                        await _broadcast_room_state(room)

                elif msg_type == ClientMessageType.SET_WORD.value:
                    room = manager.set_word(
                        room_code=str(data.get("room_code") or ""),
                        player_id=player_id,
                        word=str(data.get("word") or ""),
                        clue=str(data.get("clue") or ""),
                        category=str(data.get("category") or "Any category"),
                        difficulty=str(data.get("difficulty") or "Medium"),
                    )
                    await _broadcast_room_state(room)

                elif msg_type == ClientMessageType.GUESS_LETTER.value:
                    room = manager.guess_letter(
                        room_code=str(data.get("room_code") or ""),
                        player_id=player_id,
                        letter=str(data.get("letter") or ""),
                    )
                    await _broadcast_room_state(room)

                elif msg_type == ClientMessageType.SOLVE_WORD.value:
                    room = manager.solve_word(
                        room_code=str(data.get("room_code") or ""),
                        player_id=player_id,
                        candidate=str(data.get("word") or ""),
                    )
                    await _broadcast_room_state(room)

                elif msg_type == ClientMessageType.REVEAL_CLUE.value:
                    room = manager.reveal_clue(
                        room_code=str(data.get("room_code") or ""),
                        player_id=player_id,
                    )
                    await _broadcast_room_state(room)

                elif msg_type == ClientMessageType.RESIGN_ROUND.value:
                    room = manager.resign_round(
                        room_code=str(data.get("room_code") or ""),
                        player_id=player_id,
                    )
                    await _broadcast_room_state(room)

                elif msg_type == ClientMessageType.NEXT_ROUND.value:
                    room = manager.next_round(
                        room_code=str(data.get("room_code") or ""),
                        player_id=player_id,
                    )
                    await _broadcast_room_state(room)

                elif msg_type == ClientMessageType.NEW_MATCH.value:
                    room = manager.new_match(
                        room_code=str(data.get("room_code") or ""),
                        player_id=player_id,
                    )
                    await _broadcast_room_state(room)

                elif msg_type == ClientMessageType.CHAT_MESSAGE.value:
                    room_code = str(data.get("room_code") or "")
                    manager.post_chat(
                        room_code=room_code,
                        player_id=player_id,
                        text=str(data.get("text") or ""),
                    )
                    room = manager.rooms[room_code]
                    await _broadcast_room_state(room)

            except (ValueError, PermissionError) as exc:
                await _send_json(
                    websocket,
                    {"type": ServerMessageType.ERROR.value, "message": str(exc)},
                )
    finally:
        if bound_player_id:
            room = manager.mark_disconnected(bound_player_id)
            if room:
                await _broadcast_room_state(room)


async def run_server(host: str = "0.0.0.0", port: int = 8765) -> None:
    """Starts the standalone Python WebSockets server."""
    import websockets

    manager = RoomManager()
    print(f"Hangman authoritative WebSocket server listening on ws://{host}:{port}")
    async with websockets.serve(lambda ws: handle_client(ws, manager), host, port):
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    server_host = os.environ.get("HANGMAN_WS_HOST", "0.0.0.0")
    server_port = int(os.environ.get("HANGMAN_WS_PORT", "8765"))
    asyncio.run(run_server(server_host, server_port))
