/** The fixed instants and zones the Stage A snapshot sweep renders (used by the snapshot test). */
export const SWEEP_INSTANTS: readonly string[] = [
  "2026-01-01T00:00:00Z", // year boundary, midnight GMT
  "2025-12-31T23:59:00Z", // last minute of the year
  "2026-01-15T09:05:00Z", // winter, leading-zero time
  "2026-03-29T00:30:00Z", // clocks go forward: before
  "2026-03-29T01:00:00Z", // the change itself
  "2026-03-29T01:30:00Z", // after
  "2026-03-31T23:30:00Z", // midnight edge in BST (next London day)
  "2026-06-18T14:30:00Z", // summer
  "2026-09-29T10:05:00Z", // September
  "2026-10-24T23:30:00Z", // midnight edge in BST
  "2026-10-25T00:30:00Z", // clocks go back: BST
  "2026-10-25T01:30:00Z", // GMT again
  "2026-11-03T21:00:00Z", // winter evening
  "2026-11-12T04:49:00Z", // the approved example
  "2027-01-01T00:00:00Z", // next year
];

export const SWEEP_ZONES: readonly string[] = ["Europe/London", "Europe/Paris", "America/New_York"];

export const SWEEP_NOW = new Date("2026-11-10T09:00:00Z");
