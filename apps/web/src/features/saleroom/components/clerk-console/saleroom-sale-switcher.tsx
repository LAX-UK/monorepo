"use client";

import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import Link from "next/link";

export type SaleroomSwitcherOption = {
  id: string;
  title: string;
  sessionStatus: PublicSaleroomSessionStatus["status"];
};

type Props = {
  currentSaleId: string;
  options: SaleroomSwitcherOption[];
};

export function SaleroomSaleSwitcher({ currentSaleId, options }: Props) {
  const otherRooms = options.filter((o) => o.id !== currentSaleId);
  if (otherRooms.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        Switch room
      </span>
      <Select
        value={currentSaleId}
        onValueChange={(id) => {
          if (id !== currentSaleId) {
            window.location.href = `/admin/saleroom/${id}`;
          }
        }}
      >
        <SelectTrigger className="min-h-11 min-w-[200px] font-body text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              {opt.title}
              {opt.sessionStatus === "live" ? " · Live" : ""}
              {opt.sessionStatus === "paused" ? " · Paused" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Link
        href="/admin/saleroom"
        className="font-label text-xs uppercase tracking-wide text-link hover:underline"
      >
        All rooms
      </Link>
    </div>
  );
}
