"use client";

import { cn } from "@auction/ui";
import type { ReactNode } from "react";
import { useCallback, useId, useRef, useState } from "react";

type TabId = "bids" | "video";

type Props = {
  bidPanel: ReactNode;
  videoPanel: ReactNode;
  /** When false, only the bid panel is shown (no Video Stream tab). */
  hasVideoStream?: boolean;
  className?: string;
};

const ALL_TABS: { id: TabId; label: string }[] = [
  { id: "bids", label: "Bids View" },
  { id: "video", label: "Video Stream" },
];

/** Pill tabs: Bids View vs Video Stream (online mockup). */
export function BidPanelTabs({ bidPanel, videoPanel, hasVideoStream = false, className }: Props) {
  const tabs = hasVideoStream ? ALL_TABS : ALL_TABS.filter((t) => t.id === "bids");
  const [tab, setTab] = useState<TabId>("bids");
  const baseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = useCallback((t: TabId) => {
    setTab(t);
  }, []);

  const focusTabIndex = useCallback(
    (idx: number) => {
      const len = tabs.length;
      const next = ((idx % len) + len) % len;
      const def = tabs[next];
      if (!def) return;
      tabRefs.current[next]?.focus();
      setTab(def.id);
    },
    [tabs],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const idx = tabs.findIndex((t) => t.id === tab);
      if (e.key === "ArrowRight") {
        focusTabIndex(idx + 1);
      } else {
        focusTabIndex(idx - 1);
      }
    },
    [focusTabIndex, tab, tabs],
  );

  if (!hasVideoStream) {
    return <div className={cn("flex w-full flex-col gap-4", className)}>{bidPanel}</div>;
  }

  return (
    <div className={cn("flex w-full flex-col gap-4", className)}>
      <div
        className={cn(
          "mx-auto flex w-full max-w-full gap-2 rounded-full border border-[rgba(209,209,209,0.80)] bg-[rgba(232,232,232,0.30)] p-2 dark:border-outline-variant/50 dark:bg-surface-container-high/30 sm:max-w-[340px]",
        )}
        role="tablist"
        aria-label="Lot bidding panel"
        onKeyDown={onKeyDown}
      >
        {tabs.map(({ id, label }, i) => {
          const selected = tab === id;
          return (
            <button
              key={id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(id)}
              className={cn(
                "h-6 flex-1 rounded-full px-2 font-body text-xs font-bold uppercase leading-4 tracking-wide transition-colors motion-reduce:transition-none",
                selected
                  ? "bg-[#050505] text-[#F1F1F3] dark:bg-on-surface dark:text-background"
                  : "bg-transparent text-[#050505] dark:text-on-surface",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div
        id={`${baseId}-panel-bids`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-bids`}
        hidden={tab !== "bids"}
        className="min-w-0"
      >
        {bidPanel}
      </div>

      <div
        id={`${baseId}-panel-video`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-video`}
        hidden={tab !== "video"}
        className="min-w-0"
      >
        {videoPanel}
      </div>
    </div>
  );
}
