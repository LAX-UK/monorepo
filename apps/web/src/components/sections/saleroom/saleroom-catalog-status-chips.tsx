"use client";

import { MarketingChipStrip } from "@/components/marketing/marketing-chip-strip";
import {
  SALEROOM_CATALOG_STATUS_OPTIONS,
  buildSaleroomStatusHref,
  parseSaleroomCatalogStatus,
} from "@/lib/marketing/saleroom-catalog-status";
import { cn } from "@auction/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export type SaleroomCatalogStatusChipsProps = {
  /** Path of the current saleroom (e.g. `/sales/abc/123`). */
  basePath: string;
  /** Horizontal strip (toolbar) or vertical list (filter sheet). */
  layout?: "strip" | "list";
  className?: string;
  /** Called after a status link is selected (e.g. close mobile sheet). */
  onSelect?: () => void;
};

const stripChipClass = (active: boolean) =>
  cn(
    "snap-start shrink-0 rounded-full border px-3 py-1.5 font-label text-[0.65rem] font-semibold uppercase tracking-wider transition-colors",
    active
      ? "border-primary bg-primary/10 text-on-surface"
      : "border-outline-variant/50 text-on-surface-variant hover:border-primary/40",
  );

const listChipClass = (active: boolean) =>
  cn(
    "flex min-h-11 w-full items-center rounded-lg border px-4 py-2 font-body text-sm transition-colors",
    active
      ? "border-primary bg-primary/10 text-on-surface"
      : "border-outline-variant/40 text-on-surface-variant hover:border-primary/30",
  );

export function SaleroomCatalogStatusChips({
  basePath,
  layout = "strip",
  className,
  onSelect,
}: SaleroomCatalogStatusChipsProps) {
  const params = useSearchParams();
  const searchParams = new URLSearchParams(params?.toString() ?? "");
  const active = parseSaleroomCatalogStatus(searchParams.get("status"));

  const links = SALEROOM_CATALOG_STATUS_OPTIONS.map((option) => {
    const isActive = active === option.value;
    const href = buildSaleroomStatusHref(basePath, option.value, searchParams);
    const chipClass = layout === "list" ? listChipClass(isActive) : stripChipClass(isActive);

    return (
      <Link
        key={option.value}
        href={href}
        scroll={false}
        aria-current={isActive ? "page" : undefined}
        className={chipClass}
        {...(onSelect ? { onClick: onSelect } : {})}
      >
        {option.label}
      </Link>
    );
  });

  if (layout === "list") {
    return (
      <nav aria-label="Lot status" className={cn("flex flex-col gap-2", className)}>
        {links}
      </nav>
    );
  }

  return (
    <MarketingChipStrip aria-label="Lot status" {...(className ? { className } : {})}>
      {links}
    </MarketingChipStrip>
  );
}
