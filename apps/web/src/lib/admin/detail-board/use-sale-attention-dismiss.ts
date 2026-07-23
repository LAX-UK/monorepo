"use client";

import { useCallback, useEffect, useState } from "react";

function storageKey(saleId: string): string {
  return `sale-attention-dismiss:${saleId}`;
}

function readDismissed(saleId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey(saleId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

function writeDismissed(saleId: string, ids: Set<string>): void {
  window.localStorage.setItem(storageKey(saleId), JSON.stringify([...ids]));
}

export function useSaleAttentionDismiss(saleId: string) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setDismissedIds(readDismissed(saleId));
  }, [saleId]);

  const dismissAll = useCallback(
    (rowIds: readonly string[]) => {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        for (const id of rowIds) next.add(id);
        writeDismissed(saleId, next);
        return next;
      });
    },
    [saleId],
  );

  const filterRows = useCallback(
    <T extends { id: string }>(rows: readonly T[]): T[] =>
      rows.filter((row) => !dismissedIds.has(row.id)),
    [dismissedIds],
  );

  return { dismissAll, filterRows };
}
