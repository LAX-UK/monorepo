"use client";

import { AdminFilterDraftSelect } from "@/components/admin/filters/admin-filter-draft-fields";
import { AdminFilterSheetFields } from "@/components/admin/filters/admin-filter-section";
import { useAdminFilterDraftContext } from "@/components/admin/filters/admin-filter-sheet-root";
import type { SaleLensId } from "@/lib/admin/catalog/sales-lenses";
import type { SaleFilterDraft } from "@/lib/admin/filters/sale-filter-adapter";
import { SALE_LIST_SORT_KEYS, SALE_LIST_SORT_LABELS } from "@/lib/admin/sales-list-sort";

const LENS_LABELS: Record<Exclude<SaleLensId, "all" | "setup">, string> = {
  upcoming: "Upcoming",
  live: "Live now",
  closed: "Past (not settled)",
  settled: "Settled",
};

type Props = {
  activeLensId: SaleLensId;
};

export function AdminSaleFilterFields({ activeLensId }: Props) {
  const { draft, patch } = useAdminFilterDraftContext<SaleFilterDraft>();
  const lensLocked = activeLensId !== "all" && activeLensId !== "setup";

  return (
    <AdminFilterSheetFields>
      {lensLocked ? (
        <p className="rounded-md border border-outline-variant/60 bg-surface-container-low/50 px-3 py-2 font-body text-sm text-on-surface-variant">
          Filtered by lens:{" "}
          <span className="font-medium text-on-surface">
            {LENS_LABELS[activeLensId as keyof typeof LENS_LABELS] ?? activeLensId}
          </span>
          . Use the lens row above to change the time window.
        </p>
      ) : (
        <AdminFilterDraftSelect
          id="admin-sale-filter-lifecycle"
          label="Time window"
          value={draft.lifecycle}
          onChange={(lifecycle) => patch({ lifecycle })}
          options={[
            { value: "", label: "All sales" },
            { value: "upcoming", label: "Upcoming" },
            { value: "live", label: "Live now" },
            { value: "closed", label: "Past (not settled)" },
            { value: "settled", label: "Settled" },
          ]}
        />
      )}
      <AdminFilterDraftSelect
        id="admin-sale-filter-delivery"
        label="Delivery mode"
        value={draft.delivery}
        onChange={(delivery) => patch({ delivery })}
        options={[
          { value: "", label: "Any delivery" },
          { value: "online", label: "Online only" },
          { value: "onsite", label: "Onsite only" },
        ]}
      />
      <AdminFilterDraftSelect
        id="admin-sale-filter-sort"
        label="Sort"
        value={draft.sort}
        onChange={(sort) => patch({ sort: sort as SaleFilterDraft["sort"] })}
        options={[
          { value: "", label: "Default" },
          ...SALE_LIST_SORT_KEYS.map((value) => ({
            value,
            label: SALE_LIST_SORT_LABELS[value],
          })),
        ]}
      />
    </AdminFilterSheetFields>
  );
}
