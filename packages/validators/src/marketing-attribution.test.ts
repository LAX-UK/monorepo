import { describe, expect, it } from "vitest";
import {
  attributionToPublisherParams,
  mergeAttributionSnapshot,
  mergeServerAttributionPut,
  parseAttributionTouchFromSearch,
  parseMarketingAttributionSnapshot,
} from "./marketing-attribution.js";

describe("parseAttributionTouchFromSearch", () => {
  it("returns null when no campaign params", () => {
    expect(
      parseAttributionTouchFromSearch("?foo=bar", "/lots", "2026-01-01T00:00:00.000Z"),
    ).toBeNull();
  });

  it("captures utm set and preserves case", () => {
    const touch = parseAttributionTouchFromSearch(
      "?utm_source=NewsLetter&utm_medium=Email&utm_campaign=Spring",
      "/",
      "2026-01-01T00:00:00.000Z",
    );
    expect(touch?.utmSource).toBe("NewsLetter");
    expect(touch?.utmMedium).toBe("Email");
    expect(touch?.utmCampaign).toBe("Spring");
  });

  it("uses the first duplicate parameter and ignores oversized values", () => {
    const touch = parseAttributionTouchFromSearch(
      `?utm_source=first&utm_source=second&utm_campaign=${"x".repeat(257)}&gclid=click-1`,
      "/landing",
      "2026-01-01T00:00:00.000Z",
    );
    expect(touch).toMatchObject({ utmSource: "first", gclid: "click-1" });
    expect(touch?.utmCampaign).toBeUndefined();
  });

  it("handles malformed encoding without throwing", () => {
    expect(() =>
      parseAttributionTouchFromSearch(
        "?utm_source=%E0%A4%A",
        "/landing",
        "2026-01-01T00:00:00.000Z",
      ),
    ).not.toThrow();
  });
});

describe("mergeAttributionSnapshot", () => {
  const t1 = {
    capturedAt: "2026-01-01T00:00:00.000Z",
    landingPath: "/a",
    utmSource: "a",
    utmMedium: "cpc",
    utmCampaign: "one",
  };
  const t2 = {
    capturedAt: "2026-01-02T00:00:00.000Z",
    landingPath: "/b",
    utmSource: "b",
    utmMedium: "email",
    utmCampaign: "two",
  };

  it("sets first touch once", () => {
    const s1 = mergeAttributionSnapshot(null, t1);
    const s2 = mergeAttributionSnapshot(s1, t2);
    expect(s2.firstTouch?.utmCampaign).toBe("one");
    expect(s2.lastTouch?.utmCampaign).toBe("two");
  });

  it("does not move last touch backwards", () => {
    const s1 = mergeAttributionSnapshot(null, t2);
    const older = { ...t1, capturedAt: "2025-12-01T00:00:00.000Z" };
    const s2 = mergeAttributionSnapshot(s1, older);
    expect(s2.lastTouch?.utmCampaign).toBe("two");
  });
});

describe("server attribution contract", () => {
  const first = {
    capturedAt: "2026-01-01T00:00:00.000Z",
    landingPath: "/first",
    utmSource: "newsletter",
  };
  const newer = {
    capturedAt: "2026-01-03T00:00:00.000Z",
    landingPath: "/newer",
    utmSource: "paid",
    gclid: "google-click",
  };

  it("rejects empty and malformed snapshots", () => {
    expect(parseMarketingAttributionSnapshot({ version: 1 })).toBeNull();
    expect(
      parseMarketingAttributionSnapshot({
        version: 1,
        firstTouch: { ...first, capturedAt: "not-a-date" },
      }),
    ).toBeNull();
  });

  it("preserves first touch and updates last touch monotonically", () => {
    const existing = { version: 1 as const, firstTouch: first, lastTouch: newer };
    const incoming = {
      version: 1 as const,
      firstTouch: newer,
      lastTouch: first,
    };
    expect(mergeServerAttributionPut(existing, incoming)).toEqual(existing);
  });

  it("emits namespaced UTM and click-id parameters", () => {
    expect(attributionToPublisherParams("last", newer)).toMatchObject({
      attribution_last_source: "paid",
      attribution_last_gclid: "google-click",
      attribution_last_landing_path: "/newer",
    });
  });
});
