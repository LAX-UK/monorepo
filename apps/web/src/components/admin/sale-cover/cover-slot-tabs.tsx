"use client";

import type { SlotSummary } from "@/lib/admin/sale-cover/slot-summary";
import { StaffButton, cn } from "@auction/staff-ui";
import { SALE_COVER_SLOT_NAMES, type SaleCoverSlotName } from "@auction/types";
import { useRef } from "react";

type Props = {
  summaries: Record<SaleCoverSlotName, SlotSummary>;
  selected: SaleCoverSlotName;
  onSelect: (name: SaleCoverSlotName) => void;
  /** The id of the panel these tabs control. */
  panelId: string;
};

export const slotTabId = (panelId: string, name: SaleCoverSlotName) => `${panelId}-tab-${name}`;

/** The three slots as cards. Arrow keys move between them, as in any tab list. */
export function CoverSlotTabs({ summaries, selected, onSelect, panelId }: Props) {
  const refs = useRef(new Map<SaleCoverSlotName, HTMLButtonElement>());

  const move = (from: number, step: number) => {
    const next =
      SALE_COVER_SLOT_NAMES[
        (from + step + SALE_COVER_SLOT_NAMES.length) % SALE_COVER_SLOT_NAMES.length
      ];
    if (!next) return;
    onSelect(next);
    refs.current.get(next)?.focus();
  };

  return (
    <div role="tablist" aria-label="Cover pictures" className="grid gap-3 sm:grid-cols-3">
      {SALE_COVER_SLOT_NAMES.map((name, index) => {
        const summary = summaries[name];
        const active = name === selected;
        return (
          <StaffButton
            key={name}
            ref={(node) => {
              if (node) refs.current.set(name, node);
              else refs.current.delete(name);
            }}
            variant="ghost"
            role="tab"
            id={slotTabId(panelId, name)}
            aria-selected={active}
            aria-controls={panelId}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(name)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") {
                event.preventDefault();
                move(index, 1);
              } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                move(index, -1);
              }
            }}
            className={cn(
              "h-auto min-w-0 flex-col items-start justify-start gap-0.5 whitespace-normal rounded-staff-md border bg-staff-surface px-3 py-2.5 text-left font-normal",
              active
                ? "border-staff-ink shadow-[inset_0_0_0_1px_var(--color-staff-ink)]"
                : "border-staff-line hover:border-staff-line-strong hover:bg-staff-hover",
            )}
          >
            <span className="text-staff-sm font-semibold text-staff-fg">{summary.title}</span>
            <span
              className={cn(
                "text-staff-sm",
                summary.problem ? "font-medium text-staff-danger-fg" : "text-staff-muted",
              )}
            >
              {summary.detail}
            </span>
          </StaffButton>
        );
      })}
    </div>
  );
}
