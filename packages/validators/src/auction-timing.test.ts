import { describe, expect, it } from "vitest";
import {
  normalizeAuctionTime,
  toActiveCountdownEndIso,
  toOptionalIsoString,
  toRequiredIsoString,
} from "./auction-timing.js";

describe("normalizeAuctionTime", () => {
  it("returns ISO strings for valid dates and strings", () => {
    expect(normalizeAuctionTime("2026-06-01T12:00:00.000Z")).toBe("2026-06-01T12:00:00.000Z");
    expect(normalizeAuctionTime(new Date("2026-06-01T12:00:00.000Z"))).toBe(
      "2026-06-01T12:00:00.000Z",
    );
  });

  it("returns null for missing or invalid values", () => {
    expect(normalizeAuctionTime(null)).toBeNull();
    expect(normalizeAuctionTime("")).toBeNull();
    expect(normalizeAuctionTime("not-a-date")).toBeNull();
    expect(normalizeAuctionTime(new Date(Number.NaN))).toBeNull();
  });
});

describe("toOptionalIsoString", () => {
  it("returns undefined for invalid unknown values", () => {
    expect(toOptionalIsoString(null)).toBeUndefined();
    expect(toOptionalIsoString("bad")).toBeUndefined();
  });
});

describe("toRequiredIsoString", () => {
  it("falls back when timing is unknown", () => {
    expect(toRequiredIsoString(null, "—")).toBe("—");
  });
});

describe("toActiveCountdownEndIso", () => {
  it("returns end ISO only for active sales", () => {
    expect(toActiveCountdownEndIso("active", "2026-06-01T12:00:00.000Z")).toBe(
      "2026-06-01T12:00:00.000Z",
    );
    expect(toActiveCountdownEndIso("scheduled", "2026-06-01T12:00:00.000Z")).toBeUndefined();
  });

  it("suppresses past-end countdown for saleroom delivery modes", () => {
    const now = new Date("2026-06-02T12:00:00.000Z");
    expect(
      toActiveCountdownEndIso("active", "2026-06-01T12:00:00.000Z", {
        deliveryMode: "hybrid",
        now,
      }),
    ).toBeUndefined();
    expect(
      toActiveCountdownEndIso("active", "2026-06-01T12:00:00.000Z", {
        deliveryMode: "onsite",
        now,
      }),
    ).toBeUndefined();
  });

  it("keeps past-end countdown for online sales", () => {
    const now = new Date("2026-06-02T12:00:00.000Z");
    expect(
      toActiveCountdownEndIso("active", "2026-06-01T12:00:00.000Z", {
        deliveryMode: "online",
        now,
      }),
    ).toBe("2026-06-01T12:00:00.000Z");
  });

  it("keeps future-end countdown for saleroom sales", () => {
    const now = new Date("2026-05-31T12:00:00.000Z");
    expect(
      toActiveCountdownEndIso("active", "2026-06-01T12:00:00.000Z", {
        deliveryMode: "hybrid",
        now,
      }),
    ).toBe("2026-06-01T12:00:00.000Z");
  });
});
