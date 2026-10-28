"""
Non-blocking async WebSocket client for the Flet Hangman GUI.
Uses `page.run_task` so network reads and writes never block the Flet UI loop.
"""

from __future__ import annotations

import asyncio
import json
import os
import secrets
from typing import Any, Callable, Dict, Optional

from networking.protocol import ClientMessageType, ServerMessageType


class HangmanNetworkClient:
    """Manages an async WebSocket connection to the authoritative Hangman server."""

    def __init__(
        self,
        on_state_update: Callable[[Dict[str, Any]], None],
        on_error: Callable[[str], None],
        server_url: Optional[str] = None,
    ) -> None:
        self.server_url: str = server_url or os.environ.get(
            "HANGMAN_WS_URL", "ws://127.0.0.1:8765"
        )
        self.player_id: str = secrets.token_hex(8)
        self.room_code: str = ""
        self._websocket: Optional[Any] = None
        self._listen_task: Optional[asyncio.Task[None]] = None
        self.on_state_update = on_state_update
        self.on_error = on_error

    @property
    def is_connected(self) -> bool:
        return self._websocket is not None

    async def connect(self) -> bool:
        """Establishes an async WebSocket connection if not already connected."""
        if self._websocket is not None:
            return True
        try:
            import websockets

            self._websocket = await websockets.connect(self.server_url)
            self._listen_task = asyncio.create_task(self._receive_loop())
            return True
        except Exception as exc:
            self._websocket = None
            self.on_error(f"Could not connect to server ({self.server_url}): {exc}")
            return False

    async def _receive_loop(self) -> None:
        """Background listener task that dispatches incoming messages to UI callbacks."""
        assert self._websocket is not None
        try:
            async for raw_message in self._websocket:
                data = json.loads(raw_message)
                msg_type = data.get("type")
                if msg_type == ServerMessageType.STATE_UPDATE.value:
                    self.room_code = str(data.get("room_code") or "")
                    self.on_state_update(data)
                elif msg_type == ServerMessageType.ERROR.value:
                    self.on_error(str(data.get("message") or "Server error"))
                elif msg_type == ServerMessageType.LEFT_ROOM.value:
                    self.room_code = ""
        except Exception as exc:
            self.on_error(f"Connection closed: {exc}")
        finally:
            self._websocket = None

    async def send_action(self, action_type: ClientMessageType, **kwargs: Any) -> None:
        """Serializes and sends a client action over the active WebSocket."""
        if not await self.connect():
            return
        assert self._websocket is not None
        payload: Dict[str, Any] = {
            "type": action_type.value,
            "player_id": self.player_id,
            "room_code": kwargs.pop("room_code", self.room_code),
            **kwargs,
        }
        try:
            await self._websocket.send(json.dumps(payload))
        except Exception as exc:
            self.on_error(f"Failed to send action: {exc}")

    async def close(self) -> None:
        """Gracefully closes the WebSocket connection."""
        if self._websocket is not None:
            await self._websocket.close()
            self._websocket = None
        if self._listen_task is not None:
            self._listen_task.cancel()
            self._listen_task = None
