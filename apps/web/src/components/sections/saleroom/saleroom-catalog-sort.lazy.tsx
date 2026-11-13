"use client";

import { useDeferredModule } from "@/hooks/use-deferred-module";
import { type KeyboardEvent, useState } from "react";

const loadSort = () =>
  import("@/components/sections/saleroom/saleroom-catalog-sort").then(
    (module) => module.SaleroomCatalogSort,
  );

/**
 * The sort select and its list library are fetched once the page has hydrated, not with its first
 * scripts. Until then (as before hydration) the current choice is shown as a button of the same
 * size, which keyboard users can reach. Once fetched, it is drawn at once on later visits within
 * the session. If the fetch failed, pointing at, focusing or pressing the button (click, Enter or
 * Space) fetches it again; if the button had focus, the select takes focus when it arrives.
 */
export function LazySaleroomCatalogSort({ sortLabel }: { sortLabel: string }) {
  const loaded = useDeferredModule(loadSort, true);
  const [focused, setFocused] = useState(false);
  if (loaded.status === "ready") return <loaded.value autoFocus={focused} />;
  const retryIfFailed = () => {
    if (loaded.status === "failed") loaded.retry();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    retryIfFailed();
  };
  return (
    <button
      type="button"
      className="inline-flex h-10 min-h-10 items-center rounded-md border border-outline-variant/40 bg-surface-container-lowest px-3 font-label text-xs font-medium text-on-surface-variant ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      aria-label={`Sort: ${sortLabel}`}
      onPointerEnter={retryIfFailed}
      onPointerDown={retryIfFailed}
      onClick={retryIfFailed}
      onKeyDown={onKeyDown}
      onFocus={() => {
        setFocused(true);
        retryIfFailed();
      }}
      onBlur={() => setFocused(false)}
    >
      {sortLabel}
    </button>
  );
}
