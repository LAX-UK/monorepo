"use client";

import { PageHeader } from "@auction/staff-ui";
import type { LaxDensity } from "@auction/ui/lax";
import { SheetButtons } from "./sheet-buttons";
import { SheetFigures, SheetNotices, SheetToasts } from "./sheet-feedback";
import { SheetFields } from "./sheet-fields";
import { SheetDensitiesProvider } from "./sheet-frame";
import { SheetListToolbar, SheetOverlays } from "./sheet-lists";
import { SheetMenus } from "./sheet-menus";
import { SheetEmptyStates, SheetPresets, SheetToggles } from "./sheet-settings";
import { SheetStatus } from "./sheet-status";
import { SheetTabs } from "./sheet-tabs";

/**
 * The LAX system component sheet: the shared primitives from `@auction/ui/lax` in every state,
 * the staff density beside the client density. It is the reviewable artefact for the kit; pages
 * adopt an element only once it reads right here, in light, dark and at 375px.
 */
export function LaxComponentSheet({
  densities = ["staff", "client"],
}: {
  /** Both on the staff page; the client density alone on the review page outside Bid admin. */
  densities?: readonly LaxDensity[];
}) {
  return (
    <SheetDensitiesProvider densities={densities}>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="LAX system components"
          description={
            densities.length > 1
              ? "The shared elements of the staff tools and the client workspace, in every state. Each appears at the staff density and at the client density."
              : "The shared elements of the client workspace, in every state, at the client density."
          }
        />
        <SheetButtons />
        <SheetStatus />
        <SheetMenus />
        <SheetTabs />
        <SheetFields />
        <SheetNotices />
        <SheetFigures />
        <SheetToasts />
        <SheetListToolbar />
        <SheetOverlays />
        <SheetPresets />
        <SheetToggles />
        <SheetEmptyStates />
      </div>
    </SheetDensitiesProvider>
  );
}
