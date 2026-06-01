"use client";

import { BulkActionsToolbar, type BulkOperation } from "@/components/admin/bulk-actions-toolbar";
import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";

export type AdminBulkSelectionBridge = {
  selectedIds: readonly string[];
  operations: readonly BulkOperation[];
  clear: () => void;
  isSelected: (id: string) => boolean;
  toggleSelected: (id: string, checked: boolean) => void;
};

type AdminBulkSelectionActions = {
  registerBulk: (bulk: AdminBulkSelectionBridge | null) => void;
};

type AdminBulkSelectionContextValue = AdminBulkSelectionActions & {
  bulk: AdminBulkSelectionBridge | null;
};

const AdminBulkSelectionActionsContext = createContext<AdminBulkSelectionActions | null>(null);
const AdminBulkSelectionBulkContext = createContext<AdminBulkSelectionBridge | null>(null);

/** Shares bulk selection between a list board and shell-level mobile cards. */
export function AdminBulkSelectionProvider({ children }: { children: ReactNode }) {
  const [bulk, setBulk] = useState<AdminBulkSelectionBridge | null>(null);

  const registerBulk = useCallback((next: AdminBulkSelectionBridge | null) => {
    setBulk(next);
  }, []);

  const actions = useMemo(() => ({ registerBulk }), [registerBulk]);

  return (
    <AdminBulkSelectionActionsContext.Provider value={actions}>
      <AdminBulkSelectionBulkContext.Provider value={bulk}>
        {children}
      </AdminBulkSelectionBulkContext.Provider>
    </AdminBulkSelectionActionsContext.Provider>
  );
}

export function useAdminBulkSelectionActions(): AdminBulkSelectionActions | null {
  return useContext(AdminBulkSelectionActionsContext);
}

export function useAdminBulkSelectionBulk(): AdminBulkSelectionBridge | null {
  return useContext(AdminBulkSelectionBulkContext);
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
