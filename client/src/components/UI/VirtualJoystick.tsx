import { useState, useRef, useEffect, useCallback } from 'react';

interface VirtualJoystickProps {
  onMove: (deltaX: number, deltaY: number) => void;
}

const OUTER_RADIUS = 50;
const INNER_RADIUS = 20;
const MAX_DISTANCE = OUTER_RADIUS - INNER_RADIUS;

export function VirtualJoystick({ onMove }: VirtualJoystickProps) {
  const [active, setActive] = useState(false);
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const centerRef = useRef({ x: 0, y: 0 });
  const animFrameRef = useRef<number | null>(null);
  const stickRef = useRef({ x: 0, y: 0 });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    const touch = e.touches[0];
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    centerRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    setActive(true);

    const dx = touch.clientX - centerRef.current.x;
    const dy = touch.clientY - centerRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, MAX_DISTANCE);
    const angle = Math.atan2(dy, dx);
    const cx = Math.cos(angle) * clampedDist;
    const cy = Math.sin(angle) * clampedDist;
    setStickPos({ x: cx, y: cy });
    stickRef.current = { x: cx, y: cy };
  }, []);

  useEffect(() => {
    if (!active) return;

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      const dx = touch.clientX - centerRef.current.x;
      const dy = touch.clientY - centerRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const clampedDist = Math.min(dist, MAX_DISTANCE);
      const angle = Math.atan2(dy, dx);
      const cx = Math.cos(angle) * clampedDist;
      const cy = Math.sin(angle) * clampedDist;
      setStickPos({ x: cx, y: cy });
      stickRef.current = { x: cx, y: cy };
    };

    const handleTouchEnd = () => {
      setActive(false);
      setStickPos({ x: 0, y: 0 });
      stickRef.current = { x: 0, y: 0 };
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [active]);

  // Continuous movement loop
  useEffect(() => {
    const tick = () => {
      const { x, y } = stickRef.current;
      if (Math.abs(x) > 2 || Math.abs(y) > 2) {
        const speed = Math.sqrt(x * x + y * y) / MAX_DISTANCE;
        const moveX = (x / MAX_DISTANCE) * speed * 8;
        const moveY = (y / MAX_DISTANCE) * speed * 8;
        onMove(moveX, moveY);
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [onMove]);

  return (
    <div
      className="virtual-joystick"
      onTouchStart={handleTouchStart}
    >
      {/* Outer ring */}
      <div
        className="virtual-joystick-outer"
        style={{
          width: OUTER_RADIUS * 2,
          height: OUTER_RADIUS * 2,
        }}
      >
        {/* Inner stick */}
        <div
          className={`virtual-joystick-inner ${active ? 'active' : ''}`}
          style={{
            width: INNER_RADIUS * 2,
            height: INNER_RADIUS * 2,
            transform: `translate(${stickPos.x}px, ${stickPos.y}px)`,
          }}
        />
      </div>
    </div>
  );
}
