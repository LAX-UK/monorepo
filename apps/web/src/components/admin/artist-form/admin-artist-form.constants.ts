import {
  ARTIST_SETUP_STEPS,
  ARTIST_STEP_FIELD_GROUPS,
} from "@/components/admin/artist-form/artist-setup-steps";
import type { ArtistStatus } from "@auction/types";

export const ARTIST_STATUS_OPTIONS: ReadonlyArray<{ value: ArtistStatus; label: string }> = [
  { value: "approved", label: "Approved (visible to public)" },
  { value: "pending", label: "Pending review" },
  { value: "rejected", label: "Rejected (hidden)" },
];

/** Map a form field error key (e.g. "attributes.movement") to its wizard step index. */
export function stepIndexForField(field: string): number {
  const head = field.split(".")[0] ?? field;
  const idx = ARTIST_STEP_FIELD_GROUPS.findIndex((group) => group.some((f) => String(f) === head));
  return idx >= 0 ? idx : ARTIST_SETUP_STEPS.length - 1;
}
