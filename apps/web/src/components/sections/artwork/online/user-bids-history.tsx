"use client";

import type { UserBidsHistoryVM } from "@/components/sections/artwork/artwork-view-models";
import { cn } from "@auction/ui";

type Props = {
  vm: UserBidsHistoryVM;
  className?: string;
};

function statusLabel(s: UserBidsHistoryVM["rows"][number]["status"]): string {
  if (s === "won") return "Won";
  if (s === "highest") return "Highest";
  return "Outbid";
}

export function UserBidsHistory({ vm, className }: Props) {
  return (
    <div
      className={cn(
        "mt-4 flex w-full flex-col gap-3 rounded-[24px] p-4 outline outline-2 outline-offset-[-2px] outline-[#D1D1D1] dark:outline-outline-variant/50",
        className,
      )}
    >
      <div className="flex h-6 flex-wrap items-center gap-2 font-body uppercase leading-6 text-[#050505] dark:text-on-surface">
        <span className="text-[13px] font-normal">Your bids ({vm.count})</span>
        <span className="text-base font-normal" aria-hidden>
          —
        </span>
        <span className="text-[13px] font-normal">{vm.paddleLabel}</span>
      </div>
      <ul className="flex flex-col gap-3">
        {vm.rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center gap-3 border-b border-[#D1D1D1]/80 pb-3 last:border-b-0 last:pb-0 dark:border-outline-variant/30"
          >
            <span className="rounded bg-[#F1F1F3] px-2 py-1 font-body text-xs font-semibold uppercase leading-3 tracking-wide text-[#050505] backdrop-blur-sm dark:bg-surface-container-high dark:text-on-surface">
              {statusLabel(row.status)}
            </span>
            <span className="font-body text-xs font-semibold uppercase leading-6 text-[#050505] dark:text-on-surface">
              {row.amount}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
