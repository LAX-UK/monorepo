import { normaliseViewerZone } from "@auction/datetime";
import { accountPlaceZoneSchema, parseAccountTimeZoneChange } from "@auction/identity-contracts";
import { describe, expect, it } from "vitest";

/**
 * Identity cannot import `@auction/datetime` (it must stay extractable), so it carries its own copy
 * of the place-zone rule. This is where both can be seen: they must agree on every zone.
 */
const EXTRA = [
  "UTC",
  "GMT",
  "Etc/UTC",
  "Etc/GMT+5",
  "Etc/GMT-14",
  "Asia/Calcutta",
  "Asia/Kolkata",
  "America/Argentina/Buenos_Aires",
  "Europe/Kyiv",
  "Europe/Kiev",
  "London",
  "europe/london",
  " Europe/London",
  "Europe/London ",
  "Mars/Olympus",
  "Europe/",
  "/London",
  "",
  "+01:00",
];

describe("the account zone rule matches the shared viewer-zone rule", () => {
  const zones = [...Intl.supportedValuesOf("timeZone"), ...EXTRA];

  it("agrees on every zone the runtime knows and on the awkward names", () => {
    const disagreements = zones.filter(
      (zone) =>
        accountPlaceZoneSchema.safeParse(zone).success !== (normaliseViewerZone(zone) !== null),
    );
    expect(disagreements).toEqual([]);
  });

  it("agrees on values that are not text", () => {
    for (const value of [null, undefined, 0, 7, {}, [], true]) {
      expect(accountPlaceZoneSchema.safeParse(value).success).toBe(
        normaliseViewerZone(value) !== null,
      );
    }
  });

  it("applies the rule to a device reading and to a chosen zone alike", () => {
    for (const zone of zones) {
      const device = parseAccountTimeZoneChange({ mode: "automatic", zone });
      expect(device).toEqual({ mode: "automatic", deviceZone: normaliseViewerZone(zone) });
      const fixed = parseAccountTimeZoneChange({ mode: "fixed", zone });
      expect(fixed).toEqual(
        normaliseViewerZone(zone) ? { mode: "fixed", zone: normaliseViewerZone(zone) } : null,
      );
    }
  });
});
