import React, { useEffect, useRef, useState } from "react";
import { X, Send, Users, Lightbulb } from "lucide-react";

interface CompanionOnlineClientProps {
  roomCode: string;
  onClose: () => void;
}

/**
 * Real second WebSocket client that connects to the same room on the authoritative server
 * so a student testing on a single monitor can test two-player online multiplayer
 * (setting words, guessing letters, and live chat) without needing a second computer.
 */
export const CompanionOnlineClient: React.FC<CompanionOnlineClientProps> = ({
  roomCode,
  onClose,
}) => {
  const wsRef = useRef<WebSocket | null>(null);
  const playerIdRef = useRef<string>(
    "companion-" + Math.random().toString(36).slice(2, 10)
  );
  const [state, setState] = useState<any>(null);
  const [wordInput, setWordInput] = useState("");
  const [clueInput, setClueInput] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "join_room",
          room_code: roomCode,
          player_id: playerIdRef.current,
          player_name: "Opponent",
        })
      );
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === "state_update") {
          setState(msg);
          setError(null);
        } else if (msg.type === "error") {
          setError(msg.message);
        }
      } catch {
        // ignore
      }
    };

    return () => {
      ws.close();
    };
  }, [roomCode]);

  const sendAction = (type: string, extra: Record<string, any> = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type,
          room_code: roomCode,
          player_id: playerIdRef.current,
          ...extra,
        })
      );
    }
  };

  if (!state) {
    return (
      <div className="fixed bottom-4 right-4 z-40 w-[360px] rounded-[16px] bg-[#F7F6F3] border-2 border-[#0C2540] shadow-xl p-4">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold text-[#0C2540]">
            Connecting Player 2 via WebSocket...
          </span>
          <button type="button" onClick={onClose} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const viewerSlot = state.viewer_slot;
  const isSetter = viewerSlot === state.setter_slot;
  const isGuesser = viewerSlot === state.guesser_slot;
  const game = state.game;
  const isOver = ["WON", "LOST", "RESIGNED"].includes(game.status);

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[370px] rounded-[16px] bg-[#F7F6F3] border-2 border-[#0C2540] shadow-2xl overflow-hidden text-[13px]">
      <div className="px-4 py-2.5 bg-[#0C2540] text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          <span className="font-bold">Player 2 (Opponent WebSocket Client)</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Disconnect Player 2"
          className="p-1 hover:bg-white/20 rounded cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto">
        {error && (
          <div className="p-2 rounded bg-[#F9E4E4] text-[#B52D2D] text-[12px] font-medium">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between text-[12px] text-[#716B5D]">
          <span>
            Round {state.round_number} / {state.max_rounds}
          </span>
          <span>Lives: {game.remaining_lives} / 6</span>
        </div>

        {game.status === "WAITING_FOR_WORD" ? (
          isSetter ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (wordInput.trim()) {
                  sendAction("set_word", {
                    word: wordInput.trim(),
                    clue: clueInput.trim(),
                  });
                  setWordInput("");
                  setClueInput("");
                }
              }}
              className="space-y-2"
            >
              <div className="font-bold text-[#201F1A]">
                Your turn to set a word for Player 1:
              </div>
              <input
                type="text"
                value={wordInput}
                onChange={(e) =>
                  setWordInput(e.target.value.toUpperCase().replace(/[^A-Z -]/g, ""))
                }
                placeholder="SECRET WORD"
                className="w-full h-9 px-3 rounded bg-white border border-[#D5C7A6] font-mono font-bold"
              />
              <input
                type="text"
                value={clueInput}
                onChange={(e) => setClueInput(e.target.value)}
                placeholder="Optional clue"
                className="w-full h-9 px-3 rounded bg-white border border-[#D5C7A6]"
              />
              <button
                type="submit"
                className="w-full h-9 rounded bg-[#B52D2D] text-white font-semibold cursor-pointer"
              >
                Lock in word
              </button>
            </form>
          ) : (
            <div className="py-4 text-center text-[#716B5D] italic">
              Waiting for Player 1 to lock in the secret word...
            </div>
          )
        ) : (
          <div className="space-y-3">
            <div className="p-2.5 rounded bg-white border border-[#D5C7A6] text-center font-mono text-[18px] font-bold tracking-widest">
              {game.masked_characters.join(" ")}
            </div>

            {game.clue && (
              <div className="text-[12px] text-[#B52D2D] font-semibold flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5" /> Clue: {game.clue}
              </div>
            )}

            {isGuesser && !isOver && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-[#716B5D]">
                  Click a letter to guess as Player 2:
                </div>
                <div className="flex flex-wrap gap-1">
                  {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((ch) => {
                    const used = game.guessed_letters.includes(ch);
                    return (
                      <button
                        key={ch}
                        type="button"
                        disabled={used}
                        onClick={() => sendAction("guess_letter", { letter: ch })}
                        className={`w-7 h-7 rounded text-[11px] font-bold border ${
                          used
                            ? "bg-[#E6E4E2] text-[#8E887A] border-transparent cursor-not-allowed"
                            : "bg-white text-[#201F1A] border-[#D5C7A6] hover:border-[#201F1A] cursor-pointer"
                        }`}
                      >
                        {ch}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {isSetter && !isOver && (
              <div className="text-[12px] text-[#716B5D] text-center">
                Secret word:{" "}
                <span className="font-mono font-bold text-[#201F1A]">
                  {game.secret_word}
                </span>{" "}
                (hidden from guesser!)
              </div>
            )}

            {isOver && (
              <button
                type="button"
                onClick={() => sendAction("next_round")}
                className="w-full h-9 rounded bg-[#287B5E] text-white font-semibold cursor-pointer"
              >
                Start Next Round (Swap Roles)
              </button>
            )}
          </div>
        )}

        {/* Quick Chat from Player 2 */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (chatInput.trim()) {
              sendAction("chat_message", { text: chatInput.trim() });
              setChatInput("");
            }
          }}
          className="pt-2 border-t border-[#D5C7A6] flex items-center gap-1.5"
        >
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Chat as Player 2..."
            className="flex-1 h-8 px-2.5 rounded-full bg-white border border-[#D5C7A6] text-[12px]"
          />
          <button
            type="submit"
            className="w-8 h-8 rounded-full bg-[#B52D2D] text-white flex items-center justify-center cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
