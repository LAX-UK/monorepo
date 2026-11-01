import { describe, expect, it } from "vitest";
import { type SlotDraft, newSlotDraft } from "./cover-draft";
import type { CoverLotOption, CoverSlotView } from "./cover-view";
import { slotSummary } from "./slot-summary";

const lots: CoverLotOption[] = [
  { id: "lot-4", lotNumber: 4, title: "Estuary", images: [], dimensions: null },
];

const upload = (width: number, height: number, over: Partial<SlotDraft> = {}): SlotDraft => ({
  ...newSlotDraft({ kind: "upload", key: "covers/a.jpg" }, "covers/a.jpg", { width, height }),
  ...over,
});

describe("slotSummary", () => {
  it("says what an empty slot falls back to", () => {
    expect(slotSummary("default", undefined, undefined, lots, false).detail).toBe("Not set yet");
    expect(slotSummary("wide", undefined, undefined, lots, false).detail).toBe(
      "Uses the default with its focal point",
    );
    expect(slotSummary("phone", undefined, undefined, lots, false).detail).toBe(
      "Uses a crop of the default",
    );
  });

  it("says a slot still holds a picture from the old cover list", () => {
    const legacy: CoverSlotView = {
      source: "legacy",
      legacyKey: "old/a.jpg",
      issues: [],
      analysis: { status: "pending", value: null },
    };
    expect(slotSummary("default", undefined, legacy, lots, false).detail).toBe(
      "Picture from the old cover list",
    );
  });

  it("shows the size and where an uploaded or lot picture came from", () => {
    expect(slotSummary("default", upload(3600, 2400), undefined, lots, false)).toMatchObject({
      title: "Default",
      detail: "3600 × 2400 · uploaded",
      problem: false,
    });
    const fromLot = upload(3000, 2000, { source: { kind: "lot", lotId: "lot-4", imageIndex: 0 } });
    expect(slotSummary("default", fromLot, undefined, lots, false).detail).toBe(
      "3000 × 2000 · cover from lot 4",
    );
  });

  it("marks a picture under the floor as not used, with its size after the zoom", () => {
    const summary = slotSummary(
      "default",
      upload(3600, 2400, { zoom: 1.6 }),
      undefined,
      lots,
      false,
    );
    expect(summary).toEqual({
      title: "Default",
      detail: "2250 × 1500 zoomed · needs 2400 · not used",
      problem: true,
    });
    expect(slotSummary("phone", upload(640, 640), undefined, lots, true).detail).toBe(
      "640 × 640 · needs 1200 × 1200 · not used",
    );
  });
});
