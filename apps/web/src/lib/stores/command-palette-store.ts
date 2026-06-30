import { create } from "zustand";

type CommandPaletteStore = {
  pendingOpen: boolean;
  requestOpen: () => void;
  takePendingOpen: () => boolean;
  clearPendingOpen: () => void;
};

/** UI-only command palette open coordination (Zustand — no server data). */
export const useCommandPaletteStore = create<CommandPaletteStore>((set, get) => ({
  pendingOpen: false,
  requestOpen: () => set({ pendingOpen: true }),
  takePendingOpen: () => {
    const wasPending = get().pendingOpen;
    set({ pendingOpen: false });
    return wasPending;
  },
  clearPendingOpen: () => set({ pendingOpen: false }),
}));
