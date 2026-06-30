"use client";

import { BulkActionsToolbar } from "@/components/admin/bulk-actions-toolbar";
import {
  type AdminBulkSelectionBridge,
  useAdminBulkSelectionStore,
} from "@/lib/stores/admin-bulk-selection-store";
import type { ReactNode } from "react";

export type { AdminBulkSelectionBridge };

type AdminBulkSelectionActions = {
  registerBulk: (bulk: AdminBulkSelectionBridge | null) => void;
};

type AdminBulkSelectionContextValue = AdminBulkSelectionActions & {
  bulk: AdminBulkSelectionBridge | null;
};

/** Legacy wrapper — bulk selection state lives in Zustand (no Context re-renders). */
export function AdminBulkSelectionProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useAdminBulkSelectionActions(): AdminBulkSelectionActions | null {
  const registerBulk = useAdminBulkSelectionStore((s) => s.registerBulk);
  return { registerBulk };
}

export function useAdminBulkSelectionBulk(): AdminBulkSelectionBridge | null {
  return useAdminBulkSelectionStore((s) => s.bulk);
}

export function useAdminBulkSelection(): AdminBulkSelectionContextValue | null {
  const actions = useAdminBulkSelectionActions();
  const bulk = useAdminBulkSelectionBulk();
  if (!actions) return null;
  return { ...actions, bulk };
}

/** Renders bulk actions registered by a list board (visible on shell chrome). */
export function AdminBulkSelectionBar() {
  const bulk = useAdminBulkSelectionBulk();
  if (!bulk || bulk.selectedIds.length === 0) return null;

  return (
    <BulkActionsToolbar
      selectedIds={[...bulk.selectedIds]}
      operations={[...bulk.operations]}
      onClear={bulk.clear}
    />
  );
}
