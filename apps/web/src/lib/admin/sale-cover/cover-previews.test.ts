import { coverAnalysisHash } from "@auction/domain";
import type { CoverAnalysis, CoverToneSolution, SaleCoverSlot } from "@auction/types";
import { describe, expect, it } from "vitest";
import { type SlotDraft, newSlotDraft } from "./cover-draft";
import { cropPreview, measureState, readTone, slotServingBox, toneBadge } from "./cover-previews";
import type { CoverSlotView } from "./cover-view";

const draft = (over: Partial<SlotDraft> = {}): SlotDraft => ({
  ...newSlotDraft({ kind: "upload", key: "covers/a.jpg" }, "covers/a.jpg", {
    width: 3200,
    height: 1800,
  }),
  alt: "A harbour",
  focal: { x: 0.7, y: 0.5 },
  ...over,
});

function savedFor(
  source: SlotDraft,
  status: "pending" | "ready" | "failed",
  analysis: CoverAnalysis | null,
) {
  const stored: Omit<SaleCoverSlot, "analysisHash"> = {
    key: "covers/a.jpg",
    width: source.size?.width ?? 0,
    height: source.size?.height ?? 0,
    focal: source.focal,
    zoom: source.zoom,
    alt: source.alt,
    ...(source.sideOverride ? { sideOverride: source.sideOverride } : {}),
  };
  const view: CoverSlotView = {
    source: "slot",
    slot: { ...stored, analysisHash: coverAnalysisHash("default", stored) },
    issues: [],
    analysis: { status, value: analysis },
  };
  return view;
}

const solution = (strength: number, lowest: number): CoverToneSolution => ({
  strength,
  creditBand: 0.5,
  rawStrength: strength,
  contrast: { eyebrow: 6, title: 8, sub: lowest, link: 7, credit: 5 },
});

const analysis: CoverAnalysis = {
  version: 1,
  dominant: "#223344",
  deepest: "#112233",
  field: "#0a1420",
  blurDataURL: "data:image/png;base64,AAAA",
  breakpoints: {
    desktop: {
      zones: {} as never,
      light: solution(0.52, 4.66),
      dark: null,
      recommended: "light",
    },
    wide: {
      zones: {} as never,
      light: solution(0.5, 5.1),
      dark: solution(0.6, 4.9),
      recommended: "light",
    },
  },
};

describe("which slot a preview shows", () => {
  it("uses the wide and phone slots when set, and the default otherwise", () => {
    expect(slotServingBox("wide", { default: 1 })).toBe("default");
    expect(slotServingBox("wide", { default: 1, wide: 1 })).toBe("wide");
    expect(slotServingBox("phone", { default: 1, wide: 1 })).toBe("default");
    expect(slotServingBox("phone", { default: 1, phone: 1 })).toBe("phone");
    expect(slotServingBox("desktop", { default: 1, wide: 1, phone: 1 })).toBe("default");
  });
});

describe("cropPreview", () => {
  it("puts the focal point on the far third from the text", () => {
    const left = cropPreview("desktop", "default", draft({ focal: { x: 0.7, y: 0.5 } }));
    expect(left?.side).toBe("left");
    const right = cropPreview("desktop", "default", draft({ focal: { x: 0.2, y: 0.5 } }));
    expect(right?.side).toBe("right");
    expect(left?.zones).toHaveLength(5);
  });

  it("honours the side override and draws no text zones on the phone", () => {
    expect(cropPreview("desktop", "default", draft({ sideOverride: "right" }))?.side).toBe("right");
    const phone = cropPreview("phone", "default", draft());
    expect(phone?.side).toBeNull();
    expect(phone?.zones).toEqual([]);
  });

  it("cannot draw a crop until the picture has been measured", () => {
    expect(cropPreview("desktop", "default", draft({ size: null }))).toBeNull();
  });

  it("zooming in narrows the part of the picture shown", () => {
    const whole = cropPreview("desktop", "default", draft({ zoom: 1 }));
    const detail = cropPreview("desktop", "default", draft({ zoom: 2 }));
    expect(detail && whole && detail.crop.width < whole.crop.width).toBe(true);
  });
});

describe("measureState", () => {
  it("is ready when the analysis was measured from exactly what is on screen", () => {
    const now = draft();
    expect(measureState("default", now, savedFor(now, "ready", analysis))).toEqual({
      kind: "ready",
      analysis,
    });
  });

  it("is pending until the worker has stored the measurement", () => {
    const now = draft();
    expect(measureState("default", now, savedFor(now, "pending", null)).kind).toBe("pending");
  });

  it("reports a failed measurement", () => {
    const now = draft();
    expect(measureState("default", now, savedFor(now, "failed", null)).kind).toBe("failed");
  });

  it("is unsaved as soon as the focal point, zoom or side changes", () => {
    const saved = savedFor(draft(), "ready", analysis);
    expect(measureState("default", draft({ focal: { x: 0.2, y: 0.5 } }), saved).kind).toBe(
      "unsaved",
    );
    expect(measureState("default", draft({ zoom: 1.4 }), saved).kind).toBe("unsaved");
    expect(measureState("default", draft({ sideOverride: "right" }), saved).kind).toBe("unsaved");
  });

  it("stays measured when only the tone, alt text or keep area changes", () => {
    const saved = savedFor(draft(), "ready", analysis);
    expect(measureState("default", draft({ toneOverride: "dark" }), saved).kind).toBe("ready");
    expect(measureState("default", draft({ alt: "Another" }), saved).kind).toBe("ready");
    expect(
      measureState("default", draft({ keep: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }), saved)
        .kind,
    ).toBe("ready");
  });

  it("is unsaved for a slot never saved, and none for an empty slot", () => {
    expect(measureState("default", draft(), undefined).kind).toBe("unsaved");
    expect(measureState("default", undefined, undefined).kind).toBe("none");
  });
});

describe("readTone", () => {
  const ready = { kind: "ready", analysis } as const;

  it("shows the recommended tone and the lowest contrast line", () => {
    const reading = readTone("desktop", ready, undefined);
    expect(reading).toMatchObject({ kind: "measured", tone: "light", automatic: true });
    expect(reading.kind === "measured" && reading.lowest).toEqual({ line: "sub", ratio: 4.66 });
    expect(toneBadge(reading)).toBe("AA · 4.66:1 lowest");
  });

  it("applies a staff tone override", () => {
    const reading = readTone("wide", ready, "dark");
    expect(reading).toMatchObject({ kind: "measured", tone: "dark", automatic: false });
    expect(reading.kind === "measured" && reading.scrim.strength).toBe(0.6);
  });

  it("falls back to the plate when the chosen tone cannot reach contrast", () => {
    expect(readTone("desktop", ready, "dark")).toEqual({ kind: "plate" });
    expect(toneBadge({ kind: "plate" })).toBe("Type on a plate");
  });

  it("says type sits below the picture on a phone", () => {
    expect(toneBadge(readTone("phone", ready, undefined))).toBe("Type below the image");
  });

  it("says why a size is not measured", () => {
    expect(toneBadge(readTone("desktop", { kind: "pending" }, undefined))).toBe("Analysing…");
    expect(toneBadge(readTone("desktop", { kind: "unsaved" }, undefined))).toBe(
      "Measured after saving",
    );
    expect(toneBadge(readTone("desktop", { kind: "failed" }, undefined))).toBe(
      "Could not be measured",
    );
    expect(toneBadge(readTone("desktop", { kind: "none" }, undefined))).toBe("Not measured");
  });
});
