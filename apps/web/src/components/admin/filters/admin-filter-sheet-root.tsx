"use client";

import {
  CATALOG_FILTER_SHEET_DESCRIPTION,
  CatalogFilterSheetPanel,
  CatalogFilterSheetTrigger,
  useCatalogFilterSheetState,
} from "@/components/admin/catalog/catalog-filter-sheet-primitive";
import { adminFilterSheetContentClassName } from "@/components/admin/filters/admin-filter-section";
import type { AdminFilterAdapter, AdminFilterPreserved } from "@/lib/admin/filters/types";
import { useAdminFilterDraft } from "@/lib/admin/filters/use-admin-filter-draft";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo } from "react";

type DraftContextValue<D> = ReturnType<typeof useAdminFilterDraft<D>> & {
  applyAndClose: () => void;
};

const AdminFilterDraftContext = createContext<DraftContextValue<unknown> | null>(null);

export function useAdminFilterDraftContext<D>(): DraftContextValue<D> {
  const ctx = useContext(AdminFilterDraftContext);
  if (!ctx) {
    throw new Error("useAdminFilterDraftContext must be used within AdminFilterSheetRoot");
  }
  return ctx as DraftContextValue<D>;
}

type RootProps<D> = {
  adapter: AdminFilterAdapter<D>;
  preserved: AdminFilterPreserved;
  children: ReactNode;
};

export function AdminFilterSheetRoot<D>({ adapter, preserved, children }: RootProps<D>) {
  const sheetState = useCatalogFilterSheetState();
  const draftCtrl = useAdminFilterDraft({ adapter, preserved, open: sheetState.open });

  const applyAndClose = useCallback(() => {
    draftCtrl.apply();
    sheetState.setOpen(false);
  }, [draftCtrl, sheetState]);

  const value = useMemo(
    () => ({ ...draftCtrl, applyAndClose }),
    [applyAndClose, draftCtrl],
  ) as DraftContextValue<D>;

  return (
    <AdminFilterDraftContext.Provider value={value as DraftContextValue<unknown>}>
      <AdminFilterSheetStateContext.Provider value={sheetState}>
        {children}
      </AdminFilterSheetStateContext.Provider>
    </AdminFilterDraftContext.Provider>
  );
}

const AdminFilterSheetStateContext = createContext<ReturnType<
  typeof useCatalogFilterSheetState
> | null>(null);

function useAdminFilterSheetStateContext() {
  const ctx = useContext(AdminFilterSheetStateContext);
  if (!ctx) throw new Error("AdminFilterSheetTrigger/Panel require AdminFilterSheetRoot");
  return ctx;
}

export function AdminFilterSheetTrigger({ activeCount }: { activeCount: number }) {
  const sheetState = useAdminFilterSheetStateContext();
  return <CatalogFilterSheetTrigger {...sheetState} activeCount={activeCount} />;
}

type PanelProps = {
  title: string;
  children: ReactNode;
  description?: string;
};

export function AdminFilterSheetPanel({ title, children, description }: PanelProps) {
  const sheetState = useAdminFilterSheetStateContext();
  const { applyAndClose, reset, pending, isDirty } = useAdminFilterDraftContext();

  return (
    <CatalogFilterSheetPanel
      {...sheetState}
      title={title}
      description={description ?? CATALOG_FILTER_SHEET_DESCRIPTION}
      onApply={applyAndClose}
      onReset={reset}
      applyDisabled={pending || !isDirty}
      {...(!isDirty && !pending ? { applyDisabledHint: "Change a filter to apply" } : {})}
      applyLabel="Apply filters"
      resetLabel="Reset"
    >
      <div className={adminFilterSheetContentClassName}>{children}</div>
    </CatalogFilterSheetPanel>
  );
}
