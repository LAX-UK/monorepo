"use client";

import { useSaleroomSwitcherOptions } from "@/features/saleroom/hooks/use-saleroom-switcher-options";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { Skeleton } from "@auction/ui/components/skeleton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export type SaleroomSwitcherOption = {
  id: string;
  title: string;
  sessionStatus: "none" | "pending" | "live" | "paused" | "ended";
};

type Props = {
  currentSaleId: string;
  currentSaleTitle?: string;
};

export function SaleroomSaleSwitcher({ currentSaleId, currentSaleTitle }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { options, isLoading, error } = useSaleroomSwitcherOptions();

  const otherRooms = options.filter((o) => o.id !== currentSaleId);
  if (!isLoading && otherRooms.length === 0 && !error) return null;

  const currentOption = options.find((o) => o.id === currentSaleId);
  const displayTitle = currentOption?.title ?? currentSaleTitle ?? "Sale";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        Switch room
      </span>
      {isLoading ? (
        <Skeleton className="h-11 min-w-[200px] rounded-md" />
      ) : (
        <Select
          value={currentSaleId}
          disabled={isPending}
          onValueChange={(id) => {
            if (id !== currentSaleId) {
              startTransition(() => {
                router.push(`/admin/saleroom/${id}`);
              });
            }
          }}
        >
          <SelectTrigger className="min-h-11 min-w-[200px] font-body text-sm" aria-busy={isPending}>
            <SelectValue>{isPending ? "Switching…" : displayTitle}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(options.length > 0
              ? options
              : [{ id: currentSaleId, title: displayTitle, sessionStatus: "none" as const }]
            ).map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                {opt.title}
                {opt.sessionStatus === "live" ? " · Live" : ""}
                {opt.sessionStatus === "paused" ? " · Paused" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {error ? (
        <span className="font-body text-xs text-secondary">Could not load other rooms</span>
      ) : null}
      <Link
        href="/admin/saleroom"
        className="font-label text-xs uppercase tracking-wide text-link hover:underline"
      >
        All rooms
      </Link>
    </div>
  );
}
