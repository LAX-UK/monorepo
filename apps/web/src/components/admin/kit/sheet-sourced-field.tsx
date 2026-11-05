"use client";

import { SourceMark, SourcedField } from "@auction/staff-ui";
import { SheetSection, StateRow } from "./sheet-frame";

export function SheetSourcedField() {
  return (
    <SheetSection
      id="sourced-field"
      densities={["staff"]}
      title="Value from another system"
      description="A read-only field for a value another system owns, such as a lax.art artwork's details that come from Zoho. The mark says where it comes from; the value stays at full contrast and takes no focus, because it is changed at its source."
    >
      {() => (
        <div className="flex flex-col gap-4">
          <StateRow label="Mark">
            <SourceMark source="From Zoho" />
          </StateRow>
          <div className="grid max-w-xl gap-4 sm:grid-cols-2">
            <SourcedField label="Title" source="From Zoho">
              Tidal margin IV
            </SourcedField>
            <SourcedField label="Year" source="From Zoho">
              2024
            </SourcedField>
            <SourcedField label="Medium" source="From Zoho">
              Oil on linen
            </SourcedField>
            <SourcedField label="Dimensions" source="From Zoho" emptyText="Not in Zoho yet" />
          </div>
        </div>
      )}
    </SheetSection>
  );
}
