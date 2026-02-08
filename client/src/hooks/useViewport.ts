import { useState, useCallback, useEffect, useRef } from 'react';
import type { Position } from 'shared';
import { CELL_SIZE, RENDER, CHUNK_SIZE } from 'shared';
import { useGameStore } from '../stores/gameStore';
import { usePlayerStore } from '../stores/playerStore';

interface ViewportState {
  center: Position;
  zoom: number;
  isDragging: boolean;
}

export function useViewport(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const [viewport, setViewport] = useState<ViewportState>({
    center: { x: 100, y: 100 },
    zoom: 1,
    isDragging: false,
  });

  const dragStartRef = useRef<Position | null>(null);
  const lastCenterRef = useRef<Position>({ x: 100, y: 100 });
  const isDraggingRef = useRef(false);
  const zoomRef = useRef(1);
  const rafRef = useRef<number | null>(null);

  const setViewportCenter = useGameStore((s) => s.setViewportCenter);
  const setZoom = useGameStore((s) => s.setZoom);
  const navigationTarget = useGameStore((s) => s.navigationTarget);
  const clearNavigationTarget = useGameStore((s) => s.clearNavigationTarget);
  const activeSkills = usePlayerStore((s) => s.activeSkills);

  const isSpeedActive = activeSkills.includes('speed');

  // Convert screen coordinates to world coordinates
  const screenToWorld = useCallback(
    (screenX: number, screenY: number): Position => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      const canvasX = screenX - rect.left;
      const canvasY = screenY - rect.top;

      const cellSize = CELL_SIZE * viewport.zoom;
      const offsetX = canvas.width / 2 - viewport.center.x * cellSize;
      const offsetY = canvas.height / 2 - viewport.center.y * cellSize;

      return {
        x: Math.floor((canvasX - offsetX) / cellSize),
        y: Math.floor((canvasY - offsetY) / cellSize),
      };
    },
    [viewport.center, viewport.zoom, canvasRef]
  );

  // Convert world coordinates to screen coordinates
  const worldToScreen = useCallback(
    (worldX: number, worldY: number): Position => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const cellSize = CELL_SIZE * viewport.zoom;
      const offsetX = canvas.width / 2 - viewport.center.x * cellSize;
      const offsetY = canvas.height / 2 - viewport.center.y * cellSize;

      return {
        x: offsetX + worldX * cellSize,
        y: offsetY + worldY * cellSize,
      };
    },
    [viewport.center, viewport.zoom, canvasRef]
  );

  // Get visible chunk coordinates
  const getVisibleChunks = useCallback((): { cx: number; cy: number }[] => {
    const canvas = canvasRef.current;
    if (!canvas) return [];

    const cellSize = CELL_SIZE * viewport.zoom;
    const visibleCellsX = Math.ceil(canvas.width / cellSize) + 2;
    const visibleCellsY = Math.ceil(canvas.height / cellSize) + 2;

    const startX = Math.max(0, Math.floor(viewport.center.x - visibleCellsX / 2));
    const startY = Math.max(0, Math.floor(viewport.center.y - visibleCellsY / 2));
    const endX = Math.min(999, Math.ceil(viewport.center.x + visibleCellsX / 2));
    const endY = Math.min(999, Math.ceil(viewport.center.y + visibleCellsY / 2));

    const chunks: { cx: number; cy: number }[] = [];
    const startCX = Math.floor(startX / CHUNK_SIZE);
    const startCY = Math.floor(startY / CHUNK_SIZE);
    const endCX = Math.floor(endX / CHUNK_SIZE);
    const endCY = Math.floor(endY / CHUNK_SIZE);

    for (let cy = startCY; cy <= endCY; cy++) {
      for (let cx = startCX; cx <= endCX; cx++) {
        chunks.push({ cx, cy });
      }
    }

    return chunks;
  }, [viewport.center, viewport.zoom, canvasRef]);

  // Pan the viewport
  const pan = useCallback(
    (deltaX: number, deltaY: number) => {
      const speed = isSpeedActive ? RENDER.FAST_PAN_MULTIPLIER : 1;
      const cellSize = CELL_SIZE * viewport.zoom;

      setViewport((prev) => {
        const newCenter = {
          x: Math.max(0, Math.min(999, prev.center.x - (deltaX * speed) / cellSize)),
          y: Math.max(0, Math.min(999, prev.center.y - (deltaY * speed) / cellSize)),
        };
        return { ...prev, center: newCenter };
      });
    },
    [viewport.zoom, isSpeedActive]
  );

  // Center on position
  const centerOn = useCallback((position: Position) => {
    setViewport((prev) => ({
      ...prev,
      center: {
        x: Math.max(0, Math.min(999, position.x)),
        y: Math.max(0, Math.min(999, position.y)),
      },
    }));
  }, []);

  // Zoom
  const zoom = useCallback((delta: number, centerX?: number, centerY?: number) => {
    setViewport((prev) => {
      const newZoom = Math.max(
        RENDER.MIN_ZOOM,
        Math.min(RENDER.MAX_ZOOM, prev.zoom + delta * RENDER.ZOOM_STEP)
      );
      return { ...prev, zoom: newZoom };
    });
  }, []);

  // Keep zoom ref in sync
  useEffect(() => {
    zoomRef.current = viewport.zoom;
  }, [viewport.zoom]);

  // Mouse event handlers for canvas
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        // Middle click or shift+left click for dragging
        e.preventDefault();
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        lastCenterRef.current = { ...viewport.center };
        isDraggingRef.current = true;
        setViewport((prev) => ({ ...prev, isDragging: true }));
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
      }
    },
    [viewport.center]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Hover detection is handled in GameCanvas
    },
    []
  );

  const handleMouseUp = useCallback(() => {
    // Global handler does the real work
  }, []);

  // Global mouse event handlers for smooth dragging
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !dragStartRef.current) return;

      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;
      const cellSize = CELL_SIZE * zoomRef.current;

      const newCenter = {
        x: Math.max(0, Math.min(999, lastCenterRef.current.x - deltaX / cellSize)),
        y: Math.max(0, Math.min(999, lastCenterRef.current.y - deltaY / cellSize)),
      };

      setViewport((prev) => ({
        ...prev,
        center: newCenter,
      }));
    };

    const handleGlobalMouseUp = () => {
      if (!isDraggingRef.current) return;

      dragStartRef.current = null;
      isDraggingRef.current = false;
      setViewport((prev) => ({ ...prev, isDragging: false }));
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    // Prevent middle-click auto-scroll
    const handleAuxClick = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('auxclick', handleAuxClick);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('auxclick', handleAuxClick);
    };
  }, []);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -1 : 1;
      zoom(delta, e.clientX, e.clientY);
    },
    [zoom]
  );

  // Attach wheel event listener with passive: false to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [canvasRef, handleWheel]);

  // Listen for joystick move events (from VirtualJoystick component)
  useEffect(() => {
    const handleJoystickMove = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        pan(detail.deltaX, detail.deltaY);
      }
    };

    window.addEventListener('joystick-move', handleJoystickMove);
    return () => window.removeEventListener('joystick-move', handleJoystickMove);
  }, [pan]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keyboard navigation when typing in input fields
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return;
      }

      const speed = RENDER.PAN_SPEED * (isSpeedActive ? RENDER.FAST_PAN_MULTIPLIER : 1);

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          pan(0, -speed);
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          pan(0, speed);
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          pan(-speed, 0);
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          pan(speed, 0);
          break;
        case '+':
        case '=':
          zoom(1);
          break;
        case '-':
          zoom(-1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pan, zoom, isSpeedActive]);

  // Respond to navigation requests (from minimap, etc.)
  useEffect(() => {
    if (navigationTarget) {
      centerOn(navigationTarget);
      clearNavigationTarget();
    }
  }, [navigationTarget, centerOn, clearNavigationTarget]);

  // Sync with store
  useEffect(() => {
    setViewportCenter(viewport.center);
    setZoom(viewport.zoom);
  }, [viewport.center, viewport.zoom, setViewportCenter, setZoom]);

  return {
    viewport,
    screenToWorld,
    worldToScreen,
    getVisibleChunks,
    pan,
    centerOn,
    zoom,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}
