"use client";

import type { PaletteItem, PaletteSection, PaletteSource } from "@/components/layout/palette/types";
import { useEffect, useMemo, useRef, useState } from "react";

const DEBOUNCE_MS = 300;

function sectionsEqual(a: readonly PaletteSection[], b: readonly PaletteSection[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (!left || !right || left.id !== right.id || left.items.length !== right.items.length) {
      return false;
    }
  }
  return true;
}

export function useDebouncedPaletteSearch(
  sources: readonly PaletteSource[],
  query: string,
): { sections: PaletteSection[]; loading: boolean } {
  const [sections, setSections] = useState<PaletteSection[]>([]);
  const [loading, setLoading] = useState(false);
  const searchId = useRef(0);
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;

  const sourceKey = useMemo(() => sources.map((s) => s.id).join("\0"), [sources]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: sourceKey resets search when palette sources change
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSections((prev) => (prev.length === 0 ? prev : []));
      setLoading((prev) => (prev ? false : prev));
      return;
    }

    const id = ++searchId.current;
    setLoading((prev) => (prev ? prev : true));
    const timer = setTimeout(() => {
      void (async () => {
        const enabled = sourcesRef.current.filter((s) => s.enabled !== false);
        const results = await Promise.all(
          enabled.map(async (source) => {
            try {
              const items = await source.search(q);
              return { id: source.id, heading: source.heading, items };
            } catch {
              return { id: source.id, heading: source.heading, items: [] as PaletteItem[] };
            }
          }),
        );
        if (searchId.current !== id) return;
        const next = results.filter((s) => s.items.length > 0);
        setSections((prev) => (sectionsEqual(prev, next) ? prev : next));
        setLoading(false);
      })();
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, sourceKey]);

  return { sections, loading };
}
