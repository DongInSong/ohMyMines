import { useEffect, useState, useRef } from 'react';
import { useGameStore } from '../../stores/gameStore';
import type { Notification } from 'shared';

interface AnimatedNotification extends Notification {
  isExiting: boolean;
  entryDelay: number;
}

const MAX_VISIBLE = 4;
const ANIMATION_DURATION = 250;
const STAGGER_DELAY = 60;

export function Notifications() {
  const notifications = useGameStore((s) => s.notifications);
  const removeNotification = useGameStore((s) => s.removeNotification);
  const [animatedNotifications, setAnimatedNotifications] = useState<AnimatedNotification[]>([]);
  const processedIds = useRef<Set<string>>(new Set());

  // Handle new notifications
  useEffect(() => {
    const currentIds = new Set(notifications.map((n) => n.id));

    // Find new notifications
    const newNotifications = notifications.filter((n) => !processedIds.current.has(n.id));

    // Add new notifications with staggered entry delay
    if (newNotifications.length > 0) {
      setAnimatedNotifications((prev) => {
        const existingIds = new Set(prev.map((n) => n.id));
        const toAdd = newNotifications
          .filter((n) => !existingIds.has(n.id))
          .map((n, index) => ({
            ...n,
            isExiting: false,
            entryDelay: index * STAGGER_DELAY,
          }));

        // Update processed IDs
        toAdd.forEach((n) => processedIds.current.add(n.id));

        // Combine and limit to MAX_VISIBLE
        const combined = [...prev.filter((n) => !n.isExiting), ...toAdd];

        // If over limit, mark oldest for exit
        if (combined.length > MAX_VISIBLE) {
          const excess = combined.length - MAX_VISIBLE;
          for (let i = 0; i < excess; i++) {
            if (!combined[i].isExiting) {
              combined[i] = { ...combined[i], isExiting: true };
            }
          }
        }

        return combined;
      });
    }

    // Handle removed notifications (mark for exit animation)
    setAnimatedNotifications((prev) =>
      prev.map((n) => {
        if (!currentIds.has(n.id) && !n.isExiting) {
          return { ...n, isExiting: true };
        }
        return n;
      })
    );
  }, [notifications]);

  // Clean up exited notifications after animation
  useEffect(() => {
    const exitingNotifications = animatedNotifications.filter((n) => n.isExiting);
    if (exitingNotifications.length === 0) return;

    const timeouts = exitingNotifications.map((n) => {
      return setTimeout(() => {
        setAnimatedNotifications((prev) => prev.filter((an) => an.id !== n.id));
        processedIds.current.delete(n.id);
      }, ANIMATION_DURATION);
    });

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [animatedNotifications]);

  const handleDismiss = (id: string) => {
    setAnimatedNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isExiting: true } : n))
    );
    removeNotification(id);
  };

  // Get accent color based on type
  const getAccentColor = (type: string) => {
    switch (type) {
      case 'success': return 'var(--game-success)';
      case 'error': return 'var(--game-danger)';
      case 'warning': return 'var(--game-accent)';
      case 'achievement': return '#a855f7';
      case 'item': return 'var(--game-accent)';
      default: return 'var(--game-accent)';
    }
  };

  // Get visible notifications (newest first, limited)
  const visibleNotifications = animatedNotifications
    .slice(-MAX_VISIBLE)
    .reverse();

  if (visibleNotifications.length === 0) return null;

  return (
    <div className="fixed bottom-6 sm:bottom-8 right-6 sm:right-8 w-56 sm:w-64 z-50 pointer-events-none">
      <div className="flex flex-col gap-1.5">
        {visibleNotifications.map((notification) => {
          const accentColor = getAccentColor(notification.type);

          return (
            <div
              key={notification.id}
              className={`
                pointer-events-auto
                transform transition-all ease-out
                ${notification.isExiting
                  ? 'animate-notification-exit'
                  : 'animate-notification-enter'
                }
              `}
              style={{
                animationDelay: notification.isExiting ? '0ms' : `${notification.entryDelay}ms`,
                animationFillMode: 'both',
              }}
            >
              {/* Unified notification card */}
              <div
                className="relative overflow-hidden cursor-pointer group"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 250, 250, 0.99) 100%)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  borderLeft: `2px solid ${accentColor}`,
                  clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)',
                }}
                onClick={() => handleDismiss(notification.id)}
              >
                {/* Top accent line */}
                <div
                  className="absolute top-0 left-0 right-0 h-px opacity-60"
                  style={{ background: `linear-gradient(90deg, ${accentColor}, transparent)` }}
                />

                {/* Content */}
                <div className="px-3 py-2.5 flex items-start gap-2.5">
                  {/* Accent dot */}
                  <div
                    className="w-1.5 h-1.5 mt-1.5 flex-shrink-0 rotate-45"
                    style={{ backgroundColor: accentColor }}
                  />

                  {/* Message */}
                  <p className="flex-1 text-xs text-game-text-dim leading-relaxed">
                    {notification.message}
                  </p>

                  {/* Close indicator - shows on hover */}
                  <span className="text-game-text-muted group-hover:text-game-accent transition-colors flex-shrink-0 text-[10px] font-mono opacity-0 group-hover:opacity-100">
                    ×
                  </span>
                </div>

                {/* Progress bar for timed notifications */}
                {notification.duration && (
                  <div
                    className="absolute bottom-0 left-0 h-[2px]"
                    style={{
                      backgroundColor: accentColor,
                      opacity: 0.5,
                      animation: `notification-progress ${notification.duration}ms linear forwards`,
                      animationDelay: `${notification.entryDelay}ms`,
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes notification-enter {
          0% {
            opacity: 0;
            transform: translateX(16px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes notification-exit {
          0% {
            opacity: 1;
            transform: translateX(0);
          }
          100% {
            opacity: 0;
            transform: translateX(16px);
          }
        }

        @keyframes notification-progress {
          0% {
            width: 100%;
          }
          100% {
            width: 0%;
          }
        }

        .animate-notification-enter {
          animation: notification-enter ${ANIMATION_DURATION}ms ease-out;
        }

        .animate-notification-exit {
          animation: notification-exit ${ANIMATION_DURATION}ms ease-in;
        }
      `}</style>
    </div>
  );
}
