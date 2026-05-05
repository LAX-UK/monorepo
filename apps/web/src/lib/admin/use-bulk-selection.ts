"use client";

import type { RowSelectionState } from "@tanstack/react-table";
import { useMemo, useState } from "react";

export function useBulkSelection() {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const selectedIds = useMemo(
    () =>
      Object.entries(rowSelection)
        .filter(([, selected]) => selected)
        .map(([id]) => id),
    [rowSelection],
  );
  const clear = () => setRowSelection({});

  return { rowSelection, setRowSelection, selectedIds, clear };
}
