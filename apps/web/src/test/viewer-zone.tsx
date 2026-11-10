import { ViewerZoneProvider } from "@auction/ui/time";
import { type RenderResult, render } from "@testing-library/react";
import type { ReactElement } from "react";

/** Sets the zone the visitor chose on this device, or clears it (`null`: no zone known). */
export function setViewerZone(zone: string | null): void {
  document.cookie = "lax_tz=; max-age=0; path=/";
  if (zone) document.cookie = `lax_tz=${encodeURIComponent(`fixed:${zone}`)}; path=/`;
}

/** Renders `ui` as a visitor whose own zone is `zone`. */
export function renderAsVisitorIn(zone: string | null, ui: ReactElement): RenderResult {
  setViewerZone(zone);
  return render(<ViewerZoneProvider initial={null}>{ui}</ViewerZoneProvider>);
}
