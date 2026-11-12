import { cityName, formatDate, formatWhen } from "@auction/datetime";
import { describe, expect, it } from "vitest";

/**
 * Identity writes its notice times with plain Intl because it must not import `@auction/datetime`
 * (see scripts/check-layers.mjs), so it stays extractable. This pins that copy to the shared
 * style: every moment it formats must read exactly as `@auction/datetime` would write it. The
 * file is loaded by path because the API may not import the Identity app as a package.
 */
type IdentityFormats = {
  formatLondonTime(at: Date): string;
  formatLondonDate(at: Date): string;
  formatNoticeTime(at: Date, savedZone: string | null): string;
};

const identityFormatsUrl = new URL("../../auth/src/services/format-london-time.ts", import.meta.url)
  .href;

/** Instants either side of each clock change, in September ("Sept" in en-GB) and at year ends. */
const INSTANTS = [
  "2026-01-01T00:00:00Z",
  "2026-03-08T07:30:00Z",
  "2026-03-29T00:59:59Z",
  "2026-03-29T01:00:00Z",
  "2026-04-05T15:59:00Z",
  "2026-06-15T12:00:00Z",
  "2026-09-03T08:15:00Z",
  "2026-10-04T15:00:00Z",
  "2026-10-25T00:30:00Z",
  "2026-10-25T01:30:00Z",
  "2026-11-01T06:00:00Z",
  "2026-12-31T23:59:00Z",
  "2027-09-30T22:45:00Z",
].map((at) => new Date(at));

const ZONES = [
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "America/St_Johns",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Dubai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Australia/Lord_Howe",
  "Pacific/Auckland",
  "Pacific/Chatham",
  "Pacific/Kiritimati",
  "Pacific/Pago_Pago",
] as const;

/** The shared style for the same moment: `formatWhen` with `now` in the same year, then the place. */
function shared(at: Date, zone: string): string {
  const when = formatWhen(at, zone, at);
  return zone === "Europe/London" ? when : `${when} (${cityName(zone)})`;
}

describe("Identity's notice times match @auction/datetime", async () => {
  const identity = (await import(/* @vite-ignore */ identityFormatsUrl)) as IdentityFormats;

  it.each(ZONES)("reads a moment in %s as the shared style does", (zone) => {
    for (const at of INSTANTS) {
      expect(identity.formatNoticeTime(at, zone === "Europe/London" ? null : zone)).toBe(
        shared(at, zone),
      );
    }
  });

  it("writes London moments exactly as the shared style does, GMT and BST", () => {
    for (const at of INSTANTS) {
      expect(identity.formatLondonTime(at)).toBe(formatWhen(at, "Europe/London", at));
    }
  });

  it("writes London dates as the shared long date", () => {
    for (const at of INSTANTS) {
      expect(identity.formatLondonDate(at)).toBe(
        formatDate(at, "Europe/London", { month: "long" }),
      );
    }
  });
});
