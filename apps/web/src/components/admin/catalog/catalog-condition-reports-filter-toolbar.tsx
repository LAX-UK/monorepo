"use client";

import {
  CatalogFilterBar,
  type CatalogSegmentItem,
} from "@/components/admin/catalog/catalog-filter-bar";
import { buildListHref } from "@/lib/admin/admin-list-params";

export type ConditionReportLensId = "open" | "pending" | "in_progress" | "fulfilled" | "declined";

const LENSES: { id: ConditionReportLensId; label: string }[] = [
  { id: "open", label: "Open queue" },
  { id: "pending", label: "Pending" },
  { id: "in_progress", label: "In progress" },
  { id: "fulfilled", label: "Fulfilled" },
  { id: "declined", label: "Declined" },
];

type Props = {
  activeLensId: ConditionReportLensId;
  searchParams: Record<string, string | string[] | undefined>;
};

export function CatalogConditionReportsFilterToolbar({ activeLensId, searchParams }: Props) {
  const lenses: CatalogSegmentItem[] = LENSES.map((lens) => ({
    id: lens.id,
    label: lens.label,
    href: buildListHref("/admin/condition-reports", searchParams, {
      lens: lens.id === "open" ? "" : lens.id,
      offset: 0,
    }),
  }));

  return (
    <CatalogFilterBar
      lenses={lenses}
      activeLensId={activeLensId}
      lensAriaLabel="Condition report queue"
      sheetTitle="Condition report filters"
      sheetFilters={<span className="sr-only">No additional filters</span>}
      showFilterTrigger={false}
    />
  );
}
