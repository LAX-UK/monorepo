"use client";

import { SaleDeliveryPill, SaleStatusPill } from "@/components/admin/sale-detail/sale-status-pill";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { adminLotListHref, adminSaleHref } from "@/lib/admin/catalog-route-helpers";
import type { SaleDeliveryMode, SaleStatus } from "@auction/types";
import { cn } from "@auction/ui";
import { ListFilter } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

export type LotSaleContextCellProps = {
  saleId: string | null;
  saleTitle: string | null;
  saleStatus?: SaleStatus | null;
  saleDeliveryMode?: SaleDeliveryMode | null;
  /** Table column uses a fixed max width; mobile cards use full width. */
  variant?: "table" | "card";
  showFilterAction?: boolean;
};

function useFilterBySaleHref(saleId: string | null): string | null {
  const searchParams = useSearchParams();
  return useMemo(() => {
    if (!saleId) return null;
    const current: Record<string, string | string[] | undefined> = {};
    searchParams.forEach((value, key) => {
      current[key] = value;
    });
    return buildListHref(adminLotListHref(), current, { saleId, lens: "all" });
  }, [saleId, searchParams]);
}

export function LotSaleContextCell({
  saleId,
  saleTitle,
  saleStatus,
  saleDeliveryMode,
  variant = "table",
  showFilterAction = true,
}: LotSaleContextCellProps) {
  const filterHref = useFilterBySaleHref(showFilterAction ? saleId : null);

  if (!saleId) {
    return (
      <span className="font-label text-xs text-on-surface-variant" aria-label="Not in a sale">
        Not in a sale
      </span>
    );
  }

  const saleHref = adminSaleHref(saleId);
  const linkLabel = saleTitle?.trim() ? saleTitle : "View sale";
  const hasContextMeta = Boolean(saleStatus || saleDeliveryMode);
  const isTable = variant === "table";

  return (
    <div
      className={cn("min-w-0", isTable && "group max-w-[12rem]", variant === "card" && "w-full")}
    >
      <div className="flex min-w-0 items-center gap-1">
        <Link
          href={saleHref}
          title={saleTitle?.trim() ? saleTitle : undefined}
          className={cn(
            "min-w-0 flex-1 truncate hover:text-link",
            isTable
              ? "font-headline text-sm font-semibold text-on-surface"
              : "font-label text-sm text-on-surface-variant",
          )}
        >
          {linkLabel}
        </Link>
        {filterHref ? (
          <Link
            href={filterHref}
            aria-label={`Filter lots by ${linkLabel}`}
            title="Filter lots by this sale"
            className={cn(
              "shrink-0 rounded p-0.5 text-on-surface-variant hover:bg-shell-search-bg hover:text-link",
              isTable &&
                "opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100",
            )}
          >
            <ListFilter className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>
      {hasContextMeta ? (
        <div className="mt-0.5 flex flex-nowrap items-center gap-1 overflow-hidden">
          {saleStatus ? (
            <SaleStatusPill
              status={saleStatus}
              iconOnly={isTable}
              className={cn("shrink-0", !isTable && "whitespace-nowrap")}
            />
          ) : null}
          {saleDeliveryMode ? (
            <SaleDeliveryPill
              deliveryMode={saleDeliveryMode}
              iconOnly={isTable}
              className={cn("shrink-0", !isTable && "whitespace-nowrap")}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
