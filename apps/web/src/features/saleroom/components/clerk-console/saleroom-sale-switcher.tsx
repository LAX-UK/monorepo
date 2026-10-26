"use client";

import { useSaleroomSwitcherOptions } from "@/features/saleroom/hooks/use-saleroom-switcher-options";
import { EnumSelect, Skeleton } from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";

export type SaleroomSwitcherOption = {
  id: string;
  title: string;
  sessionStatus: "none" | "pending" | "live" | "paused" | "ended";
};

type Props = {
  currentSaleId: string;
  currentSaleTitle?: string;
};

const SESSION_SUFFIX: Partial<Record<SaleroomSwitcherOption["sessionStatus"], string>> = {
  live: " · Live",
  paused: " · Paused",
};

/** Jumps to another sale's console; hidden when there is no other room to go to. */
export function SaleroomSaleSwitcher({ currentSaleId, currentSaleTitle }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { options, isLoading, error } = useSaleroomSwitcherOptions();

  const otherRooms = options.filter((o) => o.id !== currentSaleId);
  const displayTitle =
    options.find((o) => o.id === currentSaleId)?.title ?? currentSaleTitle ?? "Sale";

  const selectOptions = useMemo(
    () =>
      (options.length > 0
        ? options
        : [{ id: currentSaleId, title: displayTitle, sessionStatus: "none" as const }]
      ).map((opt) => ({
        value: opt.id,
        label: `${opt.title}${SESSION_SUFFIX[opt.sessionStatus] ?? ""}`,
      })),
    [options, currentSaleId, displayTitle],
  );

  if (!isLoading && otherRooms.length === 0 && !error) return null;
  if (isLoading) return <Skeleton className="h-control-md w-56 rounded-staff-sm" />;
  if (error) {
    return <p className="text-staff-sm text-staff-muted">Could not load other rooms</p>;
  }

  return (
    <EnumSelect
      aria-label="Switch to another room"
      value={currentSaleId}
      disabled={isPending}
      className="w-56"
      options={selectOptions}
      onValueChange={(id) => {
        if (id !== currentSaleId) {
          startTransition(() => {
            router.push(`/admin/saleroom/${id}`);
          });
        }
      }}
    />
  );
}
