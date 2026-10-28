import React, { useState } from "react";
import { Copy, Check, Flag, Plus, UserPlus } from "lucide-react";

interface OnlineLobbyModalProps {
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  errorMessage?: string | null;
}

/**
 * Reproduces the "Create a room / Join a room" modal card over the ruled paper
 * from Screenshot 1.
 */
export const OnlineLobbyModal: React.FC<OnlineLobbyModalProps> = ({
  onCreateRoom,
  onJoinRoom,
  errorMessage,
}) => {
  const [code, setCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      onJoinRoom(code.trim());
    }
  };

  return (
    <div className="w-full max-w-[440px] rounded-[20px] bg-[#F7F6F3] border border-[#D5C7A6] shadow-[0_14px_38px_rgba(12,37,64,0.12)] p-6 sm:p-7 space-y-5 text-left">
      {/* Create a room section */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-full bg-[#F9E4E4] text-[#B52D2D] flex items-center justify-center shrink-0">
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </span>
          <h3 className="text-[16px] font-bold text-[#201F1A]">Create a room</h3>
        </div>
        <p className="text-[13px] text-[#716B5D]">
          Start a new game and get a code to share.
        </p>
        <button
          type="button"
          onClick={onCreateRoom}
          className="w-full h-[46px] rounded-full bg-[#0C2540] hover:bg-[#143559] text-white text-[14px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
        >
          Create a room
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-[1px] flex-1 bg-[#D5C7A6]" />
        <span className="text-[12px] text-[#716B5D]">or</span>
        <div className="h-[1px] flex-1 bg-[#D5C7A6]" />
      </div>

      {/* Join a room section */}
      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-full bg-[#ECEAE4] text-[#201F1A] flex items-center justify-center shrink-0">
            <UserPlus className="w-3.5 h-3.5" />
          </span>
          <h3 className="text-[16px] font-bold text-[#201F1A]">Join a room</h3>
        </div>
        <p className="text-[13px] text-[#716B5D]">
          Have a code? Enter it to join your friend.
        </p>
        <div className="flex items-center gap-2.5 pt-1">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter room code"
            className="flex-1 h-[44px] px-4 rounded-[12px] bg-white border border-[#D5C7A6] text-[14px] text-[#201F1A] placeholder:text-[#8E887A] focus:outline-none focus:border-[#0C2540]"
          />
          <button
            type="submit"
            disabled={!code.trim()}
            className="h-[44px] px-6 rounded-full bg-white border border-[#D5C7A6] text-[14px] font-semibold text-[#201F1A] hover:bg-[#ECEAE4] disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Join
          </button>
        </div>
        {errorMessage && (
          <p className="text-[12px] font-medium text-[#B52D2D] pt-1">{errorMessage}</p>
        )}
      </form>
    </div>
  );
};

interface OnlineRoomBannerProps {
  roomCode: string;
  viewerSlot: 1 | 2;
  opponentConnected: boolean;
  onLeaveRoom: () => void;
  onOpenCompanionWindow: () => void;
}

/**
 * Reproduces the top pink Room Code banner from Screenshot 4:
 * - ROOM CODE + monospace roomCode + copy icon + "Copy link" dark navy pill button
 * - Connection indicator ("Waiting for your friend to join..." or "Friend connected")
 * - "Leave room" red pill button
 * - Subtitle below: "You play Player 1 · Share this code with a friend to play together."
 */
export const OnlineRoomBanner: React.FC<OnlineRoomBannerProps> = ({
  roomCode,
  viewerSlot,
  opponentConnected,
  onLeaveRoom,
  onOpenCompanionWindow,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(roomCode).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleCopyLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("room", roomCode);
    navigator.clipboard?.writeText(url.toString()).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1800);
  };

  return (
    <div className="space-y-1.5 mb-5">
      <div className="w-full rounded-[14px] bg-[#F9E4E4] border border-[#F1C4C4] px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3.5">
          <div>
            <div className="text-[10px] font-bold tracking-wider uppercase text-[#B52D2D]">
              ROOM CODE
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[20px] sm:text-[22px] font-bold tracking-wide text-[#201F1A]">
                {roomCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                title="Copy room code"
                className="p-1.5 rounded-md text-[#716B5D] hover:text-[#201F1A] hover:bg-white/60 transition-colors cursor-pointer"
              >
                {copiedCode ? <Check className="w-4 h-4 text-[#287B5E]" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyLink}
            className="h-[34px] px-4 rounded-full bg-[#0C2540] hover:bg-[#163B63] text-white text-[12px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? "Copied!" : "Copy link"}</span>
          </button>

          {!opponentConnected && (
            <button
              type="button"
              onClick={onOpenCompanionWindow}
              className="h-[34px] px-3.5 rounded-full bg-white/80 hover:bg-white border border-[#D5C7A6] text-[#201F1A] text-[12px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Simulate 2nd Player Here
            </button>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            <span
              className={`w-2 h-2 rounded-full ${
                opponentConnected ? "bg-[#287B5E]" : "bg-[#C77D1A]"
              }`}
            />
            <span className={opponentConnected ? "text-[#287B5E]" : "text-[#B56B14]"}>
              {opponentConnected ? "Friend connected" : "Waiting for your friend to join..."}
            </span>
          </div>

          <button
            type="button"
            onClick={onLeaveRoom}
            className="h-[36px] px-4 rounded-full bg-[#B52D2D] hover:bg-[#9B2323] text-white text-[12px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Flag className="w-3.5 h-3.5" />
            <span>Leave room</span>
          </button>
        </div>
      </div>

      <p className="text-[12px] text-[#716B5D] px-1">
        You play Player {viewerSlot} · Share this code with a friend to play together.
      </p>
    </div>
  );
};
