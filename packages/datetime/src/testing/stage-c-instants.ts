/** Fixed instants the stage C checks run on: GMT and BST, midnight edges, clock-change days, a year end. */
export const STAGE_C_INSTANTS: Date[] = [
  "2026-01-15T12:00:00Z",
  "2026-07-15T12:00:00Z",
  "2026-09-05T08:05:00Z",
  "2026-09-30T23:30:00Z",
  "2026-06-30T23:00:00Z",
  "2026-07-14T23:05:00Z",
  "2026-12-31T23:59:59.999Z",
  "2027-01-01T00:00:00Z",
  "2026-03-08T07:00:00Z",
  "2026-03-28T23:59:59.999Z",
  "2026-03-29T00:30:00Z",
  "2026-03-29T01:00:00Z",
  "2026-03-29T12:00:00Z",
  "2026-03-29T23:30:00Z",
  "2026-10-24T22:59:59.999Z",
  "2026-10-25T00:30:00Z",
  "2026-10-25T01:00:00Z",
  "2026-10-25T01:30:00Z",
  "2026-10-25T23:59:00Z",
  "2026-11-01T05:30:00Z",
  "2026-11-01T06:30:00Z",
].map((iso) => new Date(iso));

export const STAGE_C_ZONES = ["Europe/London", "Europe/Paris", "America/New_York", "UTC"] as const;
