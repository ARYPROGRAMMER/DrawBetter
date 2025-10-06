"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Info from "./info";
import Participants from "./participants";
import ToolBar from "./toolbar";
import ColorPalette from "./color-palette";
import {
  Camera,
  CanvasMode,
  CanvasState,
  Color,
  LayerType,
  Point,
  Side,
  XYWH,
} from "@/types/canvas";
import {
  useHistory,
  useCanRedo,
  useCanUndo,
  useMutation,
  useStorage,
  useOthersMapped,
  useSelf,
} from "@/liveblocks.config";
import { CursorsPresence } from "./cursors-presence";
import {
  colorToCss,
  connectionIdToColor,
  findIntersectingLayersWithRectangle,
  penPointsToPathLayer,
  pointerEventToCanvasPoint,
  resizeBounds,
} from "@/lib/utils";
import { nanoid } from "nanoid";
import { LiveObject } from "@liveblocks/client";
import { LayerPreview } from "./layer-preview";
import { SelectionBox } from "./selection-box";
import { SelectionTools } from "./selection-tools";
import { SelectionContextMenu } from "./selection-context-menu";
import { Path } from "./path";
import { useDeleteLayers } from "@/hooks/use-delete-layers";

const MAX_LAYERS = Number.POSITIVE_INFINITY;

interface CanvasProps {
  drawId: string;
}

const Canvas = ({ drawId }: CanvasProps) => {
  const layerIds = useStorage((root) => root.layerIds);

  const pencilDraft = useSelf((me) => me.presence.pencilDraft);

  const [canvasState, setCanvasState] = useState<CanvasState>({
    mode: CanvasMode.None,
  });

  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const cameraRef = useRef(camera);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const middleButtonPanRef = useRef(false);
  const previousModeRef = useRef<CanvasState>({ mode: CanvasMode.None });

  // Keep cameraRef in sync with camera state
  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  const [lastUsedColor, setLastUsedColor] = useState<Color>({
    r: 255,
    g: 255,
    b: 255,
  });

  const [contextMenu, setContextMenu] = useState<{
    isVisible: boolean;
    position: { x: number; y: number };
  }>({
    isVisible: false,
    position: { x: 0, y: 0 },
  });

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };

    window.addEventListener("wheel", handleWheel, {
      passive: false,
      capture: true,
    });

    return () => {
      window.removeEventListener("wheel", handleWheel, true);
    };
  }, []);

  const history = useHistory();
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();

  const insertLayer = useMutation(
    (
      { storage, setMyPresence },
      layerType:
        | LayerType.Ellipse
        | LayerType.Rectangle
        | LayerType.Text
        | LayerType.Note,
      position: Point
    ) => {
      const liveLayers = storage.get("layers");
      if (liveLayers.size >= MAX_LAYERS) {
        return;
      }

      const liveLayerIds = storage.get("layerIds");
      const layerId = nanoid();

      const layer = new LiveObject({
        type: layerType,
        x: position.x,
        y: position.y,
        height: 100,
        width: 100,
        fill: lastUsedColor,
      });

      liveLayerIds.push(layerId);
      liveLayers.set(layerId, layer);

      setMyPresence(
        {
          selection: [layerId],
        },
        {
          addToHistory: true,
        }
      );

      setCanvasState({
        mode: CanvasMode.None,
      });
    },
    [lastUsedColor]
  );

  const panCamera = useCallback(
    (clientX: number, clientY: number) => {
      if (canvasState.mode !== CanvasMode.Panning || !panStartRef.current) {
        return;
      }

      const deltaX = clientX - panStartRef.current.x;
      const deltaY = clientY - panStartRef.current.y;

      // Cancel any pending animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Schedule camera update on next animation frame
      animationFrameRef.current = requestAnimationFrame(() => {
        setCamera((prevCamera) => ({
          ...prevCamera,
          x: prevCamera.x + deltaX,
          y: prevCamera.y + deltaY,
        }));
        panStartRef.current = { x: clientX, y: clientY };
        animationFrameRef.current = null;
      });
    },
    [canvasState.mode, setCamera]
  );

  const translateSelectedLayers = useMutation(
    ({ storage, self }, point: Point) => {
      if (canvasState.mode !== CanvasMode.Translating) {
        return;
      }

      const offset = {
        x: point.x - canvasState.current.x,
        y: point.y - canvasState.current.y,
      };

      const liveLayers = storage.get("layers");

      for (const id of self.presence.selection) {
        const layer = liveLayers.get(id);

        if (layer) {
          layer.update({
            x: layer.get("x") + offset.x,
            y: layer.get("y") + offset.y,
          });
        }
      }

      setCanvasState({
        mode: CanvasMode.Translating,
        current: point,
      });
    },
    [canvasState]
  );

  const unSelectLayers = useMutation(({ self, setMyPresence }) => {
    if (self.presence.selection.length > 0) {
      setMyPresence(
        {
          selection: [],
        },
        { addToHistory: true }
      );
    }
  }, []);

  const updateSelectionNet = useMutation(
    ({ storage, setMyPresence }, current: Point, origin: Point) => {
      const layers = storage.get("layers").toImmutable();
      setCanvasState({
        mode: CanvasMode.SelectionNet,
        origin,
        current,
      });

      const ids = findIntersectingLayersWithRectangle(
        layerIds,
        layers,
        origin,
        current
      );

      setMyPresence({ selection: ids });
    },
    [layerIds]
  );

  const startMultiSelection = useCallback((current: Point, origin: Point) => {
    if (Math.abs(current.x - origin.x) + Math.abs(current.y - origin.y) > 5) {
      setCanvasState({
        mode: CanvasMode.SelectionNet,
        origin,
        current,
      });
    }
  }, []);

  const continueDrawing = useMutation(
    ({ self, setMyPresence }, point: Point, e: React.PointerEvent) => {
      const { pencilDraft } = self.presence;

      if (
        canvasState.mode !== CanvasMode.Pencil ||
        e.buttons !== 1 ||
        pencilDraft == null
      ) {
        return;
      }
      setMyPresence({
        cursor: point,
        pencilDraft:
          pencilDraft.length === 1 &&
          pencilDraft[0][0] === point.x &&
          pencilDraft[0][1] === point.y
            ? pencilDraft
            : [...pencilDraft, [point.x, point.y, e.pressure]],
      });
    },
    [canvasState.mode]
  );

  const insertPath = useMutation(
    ({ storage, self, setMyPresence }) => {
      const liveLayers = storage.get("layers");
      const { pencilDraft } = self.presence;

      if (
        pencilDraft == null ||
        pencilDraft.length < 1 ||
        liveLayers.size >= MAX_LAYERS
      ) {
        setMyPresence({
          pencilDraft: null,
        });

        return;
      }

      const id = nanoid();

      liveLayers.set(
        id,
        new LiveObject(penPointsToPathLayer(pencilDraft, lastUsedColor))
      );

      const liveLayerIds = storage.get("layerIds");

      liveLayerIds.push(id);

      setMyPresence({
        pencilDraft: null,
      });

      setCanvasState({
        mode: CanvasMode.Pencil,
      });
    },
    [lastUsedColor]
  );

  const startDrawing = useMutation(
    ({ setMyPresence }, point: Point, pressure: number) => {
      setMyPresence({
        pencilDraft: [[point.x, point.y, pressure]],
        penColor: lastUsedColor,
      });
    },
    [lastUsedColor]
  );

  const resizeSelectedLayer = useMutation(
    ({ storage, self }, point: Point) => {
      if (canvasState.mode !== CanvasMode.Resizing) {
        return;
      }

      const bounds = resizeBounds(
        canvasState.initialBounds,
        canvasState.corner,
        point
      );

      const liveLayers = storage.get("layers");

      const layer = liveLayers.get(self.presence.selection[0]);

      if (layer) {
        layer.update(bounds);
      }
    },
    [canvasState]
  );

  const onResizeHandlePointerDown = useCallback(
    (corner: Side, initialBounds: XYWH) => {
      history.pause();
      setCanvasState({
        mode: CanvasMode.Resizing,
        initialBounds,
        corner,
      });
    },
    [history]
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey) {
        // Zoom functionality
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(5, camera.zoom * zoomFactor));

        // Calculate zoom center point
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        const centerX = e.clientX - rect.left;
        const centerY = e.clientY - rect.top;

        // Adjust camera position to zoom towards mouse cursor
        const zoomChange = newZoom / camera.zoom;
        const newX = centerX - (centerX - camera.x) * zoomChange;
        const newY = centerY - (centerY - camera.y) * zoomChange;

        setCamera({
          x: newX,
          y: newY,
          zoom: newZoom,
        });
      } else {
        // Pan functionality
        setCamera((camera) => ({
          ...camera,
          x: camera.x - e.deltaX,
          y: camera.y - e.deltaY,
        }));
      }
    },
    [camera]
  );

  const onPointerMove = useMutation(
    ({ setMyPresence }, e: React.PointerEvent) => {
      e.preventDefault();

      const current = pointerEventToCanvasPoint(e, camera);

      if (canvasState.mode === CanvasMode.Pressing) {
        startMultiSelection(current, canvasState.origin);
      } else if (canvasState.mode === CanvasMode.SelectionNet) {
        updateSelectionNet(current, canvasState.origin);
      } else if (canvasState.mode === CanvasMode.Translating) {
        translateSelectedLayers(current);
      } else if (canvasState.mode === CanvasMode.Resizing) {
        resizeSelectedLayer(current);
      } else if (canvasState.mode === CanvasMode.Pencil) {
        continueDrawing(current, e);
      } else if (canvasState.mode === CanvasMode.Panning) {
        if (e.buttons & (1 | 4)) {
          // Left or middle mouse button
          panCamera(e.clientX, e.clientY);
        }
        // Don't update cursor position during panning to avoid feedback loop
        return;
      }

      setMyPresence({ cursor: current });
    },
    [
      startMultiSelection,
      updateSelectionNet,
      canvasState,
      resizeSelectedLayer,
      camera,
      translateSelectedLayers,
      continueDrawing,
      panCamera,
    ]
  );

  const onPointerLeave = useMutation(({ setMyPresence }) => {
    setMyPresence({
      cursor: null,
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu({
      isVisible: false,
      position: { x: 0, y: 0 },
    });
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Close context menu on any pointer down
      closeContextMenu();

      const point = pointerEventToCanvasPoint(e, camera);

      if (e.button === 1) {
        // Middle mouse button
        middleButtonPanRef.current = true;
        previousModeRef.current = canvasState;
        panStartRef.current = { x: e.clientX, y: e.clientY };
        setCanvasState({ mode: CanvasMode.Panning });
        return;
      }

      if (canvasState.mode === CanvasMode.Inserting) {
        return;
      }

      if (canvasState.mode === CanvasMode.Pencil) {
        startDrawing(point, e.pressure);

        return;
      }

      if (canvasState.mode === CanvasMode.Panning) {
        panStartRef.current = { x: e.clientX, y: e.clientY };
        setCanvasState({
          mode: CanvasMode.Panning,
        });
        return;
      }

      setCanvasState({
        origin: point,
        mode: CanvasMode.Pressing,
      });
    },
    [camera, setCanvasState, startDrawing, canvasState, closeContextMenu]
  );

  const onPointerUp = useMutation(
    ({}, e) => {
      const point = pointerEventToCanvasPoint(e, camera);

      if (
        canvasState.mode === CanvasMode.None ||
        canvasState.mode === CanvasMode.Pressing
      ) {
        unSelectLayers();

        setCanvasState({
          mode: CanvasMode.None,
        });
      } else if (canvasState.mode === CanvasMode.Pencil) {
        insertPath();
      } else if (canvasState.mode === CanvasMode.Inserting) {
        insertLayer(canvasState.layerType, point);
      } else if (canvasState.mode === CanvasMode.Panning) {
        // Clean up pan state
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        panStartRef.current = null;
        if (middleButtonPanRef.current) {
          middleButtonPanRef.current = false;
          setCanvasState(previousModeRef.current);
        } else {
          setCanvasState({
            mode: CanvasMode.Panning,
          });
        }
      } else {
        setCanvasState({
          mode: CanvasMode.None,
        });
      }

      history.resume();
    },
    [
      camera,
      canvasState,
      history,
      insertLayer,
      unSelectLayers,
      insertPath,
      setCanvasState,
    ]
  );

  const selections = useOthersMapped((other) => other.presence.selection);

  const onLayerPointerDown = useMutation(
    ({ self, setMyPresence }, e: React.PointerEvent, layerId: string) => {
      if (
        canvasState.mode === CanvasMode.Pencil ||
        canvasState.mode === CanvasMode.Inserting ||
        canvasState.mode === CanvasMode.Panning
      ) {
        return;
      }
      history.pause();
      e.stopPropagation();

      const point = pointerEventToCanvasPoint(e, camera);

      if (!self.presence.selection.includes(layerId)) {
        setMyPresence(
          {
            selection: [layerId],
          },
          { addToHistory: true }
        );
      }

      setCanvasState({
        mode: CanvasMode.Translating,
        current: point,
      });
    },
    [setCanvasState, camera, history, canvasState.mode]
  );

  const layerIdsToColorSelection = useMemo(() => {
    const layerIdsToColorSelection: Record<string, string> = {};

    for (const user of selections) {
      const [connectionId, selection] = user;

      for (const layerId of selection) {
        layerIdsToColorSelection[layerId] = connectionIdToColor(connectionId);
      }
    }

    return layerIdsToColorSelection;
  }, [selections]);

  const deleteLayers = useDeleteLayers();

  const selection = useSelf((me) => me?.presence.selection);

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      
      // Only show context menu if there are selected elements
      if (!selection || selection.length === 0) {
        return;
      }

      // Get the mouse position relative to the viewport
      const rect = (e.target as Element).getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;

      setContextMenu({
        isVisible: true,
        position: { x, y },
      });
    },
    [selection]
  );



  // Close context menu when selection changes
  useEffect(() => {
    closeContextMenu();
  }, [selection, closeContextMenu]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      switch (e.key) {
  
        case "v":
        case "V": {
          e.preventDefault();
          setCanvasState({ mode: CanvasMode.None });
          break;
        }
        case "h":
        case "H": {
          e.preventDefault();
          setCanvasState({ mode: CanvasMode.Panning });
          break;
        }
        case "t":
        case "T": {
          e.preventDefault();
          setCanvasState({
            mode: CanvasMode.Inserting,
            layerType: LayerType.Text,
          });
          break;
        }
        case "n":
        case "N": {
          e.preventDefault();
          setCanvasState({
            mode: CanvasMode.Inserting,
            layerType: LayerType.Note,
          });
          break;
        }
        case "r":
        case "R": {
          e.preventDefault();
          setCanvasState({
            mode: CanvasMode.Inserting,
            layerType: LayerType.Rectangle,
          });
          break;
        }
        case "o":
        case "O": {
          e.preventDefault();
          setCanvasState({
            mode: CanvasMode.Inserting,
            layerType: LayerType.Ellipse,
          });
          break;
        }
        case "p":
        case "P": {
          e.preventDefault();
          setCanvasState({
            mode: CanvasMode.Pencil,
          });
          break;
        }
        
        case "z": {
          if (e.ctrlKey || e.metaKey) {
            if (e.shiftKey) {
              history.redo();
            } else {
              history.undo();
            }
            break;
          }
        }
        // Zoom shortcuts
        case "=":
        case "+": {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setCamera((prevCamera) => ({
              ...prevCamera,
              zoom: Math.min(5, prevCamera.zoom * 1.2),
            }));
          }
          break;
        }
        case "-": {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setCamera((prevCamera) => ({
              ...prevCamera,
              zoom: Math.max(0.1, prevCamera.zoom / 1.2),
            }));
          }
          break;
        }
        case "0": {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setCamera({ x: 0, y: 0, zoom: 1 });
          }
          break;
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [deleteLayers, history, setCanvasState]);

  return (
    <main
      className={`h-full w-full relative bg-neutral-100 touch-none ${
        canvasState.mode === CanvasMode.Panning
          ? "cursor-grab"
          : canvasState.mode === CanvasMode.Pencil
            ? "cursor-pointer"
            : canvasState.mode === CanvasMode.Inserting
              ? "cursor-crosshair"
              : ""
      }`}
    >
      <Info drawId={drawId} />
      <Participants />
      <ToolBar
        canvasState={canvasState}
        setCanvasState={setCanvasState}
        undo={history.undo}
        redo={history.redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      <ColorPalette onChange={setLastUsedColor} currentColor={lastUsedColor} />

      <SelectionTools camera={camera} setLastUsedColor={setLastUsedColor} />

      <svg
        className="h-[100vh] w-[100vw]"
        onWheel={onWheel}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onPointerUp={onPointerUp}
        onPointerDown={onPointerDown}
        onContextMenu={onContextMenu}
      >
        <g
          style={{
            transform: `translate(${camera.x}px , ${camera.y}px) scale(${camera.zoom})`,
          }}
        >
          {layerIds.map((layerId) => (
            <LayerPreview
              key={layerId}
              id={layerId}
              onLayerPointerDown={onLayerPointerDown}
              selectionColor={layerIdsToColorSelection[layerId]}
            />
          ))}

          <SelectionBox onResizeHandlePointerDown={onResizeHandlePointerDown} />
          {canvasState.mode === CanvasMode.SelectionNet &&
            canvasState.current != null && (
              <rect
                className="fill-blue-500/5 stroke-blue-500 stroke-1"
                x={Math.min(canvasState.origin.x, canvasState.current.x)}
                y={Math.min(canvasState.origin.y, canvasState.current.y)}
                width={Math.abs(canvasState.current.x - canvasState.origin.x)}
                height={Math.abs(canvasState.current.y - canvasState.origin.y)}
              />
            )}

          <CursorsPresence />

          {pencilDraft != null && pencilDraft.length > 0 && (
            <Path
              points={pencilDraft}
              fill={colorToCss(lastUsedColor)}
              x={0}
              y={0}
            />
          )}
        </g>
      </svg>
      
      <SelectionContextMenu
        isVisible={contextMenu.isVisible}
        position={contextMenu.position}
        onClose={closeContextMenu}
        camera={camera}
        setLastUsedColor={setLastUsedColor}
      />
    </main>
  );
};

export default Canvas;
