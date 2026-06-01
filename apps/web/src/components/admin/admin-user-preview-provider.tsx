"use client";

import { BulkActionsToolbar, type BulkOperation } from "@/components/admin/bulk-actions-toolbar";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

type OpenUserById = (userId: string) => void;

export type AdminUserListBulkBridge = {
  selectedIds: readonly string[];
  operations: readonly BulkOperation[];
  clear: () => void;
  isSelected: (userId: string) => boolean;
  toggleSelected: (userId: string, checked: boolean) => void;
};

type AdminUserPreviewActions = {
  registerOpenUser: (openUser: OpenUserById) => void;
  openUser: OpenUserById;
  registerBulk: (bulk: AdminUserListBulkBridge | null) => void;
};

type AdminUserPreviewContextValue = AdminUserPreviewActions & {
  bulk: AdminUserListBulkBridge | null;
};

const AdminUserPreviewActionsContext = createContext<AdminUserPreviewActions | null>(null);
const AdminUserPreviewBulkContext = createContext<AdminUserListBulkBridge | null>(null);

/** Shares preview drawer + bulk selection between list board and shell-level mobile cards. */
export function AdminUserPreviewProvider({ children }: { children: ReactNode }) {
  const openRef = useRef<OpenUserById>(() => {});
  const [bulk, setBulk] = useState<AdminUserListBulkBridge | null>(null);

  const registerOpenUser = useCallback((openUser: OpenUserById) => {
    openRef.current = openUser;
  }, []);

  const openUser = useCallback((userId: string) => {
    openRef.current(userId);
  }, []);

  const registerBulk = useCallback((next: AdminUserListBulkBridge | null) => {
    setBulk(next);
  }, []);

  const actions = useMemo(
    () => ({ registerOpenUser, openUser, registerBulk }),
    [registerOpenUser, openUser, registerBulk],
  );

  return (
    <AdminUserPreviewActionsContext.Provider value={actions}>
      <AdminUserPreviewBulkContext.Provider value={bulk}>
        {children}
      </AdminUserPreviewBulkContext.Provider>
    </AdminUserPreviewActionsContext.Provider>
  );
}

export function useAdminUserPreviewActions(): AdminUserPreviewActions | null {
  return useContext(AdminUserPreviewActionsContext);
}

export function useAdminUserPreviewBulk(): AdminUserListBulkBridge | null {
  return useContext(AdminUserPreviewBulkContext);
}

export function useAdminUserPreview(): AdminUserPreviewContextValue | null {
  const actions = useAdminUserPreviewActions();
  const bulk = useAdminUserPreviewBulk();
  if (!actions) return null;
  return { ...actions, bulk };
}

/** Renders bulk actions from the list board on shell-level chrome (visible on mobile). */
export function AdminUserListBulkBar() {
  const bulk = useAdminUserPreviewBulk();
  if (!bulk || bulk.selectedIds.length === 0) return null;

  return (
    <BulkActionsToolbar
      selectedIds={[...bulk.selectedIds]}
      operations={[...bulk.operations]}
      onClear={bulk.clear}
    />
  );
}
