import type { ViewerZoneSource } from "@auction/datetime";

/** What the visitor is using now. */
export type SavedZone = { zone: string; source: ViewerZoneSource };

/** What the sheet currently has selected: follow the device, or always use one zone. */
export type ZoneChoiceState = { mode: "automatic" } | { mode: "fixed"; zone: string | null };

/** The sheet opens on what is in use: Automatic for a device reading, else the saved city. */
export function initialZoneChoice(saved: SavedZone): ZoneChoiceState {
  return saved.source === "device" ? { mode: "automatic" } : { mode: "fixed", zone: saved.zone };
}

/** Save is for a change: nothing to save while the choice is what is already in use. */
export function canSaveZoneChoice(choice: ZoneChoiceState, saved: SavedZone): boolean {
  if (choice.mode === "automatic") return saved.source !== "device";
  if (!choice.zone) return false;
  return saved.source === "device" || saved.zone !== choice.zone;
}
