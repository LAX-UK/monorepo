"use client";

import { useDeferredModule } from "@/hooks/use-deferred-module";
import { Button } from "@auction/ui/lax/button";
import { type KeyboardEvent, useState } from "react";

const loadSort = () =>
  import("@/components/sections/saleroom/saleroom-catalog-sort").then(
    (module) => module.SaleroomCatalogSort,
  );

/**
 * The LAX kit button with the sort trigger's measurements: it replaces the kit's ghost hover and its
 * size-step height, padding, radius, font and line height so the stand-in looks exactly as it always has.
 */
const STAND_IN_CLASS =
  "h-10 min-h-10 pointer-coarse:min-h-10 justify-start gap-0 rounded-md border border-outline-variant/40 bg-surface-container-lowest px-3 font-label text-xs font-medium leading-4 text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface-variant active:bg-surface-container-lowest";

/**
 * The sort select and its list library are fetched once the page has hydrated, not with its first
 * scripts. Until then (as before hydration) the current choice is shown as a button of the same
 * size, which keyboard users can reach. Once fetched, it is drawn at once on later visits within
 * the session. If the fetch failed, pointing at, focusing or pressing the button (click, Enter or
 * Space) fetches it again; if the button had focus, the select takes focus when it arrives. Pressing the button (click, Enter or Space) before the
 * select has arrived is not lost: the select opens its list as soon as it replaces the button.
 */
export function LazySaleroomCatalogSort({ sortLabel }: { sortLabel: string }) {
  const loaded = useDeferredModule(loadSort, true);
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);
  if (loaded.status === "ready") return <loaded.value autoFocus={focused} autoOpen={pressed} />;
  const retryIfFailed = () => {
    if (loaded.status === "failed") loaded.retry();
  };
  const press = () => {
    setPressed(true);
    retryIfFailed();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    press();
  };
  return (
    <Button
      type="button"
      variant="ghost"
      size="md"
      className={STAND_IN_CLASS}
      aria-label={`Sort: ${sortLabel}`}
      onPointerEnter={retryIfFailed}
      onPointerDown={retryIfFailed}
      onClick={press}
      onKeyDown={onKeyDown}
      onFocus={() => {
        setFocused(true);
        retryIfFailed();
      }}
      onBlur={() => setFocused(false)}
    >
      {sortLabel}
    </Button>
  );
}
