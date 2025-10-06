"use client";

import React, { useState, useEffect } from "react";
import { 
  Download, 
  Trash2, 
  BringToFront, 
  SendToBack,
  Copy,
  Scissors,
  Image,
  FileText
} from "lucide-react";
import { useDeleteLayers } from "@/hooks/use-delete-layers";
import { useMutation, useSelf, useStorage } from "@/liveblocks.config";
import { Camera, Layer } from "@/types/canvas";
import { exportSelectedElements } from "@/lib/export-utils";

interface SelectionContextMenuProps {
  isVisible: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  camera: Camera;
}

export const SelectionContextMenu = React.memo(({
  isVisible,
  position,
  onClose,
  camera
}: SelectionContextMenuProps) => {
  const selection = useSelf((me) => me?.presence.selection);
  const layers = useStorage((root) => root.layers);
  const deleteLayers = useDeleteLayers();

  const [isExporting, setIsExporting] = useState(false);

  const moveToBack = useMutation(
    ({ storage }) => {
      const liveLayerIds = storage.get("layerIds");
      const indices: number[] = [];
      const arr = liveLayerIds.toImmutable();

      for (let i = 0; i < arr.length; i++) {
        if (selection.includes(arr[i])) {
          indices.push(i);
        }
      }

      for (let i = 0; i < indices.length; i++) {
        liveLayerIds.move(indices[i], i);
      }
      onClose();
    },
    [selection, onClose]
  );

  const moveToFront = useMutation(
    ({ storage }) => {
      const liveLayerIds = storage.get("layerIds");
      const indices: number[] = [];
      const arr = liveLayerIds.toImmutable();

      for (let i = 0; i < arr.length; i++) {
        if (selection.includes(arr[i])) {
          indices.push(i);
        }
      }

      for (let i = indices.length - 1; i >= 0; i--) {
        liveLayerIds.move(
          indices[i],
          arr.length - 1 - (indices.length - 1 - i)
        );
      }
      onClose();
    },
    [selection, onClose]
  );

  const handleExport = async (format: 'svg' | 'png' | 'jpg' | 'pdf') => {
    if (isExporting || !selection || selection.length === 0) return;
    
    setIsExporting(true);
    try {
      // Get selected layers data
      const selectedLayers = selection
        .map((layerId) => layers.get(layerId))
        .filter((layer): layer is Layer => layer !== undefined);
      
      await exportSelectedElements(selectedLayers, format, camera);
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = () => {
    deleteLayers();
    onClose();
  };

  const handleCopy = () => {
    // TODO: Implement copy functionality
    console.log('Copy functionality not implemented yet');
    onClose();
  };

  const handleCut = () => {
    // TODO: Implement cut functionality
    console.log('Cut functionality not implemented yet');
    onClose();
  };

  // Close menu when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.context-menu')) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVisible, onClose]);

  if (!isVisible || !selection || selection.length === 0) {
    return null;
  }

  return (
    <div
      className="context-menu fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[200px] backdrop-blur-lg"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(0, 0)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Export Options */}
      <div className="px-2 py-1 text-xs font-medium text-gray-500 border-b border-gray-100">
        Export Selection
      </div>
      
      <button
        onClick={() => handleExport('png')}
        disabled={isExporting}
        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Image className="h-4 w-4" aria-label="PNG export icon" />
        Export as PNG
      </button>
      
      <button
        onClick={() => handleExport('svg')}
        disabled={isExporting}
        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <FileText className="h-4 w-4" />
        Export as SVG
      </button>
      
      <button
        onClick={() => handleExport('jpg')}
        disabled={isExporting}
        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Image className="h-4 w-4" aria-label="JPG export icon" />
        Export as JPG
      </button>
      
      <button
        onClick={() => handleExport('pdf')}
        disabled={isExporting}
        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Download className="h-4 w-4" />
        Export as PDF
      </button>

      <div className="border-t border-gray-100 mt-1 mb-1" />

      {/* Layer Actions */}
      <button
        onClick={moveToFront}
        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <BringToFront className="h-4 w-4" />
        Bring to Front
      </button>
      
      <button
        onClick={moveToBack}
        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <SendToBack className="h-4 w-4" />
        Send to Back
      </button>

      <div className="border-t border-gray-100 mt-1 mb-1" />

      {/* Edit Actions */}
      <button
        onClick={handleCopy}
        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Copy className="h-4 w-4" />
        Copy
      </button>
      
      <button
        onClick={handleCut}
        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Scissors className="h-4 w-4" />
        Cut
      </button>

      <div className="border-t border-gray-100 mt-1 mb-1" />

      {/* Delete Action */}
      <button
        onClick={handleDelete}
        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
      >
        <Trash2 className="h-4 w-4" />
        Delete
      </button>
    </div>
  );
});

SelectionContextMenu.displayName = "SelectionContextMenu";