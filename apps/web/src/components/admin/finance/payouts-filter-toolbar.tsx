"use client";

import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import {
  type CatalogActiveFilterChip,
  CatalogActiveFiltersRow,
} from "@/components/admin/catalog/catalog-active-filters-row";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useState, useTransition } from "react";

type Props = {
  legalEntityId?: string;
  status?: string;
  activeFilterCount: number;
  activeFilterChips?: readonly CatalogActiveFilterChip[];
  toolbarEnd?: React.ReactNode;
};

/** Payout list filters: legal entity ID in drawer. */
export function PayoutsFilterToolbar({
  legalEntityId,
  status,
  activeFilterCount,
  activeFilterChips = [],
  toolbarEnd,
}: Props) {
  const inputId = useId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [entityId, setEntityId] = useState(legalEntityId ?? "");

  const applyEntityFilter = () => {
    const trimmed = entityId.trim();
    const href = buildListHref(pathname, Object.fromEntries(searchParams.entries()), {
      legalEntityId: trimmed || null,
      offset: 0,
      ...(status ? { status } : {}),
    });
    startTransition(() => {
      router.push(href);
    });
  };

  const sheetFilters = (
    <div className="space-y-3">
      <label
        htmlFor={inputId}
        className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary"
      >
        Legal entity ID
      </label>
      <Input
        id={inputId}
        value={entityId}
        onChange={(e) => setEntityId(e.target.value)}
        placeholder="Optional UUID"
        className="h-10 font-body text-sm"
      />
      <Button type="button" className="h-10 w-full" onClick={applyEntityFilter}>
        Apply entity filter
      </Button>
    </div>
  );

  return (
    <AdminFilterBar
      key={legalEntityId ?? "none"}
      sheetTitle="Payout filters"
      sheetFilters={sheetFilters}
      activeFilterCount={activeFilterCount}
      activeFilters={
        activeFilterChips.length > 0 ? <CatalogActiveFiltersRow chips={activeFilterChips} /> : null
      }
      toolbarEnd={toolbarEnd}
    />
  );
}
