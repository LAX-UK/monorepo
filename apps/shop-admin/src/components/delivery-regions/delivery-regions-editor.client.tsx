"use client";

import { type RegionRowView, notDeliveredToSentence, regionRows } from "@/lib/delivery-regions";
import {
  saveDeliveryRegion,
  saveNotDeliveredTo,
} from "@/server/application/delivery-regions-actions.server";
import type { AdminDeliveryRegions, DeliveryRegionView } from "@auction/shop-contracts";
import { type DataColumn, DataTable, Notice, Section, StaffButton } from "@auction/staff-ui";
import { useState } from "react";
import { NotDeliveredToDialog } from "./not-delivered-to-dialog.client";
import { RegionDialog } from "./region-dialog.client";

/**
 * Delivery regions: the four regions with their lead times and price, and the countries LAX does
 * not deliver to. Everyone on staff reads it; changing it needs `settings.write`, so without it
 * there are no edit buttons. Each region and the country list are saved on their own.
 */
export function DeliveryRegionsEditor({
  initial,
  canEdit,
  actions = { saveRegion: saveDeliveryRegion, saveCountries: saveNotDeliveredTo },
}: {
  initial: AdminDeliveryRegions;
  canEdit: boolean;
  actions?: {
    saveRegion: typeof saveDeliveryRegion;
    saveCountries: typeof saveNotDeliveredTo;
  };
}) {
  const [data, setData] = useState(initial);
  const [editing, setEditing] = useState<DeliveryRegionView | null>(null);
  const [editingCountries, setEditingCountries] = useState(false);

  const rows = regionRows(data.regions);
  const columns: DataColumn<RegionRowView>[] = [
    {
      id: "region",
      header: "Region",
      mobile: "title",
      truncate: false,
      cell: (row) => (
        <span className="flex flex-col">
          <span className="font-medium text-staff-fg">{row.name}</span>
          <span className="text-staff-xs text-staff-muted">
            {row.note}
            <span className="md:hidden"> · {row.price}</span>
          </span>
        </span>
      ),
    },
    {
      id: "standard",
      header: "Standard",
      mobile: "meta",
      truncate: false,
      cell: (row) => leadTime("Standard", row.standard, null),
    },
    {
      id: "specialist",
      header: "Specialist",
      mobile: "meta",
      truncate: false,
      cell: (row) => leadTime("Specialist", row.specialist, "working days"),
    },
    {
      id: "price",
      header: "Price",
      mobile: "hidden",
      truncate: false,
      cell: (row) => row.price,
    },
    {
      id: "edit",
      header: "Edit",
      headerHidden: true,
      mobile: "actions",
      cell: (row) =>
        canEdit && row.editable ? (
          <StaffButton
            variant="ghost"
            size="sm"
            className="max-md:min-h-11 max-md:min-w-11"
            aria-label={`Edit ${row.name}`}
            onClick={() => setEditing(data.regions.find((region) => region.id === row.id) ?? null)}
          >
            Edit
          </StaffButton>
        ) : null,
    },
  ];

  return (
    <div className="flex w-full max-w-[1040px] flex-col gap-6">
      <Section
        title="Regions"
        description="How long delivery takes, in working days from dispatch. Standard is for prints that ship as they are, specialist for framed and made-to-order work."
        bodyClassName="p-0"
      >
        <DataTable
          embedded
          label="Delivery regions"
          columns={columns}
          data={rows}
          getRowId={(row) => row.id}
          stickyHeader={false}
          defaultSort={{ columnId: "region", direction: "asc" }}
        />
        <p className="border-t border-staff-line-subtle px-4 py-3 text-staff-sm text-staff-muted">
          A region with no fixed price is quoted for each order. Countries outside these regions are
          quoted too.
        </p>
      </Section>

      <Section
        title="Not delivered to"
        description="Countries LAX does not ship to, because of export restrictions. Buyers there are offered collection instead."
        action={
          canEdit ? (
            <StaffButton variant="secondary" size="sm" onClick={() => setEditingCountries(true)}>
              Edit countries
            </StaffButton>
          ) : null
        }
      >
        {data.notDeliveredTo.length === 0 ? (
          <Notice tone="info" title={notDeliveredToSentence([])} />
        ) : (
          <p className="text-staff-sm text-staff-fg">
            {notDeliveredToSentence(data.notDeliveredTo)}
          </p>
        )}
      </Section>

      {editing ? (
        <RegionDialog
          key={editing.id}
          region={editing}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          save={actions.saveRegion}
          onSaved={setData}
        />
      ) : null}
      <NotDeliveredToDialog
        open={editingCountries}
        onOpenChange={setEditingCountries}
        current={data.notDeliveredTo}
        choices={data.countryChoices}
        save={actions.saveCountries}
        onSaved={setData}
      />
    </div>
  );
}

/**
 * A lead time. On a phone it names itself ("Standard 5 to 10") and the last one carries the unit,
 * so a row reads "Standard 5 to 10 · Specialist 10 to 20 working days"; in the table the column
 * heading names it and each cell has its own unit. A region with no stated time has no unit.
 */
function leadTime(name: string, value: string, phoneUnit: string | null) {
  const stated = /\d/.test(value);
  return (
    <span className={stated ? "tabular-nums" : "text-staff-muted"}>
      <span className="md:hidden">{name} </span>
      {value}
      {stated ? (
        <>
          <span className="hidden text-staff-muted md:inline"> working days</span>
          {phoneUnit ? <span className="text-staff-muted md:hidden"> {phoneUnit}</span> : null}
        </>
      ) : null}
    </span>
  );
}
