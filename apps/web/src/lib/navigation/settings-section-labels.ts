/** Human-readable labels for `/dashboard/settings/*` leaf routes. */
export const SETTINGS_SECTION_LABELS: Record<string, string> = {
  appearance: "Appearance and layout",
  notifications: "Auction alerts and notifications",
  bidding: "Bidding limits",
};

export function settingsSectionLabel(segment: string): string {
  return SETTINGS_SECTION_LABELS[segment] ?? segment.replace(/-/g, " ");
}
