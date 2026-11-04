import { describe, expect, it } from "vitest";
import { zohoArtworkNoticeEventKey } from "./zoho-artwork-notice.js";

const at = (iso: string) => new Date(iso);

describe("zohoArtworkNoticeEventKey", () => {
  it("is the same for the same Product and modified time, whenever it arrives", () => {
    const routing = { productId: "5001", modifiedTime: "2026-11-03T09:59:00.000Z" };
    expect(zohoArtworkNoticeEventKey(routing, at("2026-11-03T10:00:00Z"))).toBe(
      zohoArtworkNoticeEventKey(routing, at("2026-11-04T10:00:00Z")),
    );
  });

  it("differs by Product and by modified time", () => {
    const base = { productId: "5001", modifiedTime: "2026-11-03T09:59:00.000Z" };
    const key = zohoArtworkNoticeEventKey(base, at("2026-11-03T10:00:00Z"));
    expect(
      zohoArtworkNoticeEventKey({ ...base, productId: "5002" }, at("2026-11-03T10:00:00Z")),
    ).not.toBe(key);
    expect(
      zohoArtworkNoticeEventKey(
        { ...base, modifiedTime: "2026-11-03T10:01:00.000Z" },
        at("2026-11-03T10:00:00Z"),
      ),
    ).not.toBe(key);
  });

  it("groups notices without a modified time by the minute they arrive", () => {
    const routing = { productId: "5001" };
    const a = zohoArtworkNoticeEventKey(routing, at("2026-11-03T10:00:05Z"));
    expect(zohoArtworkNoticeEventKey(routing, at("2026-11-03T10:00:55Z"))).toBe(a);
    expect(zohoArtworkNoticeEventKey(routing, at("2026-11-03T10:01:05Z"))).not.toBe(a);
  });

  it("is safe as a queue job id: no colon", () => {
    const key = zohoArtworkNoticeEventKey(
      { productId: "5001", modifiedTime: "2026-11-03T09:59:00.000Z" },
      new Date(),
    );
    expect(key).toMatch(/^zoho-artwork-[0-9a-f]{40}$/);
  });
});
