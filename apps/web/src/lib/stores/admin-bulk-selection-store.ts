import type { BulkOperation } from "@/components/admin/bulk-actions-toolbar";
import { create } from "zustand";

export type AdminBulkSelectionBridge = {
  selectedIds: readonly string[];
  operations: readonly BulkOperation[];
  clear: () => void;
  isSelected: (id: string) => boolean;
  toggleSelected: (id: string, checked: boolean) => void;
};

type AdminBulkSelectionStore = {
  bulk: AdminBulkSelectionBridge | null;
  registerBulk: (bulk: AdminBulkSelectionBridge | null) => void;
};

/** UI-only cross-route bulk selection (Zustand — no server data). */
export const useAdminBulkSelectionStore = create<AdminBulkSelectionStore>((set) => ({
  bulk: null,
  registerBulk: (bulk) => set({ bulk }),
}));
