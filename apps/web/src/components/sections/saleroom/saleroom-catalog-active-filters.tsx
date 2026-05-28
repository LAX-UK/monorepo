"use client";

import { MarketingChipStrip } from "@/components/marketing/marketing-chip-strip";
import {
  buildSaleroomClearStatusHref,
  parseSaleroomCatalogStatus,
  saleroomStatusLabel,
} from "@/lib/marketing/saleroom-catalog-status";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Props = {
  basePath: string;
  className?: string;
};

/** Removable active status chip for the saleroom catalogue (parity with search active filters). */
export function SaleroomCatalogActiveFilters({ basePath, className }: Props) {
  const params = useSearchParams();
  const searchParams = new URLSearchParams(params?.toString() ?? "");
  const status = parseSaleroomCatalogStatus(searchParams.get("status"));

  if (status === "all") return null;

  const clearHref = buildSaleroomClearStatusHref(basePath, searchParams);

  return (
    <MarketingChipStrip
      wrapOnDesktop
      aria-label="Active filters"
      className={cn("mb-4 md:mb-6", className)}
    >
      <Button
        type="button"
        variant="ghost"
        asChild
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 font-label text-[0.65rem] font-semibold uppercase tracking-wider text-on-surface hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Link href={clearHref} scroll={false}>
          <span>{saleroomStatusLabel(status)}</span>
          <X className="size-3.5 shrink-0" aria-hidden />
          <span className="sr-only">Remove filter</span>
        </Link>
      </Button>
      <Button
        type="button"
        variant="ghost"
        asChild
        className="min-h-11 px-2 font-label text-[0.65rem] font-semibold uppercase tracking-wider text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Link href={clearHref} scroll={false}>
          Clear all
        </Link>
      </Button>
    </MarketingChipStrip>
  );
}
