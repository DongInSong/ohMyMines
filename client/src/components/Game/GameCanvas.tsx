import { useRef, useEffect, useState, useCallback } from 'react';
import type { Position } from 'shared';
import { GameRenderer } from '../../canvas/renderer';
import { useViewport } from '../../hooks/useViewport';
import { useGame } from '../../hooks/useGame';
import { useGameStore } from '../../stores/gameStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useTouchGestures } from '../../hooks/useTouchGestures';

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const animationFrameRef = useRef<number>();
  const [hoveredCell, setHoveredCell] = useState<Position | null>(null);

  const {
    viewport,
    screenToWorld,
    getVisibleChunks,
    pan,
    zoom,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  } = useViewport(canvasRef);

  const { loadVisibleChunks, handleCellClick, handleCellRightClick } = useGame();

  const visibleCells = useGameStore((s) => s.visibleCells);
  const otherCursors = useGameStore((s) => s.otherCursors);
  const scanHighlights = useGameStore((s) => s.scanHighlights);
  const treasures = useGameStore((s) => s.treasures);
  const consumeExplosions = useGameStore((s) => s.consumeExplosions);
  const consumeReveals = useGameStore((s) => s.consumeReveals);
  const setCursorPosition = useGameStore((s) => s.setCursorPosition);
  const player = usePlayerStore((s) => s.player);

  // Initialize renderer
  useEffect(() => {
    if (canvasRef.current) {
      rendererRef.current = new GameRenderer(canvasRef.current);
    }
  }, []);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && rendererRef.current) {
        const parent = canvasRef.current.parentElement;
        if (parent) {
          rendererRef.current.resize(parent.clientWidth, parent.clientHeight);
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load visible chunks
  useEffect(() => {
    const chunks = getVisibleChunks();
    loadVisibleChunks(chunks);
  }, [viewport.center, viewport.zoom, getVisibleChunks, loadVisibleChunks]);

  // Animation loop
  useEffect(() => {
    const render = () => {
      if (rendererRef.current) {
        // Check for pending explosions and trigger them
        const explosions = consumeExplosions();
        for (const pos of explosions) {
          rendererRef.current.triggerExplosion(pos.x, pos.y);
        }

        // Check for pending reveals and trigger them
        const reveals = consumeReveals();
        for (const reveal of reveals) {
          rendererRef.current.triggerReveal(reveal.cells);
        }

        rendererRef.current.render(
          viewport.center,
          viewport.zoom,
          visibleCells,
          otherCursors,
          player?.id,
          scanHighlights,
          hoveredCell,
          treasures
        );
      }
      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [viewport, visibleCells, otherCursors, player?.id, scanHighlights, hoveredCell, treasures, consumeExplosions, consumeReveals]);

  // Handle mouse events
  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      handleMouseMove(e);
    },
    [handleMouseMove]
  );

  // Global mousemove for smooth hover tracking
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const isOverCanvas =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      if (isOverCanvas) {
        const worldPos = screenToWorld(e.clientX, e.clientY);
        setHoveredCell(worldPos);
        setCursorPosition(worldPos);
      } else {
        setHoveredCell(null);
        setCursorPosition(null);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, [screenToWorld, setCursorPosition]);

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      console.log('[Canvas] Click event', { button: e.button, isDragging: viewport.isDragging });
      if (viewport.isDragging) return;

      const worldPos = screenToWorld(e.clientX, e.clientY);
      console.log('[Canvas] World position', worldPos);

      if (e.button === 0 && !e.shiftKey) {
        handleCellClick(worldPos);
      }
    },
    [viewport.isDragging, screenToWorld, handleCellClick]
  );

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const worldPos = screenToWorld(e.clientX, e.clientY);
      handleCellRightClick(worldPos);
    },
    [screenToWorld, handleCellRightClick]
  );

  // Touch gesture handlers
  const onTouchTap = useCallback(
    (screenX: number, screenY: number) => {
      const worldPos = screenToWorld(screenX, screenY);
      handleCellClick(worldPos);
    },
    [screenToWorld, handleCellClick]
  );

  const onTouchLongPress = useCallback(
    (screenX: number, screenY: number) => {
      const worldPos = screenToWorld(screenX, screenY);
      handleCellRightClick(worldPos);
    },
    [screenToWorld, handleCellRightClick]
  );

  const onTouchPan = useCallback(
    (deltaX: number, deltaY: number) => {
      pan(deltaX, deltaY);
    },
    [pan]
  );

  const onTouchZoom = useCallback(
    (delta: number) => {
      zoom(delta);
    },
    [zoom]
  );

  useTouchGestures({
    canvasRef: canvasRef as React.RefObject<HTMLCanvasElement>,
    onTap: onTouchTap,
    onLongPress: onTouchLongPress,
    onPan: onTouchPan,
    onZoom: onTouchZoom,
  });

  return (
    <div className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        id="game-canvas"
        className="absolute inset-0"
        onMouseDown={handleMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={onClick}
        onContextMenu={onContextMenu}
      />

      {/* Mouse position display - centered at bottom */}
      {hoveredCell && (
        <div className="absolute bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 z-[5] mouse-pos-bar pointer-events-none">
          <div className="mouse-pos-inner" />
          <span className="mouse-pos-icon" />
          <span className="mouse-pos-label">X</span>
          <span className="mouse-pos-value">{hoveredCell.x}</span>
          <span className="mouse-pos-sep">|</span>
          <span className="mouse-pos-label">Y</span>
          <span className="mouse-pos-value">{hoveredCell.y}</span>
          {rendererRef.current && (
            <>
              <span className="mouse-pos-sep">|</span>
              <span className="mouse-pos-zone">
                {rendererRef.current.getZoneAtPosition(hoveredCell.x, hoveredCell.y)}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
