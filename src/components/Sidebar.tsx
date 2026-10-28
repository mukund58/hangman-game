import React, { useState } from "react";
import {
  Dices,
  Link2,
  Users,
  RotateCcw,
  Flag,
  Plus,
  Send,
  MessageCircle,
  Star,
} from "lucide-react";
import { CATEGORIES, DIFFICULTIES, Difficulty, GameMode } from "../game/engine";

export interface PlayerScoreCardItem {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  score: number;
  isTurn: boolean;
}

export interface ChatMessageItem {
  id?: string;
  sender_slot?: number;
  senderSlot?: number;
  sender_name?: string;
  senderName?: string;
  text: string;
  timestamp: number;
}

interface SidebarProps {
  mode: GameMode;
  difficulty: Difficulty;
  category: string;
  statusText: string;
  players: PlayerScoreCardItem[];
  showResign: boolean;
  showOnlineChat: boolean;
  chatMessages: ChatMessageItem[];
  hideModeSwitcher?: boolean;
  onModeChange: (mode: GameMode) => void;
  onDifficultyChange: (difficulty: Difficulty) => void;
  onCategoryChange: (category: string) => void;
  onRestart: () => void;
  onResign: () => void;
  onNewGame: () => void;
  onHowToPlay: () => void;
  onSendChat: (text: string) => void;
}

/**
 * Right-hand Sidebar reproducing Screenshots 1, 2, 4, 5, and 6:
 * 1. Title: "Hangman ☆"
 * 2. Description + "How to play" underlined crimson action
 * 3. MODE card (Computer / A friend online / Pass and play) + Difficulty & Category selectors
 * 4. Status card (Status pill + Restart, Resign, New game buttons)
 * 5. Score card (Player avatars, active turn indicator, tabular scores) + integrated Chat panel
 */
export const Sidebar: React.FC<SidebarProps> = ({
  mode,
  difficulty,
  category,
  statusText,
  players,
  showResign,
  showOnlineChat,
  chatMessages,
  hideModeSwitcher = false,
  onModeChange,
  onDifficultyChange,
  onCategoryChange,
  onRestart,
  onResign,
  onNewGame,
  onHowToPlay,
  onSendChat,
}) => {
  const [chatText, setChatText] = useState("");

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    onSendChat(chatText.trim());
    setChatText("");
  };

  return (
    <aside className="w-full lg:w-[350px] xl:w-[368px] shrink-0 space-y-4">
      {/* 1 & 2. Title, short description, and "How to play" link */}
      <div className="space-y-1.5 px-0.5">
        <div className="flex items-center gap-2">
          <h1 className="text-[26px] font-bold tracking-tight text-[#201F1A]">
            Hangman
          </h1>
          <Star className="w-5 h-5 text-[#716B5D]" />
        </div>
        <p className="text-[13px] leading-relaxed text-[#716B5D]">
          Guess the hidden word letter by letter — six lives, and a friend or the computer setting the traps.{" "}
          <button
            type="button"
            onClick={onHowToPlay}
            className="text-[#B52D2D] font-semibold underline underline-offset-2 hover:text-[#8E1F1F] cursor-pointer whitespace-nowrap"
          >
            How to play
          </button>
        </p>
      </div>

      {/* 4. Game Mode Card (hidden when inside an active online room, matching Screenshot 4) */}
      {!hideModeSwitcher && (
        <div className="rounded-[16px] bg-[#F7F6F3] border border-[#D5C7A6] p-4 space-y-4">
          <div className="space-y-2">
            <div className="text-[11px] font-bold tracking-wider uppercase text-[#716B5D]">
              MODE
            </div>
            <div className="grid grid-cols-3 gap-2">
              {/* Computer Mode Button */}
              <button
                type="button"
                onClick={() => onModeChange("computer")}
                className={`h-[80px] rounded-[12px] border flex flex-col items-center justify-center gap-1.5 px-2 transition-all cursor-pointer ${
                  mode === "computer"
                    ? "bg-[#2B5CE6] border-[#2B5CE6] text-white shadow-sm"
                    : "bg-[#F7F6F3] border-[#D5C7A6] text-[#201F1A] hover:bg-white"
                }`}
              >
                <Dices
                  className={`w-5 h-5 ${
                    mode === "computer" ? "text-white" : "text-[#2B5CE6]"
                  }`}
                />
                <span className="text-[12px] font-semibold leading-tight">
                  Computer
                </span>
              </button>

              {/* A friend online Mode Button */}
              <button
                type="button"
                onClick={() => onModeChange("online")}
                className={`h-[80px] rounded-[12px] border flex flex-col items-center justify-center gap-1.5 px-2 transition-all cursor-pointer ${
                  mode === "online"
                    ? "bg-[#6C2BD9] border-[#6C2BD9] text-white shadow-sm"
                    : "bg-[#F7F6F3] border-[#D5C7A6] text-[#201F1A] hover:bg-white"
                }`}
              >
                <Link2
                  className={`w-5 h-5 ${
                    mode === "online" ? "text-white" : "text-[#6C2BD9]"
                  }`}
                />
                <span className="text-[12px] font-semibold leading-tight text-center">
                  A friend
                  <br />
                  online
                </span>
              </button>

              {/* Pass and play Mode Button */}
              <button
                type="button"
                onClick={() => onModeChange("pass_and_play")}
                className={`h-[80px] rounded-[12px] border flex flex-col items-center justify-center gap-1.5 px-2 transition-all cursor-pointer ${
                  mode === "pass_and_play"
                    ? "bg-[#287B5E] border-[#287B5E] text-white shadow-sm"
                    : "bg-[#F7F6F3] border-[#D5C7A6] text-[#201F1A] hover:bg-white"
                }`}
              >
                <Users
                  className={`w-5 h-5 ${
                    mode === "pass_and_play" ? "text-white" : "text-[#287B5E]"
                  }`}
                />
                <span className="text-[12px] font-semibold leading-tight text-center">
                  Pass and
                  <br />
                  play
                </span>
              </button>
            </div>
          </div>

          {/* Computer mode Difficulty & Category filters (matching Screenshot 5) */}
          {mode === "computer" && (
            <>
              <div className="space-y-2">
                <div className="text-[11px] font-bold tracking-wider uppercase text-[#716B5D]">
                  DIFFICULTY
                </div>
                <div className="grid grid-cols-4 gap-1 p-1 rounded-full bg-[#ECEAE4] border border-[#DFD8C8]">
                  {DIFFICULTIES.map((diff) => {
                    const active = difficulty === diff;
                    return (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => onDifficultyChange(diff)}
                        className={`py-1.5 rounded-full text-[12px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                          active
                            ? "bg-white text-[#B52D2D] shadow-xs"
                            : "text-[#201F1A] hover:text-[#B52D2D]"
                        }`}
                      >
                        {diff}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-bold tracking-wider uppercase text-[#716B5D]">
                  CATEGORY
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => {
                    const active = category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => onCategoryChange(cat)}
                        className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                          active
                            ? "bg-[#F9E4E4] border-[#B52D2D] text-[#B52D2D]"
                            : "bg-white border-[#D5C7A6] text-[#201F1A] hover:border-[#716B5D]"
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 5. Status & Action Card */}
      <div className="rounded-[16px] bg-[#F7F6F3] border border-[#D5C7A6] p-4 space-y-3">
        <div className="rounded-[10px] bg-[#F9E4E4] px-3.5 py-2.5 flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-[#B52D2D] shrink-0" />
          <span className="text-[13px] font-bold text-[#B52D2D] truncate">
            {statusText}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRestart}
            className="w-[68px] h-[60px] rounded-[12px] bg-[#F7F6F3] hover:bg-white border border-[#D5C7A6] flex flex-col items-center justify-center gap-1 text-[#201F1A] transition-colors cursor-pointer shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-[11px] font-semibold whitespace-nowrap">Restart</span>
          </button>

          {showResign && (
            <button
              type="button"
              onClick={onResign}
              className="w-[68px] h-[60px] rounded-[12px] bg-[#F7F6F3] hover:bg-[#F9E4E4]/50 border border-[#D5C7A6] flex flex-col items-center justify-center gap-1 text-[#B52D2D] transition-colors cursor-pointer shrink-0"
            >
              <Flag className="w-4 h-4" />
              <span className="text-[11px] font-semibold whitespace-nowrap">Resign</span>
            </button>
          )}

          <button
            type="button"
            onClick={onNewGame}
            className="w-[74px] h-[60px] rounded-[12px] bg-[#F7F6F3] hover:bg-white border border-[#D5C7A6] flex flex-col items-center justify-center gap-1 text-[#201F1A] transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="text-[11px] font-semibold whitespace-nowrap">New game</span>
          </button>
        </div>
      </div>

      {/* 6 & 7. Score Card + Online Chat Panel */}
      {players.length > 0 && (
        <div className="rounded-[16px] bg-[#F7F6F3] border border-[#D5C7A6] overflow-hidden">
          <div className="p-4 space-y-2.5">
            <div className="text-[12px] font-semibold text-[#716B5D]">Score</div>

            <div className="space-y-2">
              {players.map((p) => (
                <div
                  key={p.id}
                  className={`relative rounded-[12px] px-3 py-2.5 flex items-center justify-between transition-colors ${
                    p.isTurn
                      ? "bg-[#F9E4E4] border border-[#F1C4C4]"
                      : "bg-transparent"
                  }`}
                >
                  {p.isTurn && (
                    <span
                      aria-hidden="true"
                      className="absolute left-1 top-2 bottom-2 w-[3px] rounded-full bg-[#B52D2D]"
                    />
                  )}
                  <div className="flex items-center gap-3 pl-1">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0"
                      style={{ backgroundColor: p.avatarColor }}
                    >
                      {p.initials}
                    </div>
                    <div>
                      <div className="text-[14px] font-bold text-[#201F1A] leading-snug">
                        {p.name}
                      </div>
                      {p.isTurn && (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#B52D2D]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#B52D2D]" />
                          <span>Your turn</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-[20px] font-bold text-[#201F1A] tabular-nums pr-1">
                    {p.score}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Online Chat Section (Screenshot 4) */}
          {showOnlineChat && (
            <div className="border-t border-[#D5C7A6]">
              <div className="px-4 py-2 border-b border-[#EAE5D9] text-[10px] font-bold tracking-wider uppercase text-[#716B5D]">
                CHAT
              </div>

              <div className="h-[175px] px-4 py-3 overflow-y-auto flex flex-col gap-2">
                {chatMessages.length === 0 ? (
                  <div className="m-auto flex flex-col items-center gap-1.5 text-[#716B5D]">
                    <MessageCircle className="w-7 h-7 stroke-[1.75] text-[#201F1A]" />
                    <span className="text-[12px] italic">Say hello 👋</span>
                  </div>
                ) : (
                  chatMessages.map((msg, i) => {
                    const sender = msg.senderName || msg.sender_name || "Player";
                    return (
                      <div
                        key={msg.id || i}
                        className="rounded-[10px] bg-white border border-[#E5DEC9] px-3 py-1.5 text-[12px]"
                      >
                        <span className="font-bold text-[#201F1A]">{sender}: </span>
                        <span className="text-[#4A463D]">{msg.text}</span>
                      </div>
                    );
                  })
                )}
              </div>

              <form
                onSubmit={handleChatSubmit}
                className="p-2.5 border-t border-[#EAE5D9] flex items-center gap-2 bg-[#F7F6F3]"
              >
                <input
                  type="text"
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder="Message..."
                  className="flex-1 h-[36px] px-3.5 rounded-full bg-white border border-[#D5C7A6] text-[13px] text-[#201F1A] placeholder:text-[#8E887A] focus:outline-none focus:border-[#B52D2D]"
                />
                <button
                  type="submit"
                  aria-label="Send message"
                  className="w-9 h-9 rounded-full bg-[#B52D2D] hover:bg-[#992222] text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
