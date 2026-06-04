"use client";

import { MarketingChipStrip } from "@/components/marketing/marketing-chip-strip";
import { marketingFilterChipList, marketingFilterChipStrip } from "@/lib/marketing/chips";
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
    const chipClass =
      layout === "list" ? marketingFilterChipList(isActive) : marketingFilterChipStrip(isActive);

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
