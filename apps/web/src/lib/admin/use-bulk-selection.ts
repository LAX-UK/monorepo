"use client";

import type { RowSelectionState } from "@tanstack/react-table";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function selectionScopeKey(pathname: string, searchParams: URLSearchParams): string {
  const scoped = new URLSearchParams(searchParams.toString());
  scoped.delete("offset");
  scoped.delete("limit");
  return `${pathname}?${scoped.toString()}`;
}

export function useBulkSelection() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const scopeKey = useMemo(
    () => selectionScopeKey(pathname, searchParams),
    [pathname, searchParams],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: scopeKey triggers clear when list filters change
  useEffect(() => {
    setRowSelection({});
  }, [scopeKey]);

  const selectedIds = useMemo(
    () =>
      Object.entries(rowSelection)
        .filter(([, selected]) => selected)
        .map(([id]) => id),
    [rowSelection],
  );
  const clear = () => setRowSelection({});

  const selectAllOnPage = (ids: readonly string[]) => {
    setRowSelection(Object.fromEntries(ids.map((id) => [id, true])));
  };

  return { rowSelection, setRowSelection, selectedIds, clear, selectAllOnPage };
}
