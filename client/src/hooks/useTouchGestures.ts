import { useEffect, useRef, useCallback } from 'react';
import type { Position } from 'shared';

interface TouchGestureOptions {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onTap: (screenX: number, screenY: number) => void;
  onLongPress: (screenX: number, screenY: number) => void;
  onPan: (deltaX: number, deltaY: number) => void;
  onZoom: (delta: number) => void;
}

interface TouchState {
  startTouches: Touch[];
  startTime: number;
  lastPinchDist: number;
  isPinching: boolean;
  isPanning: boolean;
  longPressTimer: ReturnType<typeof setTimeout> | null;
  hasMoved: boolean;
  lastPanPos: Position | null;
}

const LONG_PRESS_MS = 300;
const TAP_MOVE_THRESHOLD = 10;

function getTouchDistance(t1: Touch, t2: Touch): number {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function useTouchGestures({
  canvasRef,
  onTap,
  onLongPress,
  onPan,
  onZoom,
}: TouchGestureOptions) {
  const stateRef = useRef<TouchState>({
    startTouches: [],
    startTime: 0,
    lastPinchDist: 0,
    isPinching: false,
    isPanning: false,
    longPressTimer: null,
    hasMoved: false,
    lastPanPos: null,
  });

  const clearLongPress = useCallback(() => {
    const s = stateRef.current;
    if (s.longPressTimer !== null) {
      clearTimeout(s.longPressTimer);
      s.longPressTimer = null;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouchStart = (e: TouchEvent) => {
      const s = stateRef.current;
      const touches = e.touches;

      if (touches.length === 1) {
        const touch = touches[0];
        s.startTouches = [touch];
        s.startTime = Date.now();
        s.hasMoved = false;
        s.isPanning = false;
        s.isPinching = false;
        s.lastPanPos = { x: touch.clientX, y: touch.clientY };

        // Start long press timer
        clearLongPress();
        s.longPressTimer = setTimeout(() => {
          if (!s.hasMoved && !s.isPinching) {
            onLongPress(touch.clientX, touch.clientY);
          }
          s.longPressTimer = null;
        }, LONG_PRESS_MS);
      } else if (touches.length === 2) {
        // Two finger gesture - cancel long press
        clearLongPress();
        s.isPinching = true;
        s.lastPinchDist = getTouchDistance(touches[0], touches[1]);
        s.lastPanPos = {
          x: (touches[0].clientX + touches[1].clientX) / 2,
          y: (touches[0].clientY + touches[1].clientY) / 2,
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const s = stateRef.current;
      const touches = e.touches;

      if (touches.length === 1 && !s.isPinching) {
        const touch = touches[0];
        const dx = touch.clientX - (s.startTouches[0]?.clientX ?? touch.clientX);
        const dy = touch.clientY - (s.startTouches[0]?.clientY ?? touch.clientY);
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > TAP_MOVE_THRESHOLD) {
          s.hasMoved = true;
          clearLongPress();
        }

        // Single finger panning (after move threshold)
        if (s.hasMoved && s.lastPanPos) {
          const panDx = touch.clientX - s.lastPanPos.x;
          const panDy = touch.clientY - s.lastPanPos.y;
          onPan(panDx, panDy);
          s.lastPanPos = { x: touch.clientX, y: touch.clientY };
          s.isPanning = true;
        }
      } else if (touches.length === 2) {
        // Pinch zoom
        const newDist = getTouchDistance(touches[0], touches[1]);
        if (s.lastPinchDist > 0) {
          const scale = newDist / s.lastPinchDist;
          if (Math.abs(scale - 1) > 0.01) {
            const delta = scale > 1 ? 1 : -1;
            const intensity = Math.abs(scale - 1) * 3;
            onZoom(delta * intensity);
          }
        }
        s.lastPinchDist = newDist;

        // Two finger pan
        const midX = (touches[0].clientX + touches[1].clientX) / 2;
        const midY = (touches[0].clientY + touches[1].clientY) / 2;
        if (s.lastPanPos) {
          const panDx = midX - s.lastPanPos.x;
          const panDy = midY - s.lastPanPos.y;
          onPan(panDx, panDy);
        }
        s.lastPanPos = { x: midX, y: midY };
        s.hasMoved = true;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const s = stateRef.current;
      clearLongPress();

      if (e.touches.length === 0) {
        // All fingers released
        const elapsed = Date.now() - s.startTime;

        if (!s.hasMoved && !s.isPinching && elapsed < LONG_PRESS_MS && s.startTouches[0]) {
          // Quick tap - reveal cell
          onTap(s.startTouches[0].clientX, s.startTouches[0].clientY);
        }

        // Reset state
        s.isPinching = false;
        s.isPanning = false;
        s.lastPinchDist = 0;
        s.lastPanPos = null;
        s.hasMoved = false;
      } else if (e.touches.length === 1) {
        // Went from 2 fingers to 1 - keep tracking for pan
        s.isPinching = false;
        s.lastPanPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const handleTouchCancel = () => {
      clearLongPress();
      const s = stateRef.current;
      s.isPinching = false;
      s.isPanning = false;
      s.lastPinchDist = 0;
      s.lastPanPos = null;
      s.hasMoved = false;
    };

    // Use passive: false for touchmove to allow preventDefault if needed
    canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: true });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: true });
    canvas.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      clearLongPress();
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [canvasRef, onTap, onLongPress, onPan, onZoom, clearLongPress]);
}
