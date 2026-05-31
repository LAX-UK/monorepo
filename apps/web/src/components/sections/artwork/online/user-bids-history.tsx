"use client";

import type { UserBidsHistoryVM } from "@/components/sections/artwork/artwork-view-models";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

type Props = {
  vm: UserBidsHistoryVM;
  className?: string;
  defaultOpen?: boolean;
};

function statusLabel(row: UserBidsHistoryVM["rows"][number]): string {
  if (row.status === "won") return "Won";
  if (row.status === "highest") {
    return row.isAutoBid ? "Defending (auto)" : "Highest";
  }
  return "Outbid";
}

export function UserBidsHistory({ vm, className, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div
      className={cn(
        "mt-4 flex w-full flex-col rounded-[24px] outline outline-2 outline-offset-[-2px] outline-[#D1D1D1] dark:outline-outline-variant/50",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        className="flex w-full items-center gap-2 rounded-t-[24px] px-4 py-3 text-left font-body text-[#050505] dark:text-on-surface"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-on-surface-variant transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
        <span className="text-[13px] font-normal">Your activity on this lot ({vm.count})</span>
        <span className="ml-auto text-xs font-normal text-on-surface-variant">
          {vm.paddleLabel}
        </span>
      </Button>
      {open ? (
        <div
          id={panelId}
          className="space-y-3 border-t border-[#D1D1D1]/80 px-4 pb-4 pt-3 dark:border-outline-variant/30"
        >
          {vm.contextLine ? (
            <p className="font-body text-xs text-on-surface-variant">{vm.contextLine}</p>
          ) : null}
          <ul className="flex flex-col gap-3">
            {vm.rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-3 border-b border-[#D1D1D1]/80 pb-3 last:border-b-0 last:pb-0 dark:border-outline-variant/30"
              >
                <span className="rounded bg-[#F1F1F3] px-2 py-1 font-body text-xs font-semibold uppercase leading-3 tracking-wide text-[#050505] backdrop-blur-sm dark:bg-surface-container-high dark:text-on-surface">
                  {statusLabel(row)}
                </span>
                <span className="font-body text-xs font-semibold uppercase leading-6 text-[#050505] dark:text-on-surface">
                  {row.amount}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
