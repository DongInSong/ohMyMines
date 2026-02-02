import { useState, useRef, useEffect, useCallback } from 'react';
import { EMOJI_REACTIONS, NETWORK } from 'shared';
import { useSocket } from '../../hooks/useSocket';
import { useGameStore } from '../../stores/gameStore';
import { usePlayerStore } from '../../stores/playerStore';

const MIN_HEIGHT = 100;
const MAX_HEIGHT = 400;
const DEFAULT_HEIGHT = 200;

export function Chat() {
  const [message, setMessage] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  const { sendChat } = useSocket();
  const chatMessages = useGameStore((s) => s.chatMessages);
  const player = usePlayerStore((s) => s.player);
  const settings = usePlayerStore((s) => s.settings);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Handle resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    startYRef.current = e.clientY;
    startHeightRef.current = height;
  }, [height]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = startYRef.current - e.clientY;
      const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeightRef.current + deltaY));
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleSend = useCallback(() => {
    if (!message.trim() || !player) return;
    if (message.length > NETWORK.MAX_CHAT_MESSAGE_LENGTH) return;

    sendChat(message.trim(), false);
    setMessage('');
  }, [message, player, sendChat]);

  const handleEmojiClick = useCallback(
    (emoji: string) => {
      if (!player) return;
      sendChat(emoji, true);
      setShowEmojis(false);
    },
    [player, sendChat]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!settings.chatEnabled) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`game-panel corner-cut-md flex flex-col transition-all ${isResizing ? 'select-none' : ''}`}
      style={{ height: isMinimized ? 44 : height }}
    >
      {/* Resize handle */}
      {!isMinimized && (
        <div
          className="absolute -top-1.5 left-0 right-0 h-4 cursor-ns-resize group flex items-center justify-center"
          onMouseDown={handleResizeStart}
        >
          <div className="w-16 h-0.5 bg-game-border group-hover:bg-game-accent/50 transition-colors" />
        </div>
      )}

      <div
        className="flex justify-between items-center cursor-pointer pb-2 border-b border-game-border/50 mb-2"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="game-panel-header mb-0">Comms</div>
        <div className="flex items-center gap-2">
          {!isMinimized && (
            <span className="hidden sm:block text-[9px] text-game-text-muted uppercase tracking-wider">Drag to resize</span>
          )}
          <span className={`text-game-accent text-xs transition-transform ${isMinimized ? '' : 'rotate-180'}`}>
            ^
          </span>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-0.5 mb-2">
            {chatMessages.length === 0 ? (
              <div className="text-xs text-game-text-muted flex items-center gap-2">
                <span className="w-1 h-1 bg-game-text-muted rotate-45" />
                No transmissions
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`chat-message ${msg.isEmoji ? 'emoji-only' : ''}`}
                >
                  <span style={{ color: msg.playerColor }} className="font-semibold">
                    {msg.playerName}
                  </span>
                  {msg.guildOnly && (
                    <span className="text-game-accent text-[10px] ml-1 uppercase">[Guild]</span>
                  )}
                  <span className="text-game-text-muted mx-1">:</span>
                  <span className="text-game-text-dim">{msg.content}</span>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="flex gap-1 sm:gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message..."
              maxLength={NETWORK.MAX_CHAT_MESSAGE_LENGTH}
              className="game-input flex-1 text-xs sm:text-sm py-1.5 sm:py-2"
              style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
            />

            <button
              onClick={() => setShowEmojis(!showEmojis)}
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-game-primary border border-game-border hover:border-game-accent/50 transition-colors flex-shrink-0"
              style={{ clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)' }}
            >
              <span className="text-xs sm:text-sm">+</span>
            </button>

            <button
              onClick={handleSend}
              disabled={!message.trim()}
              className="px-2 sm:px-4 h-8 sm:h-9 bg-game-accent text-game-bg text-xs sm:text-sm font-bold hover:bg-game-accent-bright transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
            >
              <span className="hidden sm:inline">SEND</span>
              <span className="sm:hidden">▶</span>
            </button>
          </div>

          {/* Emoji picker */}
          {showEmojis && (
            <div className="absolute bottom-full mb-2 left-0 bg-game-primary/98 backdrop-blur-md border border-game-border p-2 grid grid-cols-6 gap-1"
                 style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
              {EMOJI_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiClick(emoji)}
                  className="w-9 h-9 hover:bg-game-accent/20 transition-colors text-lg flex items-center justify-center"
                  style={{ clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)' }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
