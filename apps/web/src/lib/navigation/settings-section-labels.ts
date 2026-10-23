/** Human-readable labels for `/dashboard/settings/*` leaf routes. */
export const SETTINGS_SECTION_LABELS: Record<string, string> = {
  profile: "Profile",
  account: "Account",
  security: "Security",
  appearance: "Appearance and layout",
  notifications: "Auction alerts and notifications",
  bidding: "Bidding limits",
  addresses: "Addresses",
  sessions: "Sessions",
  "two-factor": "Two-factor authentication",
  confirm: "Confirm changes",
};

export function settingsSectionLabel(segment: string): string {
  return SETTINGS_SECTION_LABELS[segment] ?? segment.replace(/-/g, " ");
}
