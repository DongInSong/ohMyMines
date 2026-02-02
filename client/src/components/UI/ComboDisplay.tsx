import { useEffect, useState } from 'react';
import { usePlayerStore } from '../../stores/playerStore';

const COMBO_DEFAULTS = {
  TIMEOUT: 5000,
  FEVER_THRESHOLD: 20,
  FEVER_MULTIPLIER: 3,
};

export function ComboDisplay() {
  const storeCombo = usePlayerStore((s) => s.combo);
  const [isAnimating, setIsAnimating] = useState(false);
  const [feverTimeLeft, setFeverTimeLeft] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const count = typeof storeCombo?.count === 'number' ? storeCombo.count : 0;
  const multiplier = storeCombo?.multiplier ?? 1;
  const lastRevealTime = storeCombo?.lastRevealTime ?? 0;
  const isFever = storeCombo?.isFever ?? false;
  const feverEndTime = storeCombo?.feverEndTime;

  useEffect(() => {
    if (count > 0) {
      setIsVisible(true);
      setIsAnimating(true);
      setAnimationKey((prev) => prev + 1);

      const animTimer = setTimeout(() => setIsAnimating(false), 150);

      if (!isFever) {
        const hideTimer = setTimeout(() => {
          setIsVisible(false);
        }, COMBO_DEFAULTS.TIMEOUT + 100);

        return () => {
          clearTimeout(animTimer);
          clearTimeout(hideTimer);
        };
      }

      return () => clearTimeout(animTimer);
    } else {
      setIsVisible(false);
    }
  }, [count, lastRevealTime, isFever]);

  useEffect(() => {
    if (!isFever || !feverEndTime) return;

    const updateTimer = () => {
      const remaining = Math.max(0, (feverEndTime ?? 0) - Date.now());
      setFeverTimeLeft(Math.ceil(remaining / 1000));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100);
    return () => clearInterval(interval);
  }, [isFever, feverEndTime]);

  if (!isVisible || count <= 0) return null;

  const displayMultiplier = isFever ? COMBO_DEFAULTS.FEVER_MULTIPLIER : multiplier;

  return (
    <div className="fixed top-10 sm:top-12 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
      <div className={`
        flex flex-col items-center transition-all duration-150
        ${isAnimating ? 'scale-125' : 'scale-100'}
      `}>
        {/* Fever indicator */}
        {isFever && (
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-0.5 bg-gradient-to-r from-transparent to-amber-500" />
            <div className="px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold uppercase tracking-widest animate-pulse rounded-sm shadow-lg shadow-amber-500/30">
              🔥 Fever Mode 🔥
            </div>
            <span className="text-amber-500 font-mono font-black text-lg drop-shadow-sm">{feverTimeLeft}s</span>
            <div className="w-10 h-0.5 bg-gradient-to-l from-transparent to-amber-500" />
          </div>
        )}

        {/* Main combo display - Tactical frame */}
        <div className="relative px-8 py-4"
             style={{
               background: isFever
                 ? 'linear-gradient(135deg, rgba(255, 251, 235, 0.98) 0%, rgba(255, 237, 213, 0.98) 100%)'
                 : 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.98) 100%)',
               border: isFever ? '3px solid #f59e0b' : '2px solid rgba(60, 60, 60, 0.5)',
               boxShadow: isFever
                 ? '0 8px 32px rgba(245, 158, 11, 0.4), 0 4px 16px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.9)'
                 : '0 8px 32px rgba(0, 0, 0, 0.2), 0 4px 16px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
               clipPath: 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)',
             }}>
          {/* Corner decorations - on non-clipped corners */}
          <div className={`absolute top-0 right-0 w-4 h-4 border-t-[3px] border-r-[3px] ${isFever ? 'border-amber-500' : 'border-gray-600'}`} />
          <div className={`absolute bottom-0 left-0 w-4 h-4 border-b-[3px] border-l-[3px] ${isFever ? 'border-amber-500' : 'border-gray-600'}`} />

          {/* Top accent line */}
          <div className={`absolute top-0 left-4 right-4 h-0.5 ${
            isFever
              ? 'bg-gradient-to-r from-transparent via-amber-500 to-transparent'
              : 'bg-gradient-to-r from-transparent via-gray-500 to-transparent'
          }`} />

          <div className="flex items-baseline gap-2 sm:gap-3">
            {/* Count */}
            <span className={`
              text-4xl sm:text-6xl font-black tracking-tighter font-mono drop-shadow-sm
              ${isFever ? 'text-amber-600' : 'text-gray-800'}
              transition-colors duration-200
            `}
            style={{
              textShadow: isFever ? '0 2px 8px rgba(245, 158, 11, 0.3)' : '0 1px 2px rgba(0, 0, 0, 0.1)',
            }}>
              {count}
            </span>

            {/* Multiplier */}
            <div className="flex flex-col items-start">
              <span className={`text-lg sm:text-2xl font-black font-mono ${isFever ? 'text-amber-500' : 'text-gray-600'}`}>
                x{displayMultiplier}
              </span>
              <span className={`text-[9px] sm:text-[10px] uppercase tracking-[0.2em] font-semibold ${isFever ? 'text-amber-600' : 'text-gray-500'}`}>
                Combo
              </span>
            </div>
          </div>
        </div>

        {/* Timeout bar */}
        {!isFever && (
          <div className="mt-4 w-24 h-1.5 bg-white border-2 border-gray-400 overflow-hidden rounded-sm shadow-inner">
            <div
              key={animationKey}
              className="h-full bg-gradient-to-r from-gray-600 to-gray-800"
              style={{
                width: '100%',
                animation: `comboShrink ${COMBO_DEFAULTS.TIMEOUT}ms linear forwards`,
              }}
            />
          </div>
        )}

        {/* Fever bar */}
        {isFever && feverEndTime && (
          <div className="mt-4 w-28 h-2 bg-amber-100 border-2 border-amber-400 overflow-hidden rounded-sm shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500 animate-pulse"
              style={{
                width: `${Math.min(100, (feverTimeLeft / 10) * 100)}%`,
                transition: 'width 0.1s linear',
              }}
            />
          </div>
        )}
      </div>

      <style>{`
        @keyframes comboShrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
