"use client";

import type { AdminFilterAdapter, AdminFilterPreserved } from "@/lib/admin/filters/types";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

type Options<D> = {
  adapter: AdminFilterAdapter<D>;
  preserved: AdminFilterPreserved;
  /** When false, re-hydrate draft from URL (discard unstaged edits). */
  open: boolean;
};

export function useAdminFilterDraft<D>({ adapter, preserved, open }: Options<D>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const applied = useMemo(
    () => adapter.parse(searchParams, preserved),
    [adapter, preserved, searchParams],
  );

  const [draft, setDraft] = useState(applied);

  useEffect(() => {
    if (!open) setDraft(applied);
  }, [open, applied]);

  const patch = useCallback((partial: Partial<D>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  }, []);

  const reset = useCallback(() => {
    setDraft(adapter.defaults(preserved));
  }, [adapter, preserved]);

  const apply = useCallback(() => {
    const href = adapter.buildHref(pathname, searchParams, draft, preserved);
    startTransition(() => {
      router.push(href, { scroll: false });
    });
  }, [adapter, draft, pathname, preserved, router, searchParams]);

  const isDirty = useMemo(() => adapter.isDirty(draft, applied), [adapter, applied, draft]);

  return {
    draft,
    setDraft,
    patch,
    reset,
    apply,
    pending,
    isDirty,
    applied,
  };
}

export type AdminFilterDraftController<D> = ReturnType<typeof useAdminFilterDraft<D>>;
