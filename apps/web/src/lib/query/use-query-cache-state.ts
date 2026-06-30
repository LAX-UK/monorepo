"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

type Options = {
  /** When set, only cache updates whose query key passes this check trigger a re-render. */
  matchUpdatedKey?: (queryKey: readonly unknown[]) => boolean;
};

/**
 * Read live TanStack Query cache state when `initialData` prevents `setQueryData` from
 * updating `useQuery().data` (see *-cache-update.test.tsx in saleroom/lot-bid hooks).
 */
export function useQueryCacheState<T>(
  queryKey: readonly unknown[],
  initial: T,
  { matchUpdatedKey }: Options = {},
): T {
  const queryClient = useQueryClient();
  const initialRef = useRef(initial);

  useEffect(() => {
    initialRef.current = initial;
  }, [initial]);

  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      queryClient.getQueryCache().subscribe((event) => {
        if (event.type !== "updated") return;
        const updatedKey = event.query.queryKey;
        const matches = matchUpdatedKey
          ? matchUpdatedKey(updatedKey)
          : updatedKey.length === queryKey.length &&
            updatedKey.every((part: unknown, i: number) => part === queryKey[i]);
        if (matches) onStoreChange();
      }),
    [queryClient, queryKey, matchUpdatedKey],
  );

  const getSnapshot = useCallback(
    () => queryClient.getQueryData<T>(queryKey) ?? initialRef.current,
    [queryClient, queryKey],
  );

  const getServerSnapshot = useCallback(() => initialRef.current, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
