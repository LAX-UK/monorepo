"use client";

import { cn } from "@auction/ui";
import { type KeyboardEvent, useRef } from "react";

export type LiveTab = { id: string; label: string };

export const liveTabId = (base: string, saleId: string) => `${base}-tab-${saleId}`;
export const liveTabPanelId = (base: string, saleId: string) => `${base}-panel-${saleId}`;

/**
 * Tabs that switch a panel in place. Arrow keys, Home and End move between them (one stop in the
 * tab order), and the URL never changes. On a phone the row scrolls sideways.
 */
export function LiveTabs({
  idBase,
  label,
  tabs,
  activeId,
  onSelect,
}: {
  idBase: string;
  label: string;
  tabs: readonly LiveTab[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const refs = useRef(new Map<string, HTMLButtonElement>());

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const at = tabs.findIndex((tab) => tab.id === activeId);
    const next: Record<string, number> = {
      ArrowRight: (at + 1) % tabs.length,
      ArrowLeft: (at - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    };
    const target = tabs[next[event.key] ?? -1];
    if (!target) return;
    event.preventDefault();
    onSelect(target.id);
    refs.current.get(target.id)?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="-ml-3 flex min-w-0 flex-1 gap-1 overflow-x-auto border-b border-border-hairline [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              if (node) refs.current.set(tab.id, node);
              else refs.current.delete(tab.id);
            }}
            type="button"
            role="tab"
            id={liveTabId(idBase, tab.id)}
            aria-selected={active}
            aria-controls={liveTabPanelId(idBase, tab.id)}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            className={cn(
              "relative min-h-11 shrink-0 whitespace-nowrap rounded-sm px-3 font-body text-sm font-medium",
              "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
              active
                ? "text-on-surface after:bg-on-surface"
                : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
