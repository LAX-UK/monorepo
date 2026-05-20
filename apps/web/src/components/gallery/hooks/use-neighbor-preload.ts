"use client";

import { useMemo } from "react";

/** Indices to mark as priority for next/image (current ± 1). */
export function useNeighborPreload(index: number, count: number): Set<number> {
  return useMemo(() => {
    const set = new Set<number>();
    if (count <= 0) return set;
    set.add(index);
    if (index > 0) set.add(index - 1);
    if (index < count - 1) set.add(index + 1);
    return set;
  }, [index, count]);
}
