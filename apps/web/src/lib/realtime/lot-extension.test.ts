import { DEFAULT_ANTI_SNIPING_EXTENSION_MS } from "@auction/validators";
import { describe, expect, it } from "vitest";
import { extensionAddedMs, parseLotExtension } from "./lot-extension";

describe("parseLotExtension", () => {
  it("reads the page-level event with the server's clock", () => {
    expect(
      parseLotExtension({
        lotId: "l1",
        extendedUntil: "2026-11-09T18:42:30.000Z",
        serverNow: "2026-11-09T18:41:55.000Z",
      }),
    ).toEqual({
      endTimeMs: Date.parse("2026-11-09T18:42:30.000Z"),
      serverNowMs: Date.parse("2026-11-09T18:41:55.000Z"),
    });
  });

  it("reads the older event, which has no server clock", () => {
    expect(
      parseLotExtension({
        type: "lot_extended",
        lotId: "l1",
        newEndTime: "2026-11-09T18:42:30.000Z",
      }),
    ).toEqual({
      endTimeMs: Date.parse("2026-11-09T18:42:30.000Z"),
      serverNowMs: null,
    });
  });

  it("rejects anything else", () => {
    expect(parseLotExtension(null)).toBeNull();
    expect(parseLotExtension({ extendedUntil: "soon" })).toBeNull();
    expect(parseLotExtension("x")).toBeNull();
  });
});

describe("extensionAddedMs", () => {
  const ext = (end: number) => ({ endTimeMs: end, serverNowMs: null });
  it("is the move in the close, up to the standing extension", () => {
    expect(extensionAddedMs(1_000_000, ext(1_020_000))).toBe(20_000);
    expect(extensionAddedMs(1_000_000, ext(1_030_000))).toBe(DEFAULT_ANTI_SNIPING_EXTENSION_MS);
  });
  it("is capped when the page was waiting at zero", () => {
    expect(extensionAddedMs(1_000_000, ext(1_500_000))).toBe(DEFAULT_ANTI_SNIPING_EXTENSION_MS);
  });
  it("is zero when the close did not move forward", () => {
    expect(extensionAddedMs(1_000_000, ext(900_000))).toBe(0);
  });
});
