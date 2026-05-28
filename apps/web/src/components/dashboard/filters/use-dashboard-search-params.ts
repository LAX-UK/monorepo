"use client";

import { buildFilterHref, patchFilterParams } from "@/lib/dashboard/filters/filter-params";
import type { FilterParamsRecord } from "@/lib/dashboard/filters/types";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

export type UseDashboardSearchParamsOptions = {
  defaults?: Record<string, string | undefined>;
  omitDefaults?: Record<string, string | undefined>;
};

/** Hook wrapping pure filter URL helpers for client-side navigation. */
export function useDashboardSearchParams(options?: UseDashboardSearchParamsOptions) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const params = useMemo(() => {
    const record: FilterParamsRecord = {};
    searchParams.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }, [searchParams]);

  const updateParams = useCallback(
    (mutate: (next: URLSearchParams) => void, replaceOptions?: { scroll?: boolean }) => {
      const next = new URLSearchParams(searchParams.toString());
      mutate(next);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, {
        scroll: replaceOptions?.scroll ?? false,
      });
    },
    [pathname, router, searchParams],
  );

  const buildHref = useCallback(
    (patch: Partial<FilterParamsRecord>) => {
      const nextParams = patchFilterParams(params, patch);
      return buildFilterHref(
        pathname,
        nextParams,
        options?.omitDefaults ? { omitDefaults: options.omitDefaults } : undefined,
      );
    },
    [options?.omitDefaults, params, pathname],
  );

  const replaceParams = useCallback(
    (patch: Partial<FilterParamsRecord>) => {
      const href = buildHref(patch);
      const qs = href.includes("?") ? href.split("?")[1] : "";
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [buildHref, pathname, router],
  );

  return {
    params,
    pathname,
    updateParams,
    buildHref,
    replaceParams,
  };
}
