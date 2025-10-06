import { create } from "zustand";
import { Layer } from "@/types/canvas";

interface ClipboardStore {
  copiedLayers: Layer[];
  setCopiedLayers: (layers: Layer[]) => void;
  clearClipboard: () => void;
}

export const useClipboard = create<ClipboardStore>((set) => ({
  copiedLayers: [],
  setCopiedLayers: (layers: Layer[]) => set({ copiedLayers: layers }),
  clearClipboard: () => set({ copiedLayers: [] }),
}));