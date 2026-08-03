import { describe, expect, it } from "vitest";
import {
  type SaleStreamInput,
  hasValidStreamUrl,
  resolveSaleStreamContext,
  resolveStreamPhase,
  resolveStreamPresentation,
  shouldShowStreamOnSurface,
} from "./sale-stream-policy";

const YOUTUBE = "https://www.youtube.com/watch?v=jNQXAC9IVRw";
const NON_EMBED = "https://example.com/watch";

function make(overrides: Partial<SaleStreamInput> = {}): SaleStreamInput {
  return {
    streamUrl: YOUTUBE,
    status: "active",
    deliveryMode: "hybrid",
    saleTitle: "Evening Sale",
    ...overrides,
  };
}

// ─── hasValidStreamUrl ────────────────────────────────────────────────────────

describe("hasValidStreamUrl", () => {
  it.each([null, undefined, "", "   "])("returns false for %s", (url) => {
    expect(hasValidStreamUrl(url as string | null | undefined)).toBe(false);
  });
  it("returns true for a non-empty URL", () => {
    expect(hasValidStreamUrl(YOUTUBE)).toBe(true);
    expect(hasValidStreamUrl(NON_EMBED)).toBe(true);
  });
});

// ─── resolveStreamPhase ───────────────────────────────────────────────────────

describe("resolveStreamPhase", () => {
  it("scheduled → upcoming", () => expect(resolveStreamPhase("scheduled")).toBe("upcoming"));
  it("active → live", () => expect(resolveStreamPhase("active")).toBe("live"));
  it("ended → recording", () => expect(resolveStreamPhase("ended")).toBe("recording"));
  it.each(["draft", "cancelled", "voided"] as const)("%s → null", (s) => {
    expect(resolveStreamPhase(s)).toBeNull();
  });
});

// ─── shouldShowStreamOnSurface — delivery mode guard ─────────────────────────

describe("shouldShowStreamOnSurface — online mode never shows stream", () => {
  it.each(["scheduled", "active", "ended"] as const)(
    "status %s hidden on both surfaces",
    (status) => {
      const input = make({ deliveryMode: "online", status });
      expect(shouldShowStreamOnSurface(input, "lotPage")).toBe(false);
      expect(shouldShowStreamOnSurface(input, "salePage")).toBe(false);
    },
  );
});

// ─── shouldShowStreamOnSurface — streamUrl guard ─────────────────────────────

describe("shouldShowStreamOnSurface — invalid URLs always hidden", () => {
  it.each([null, "", "   "])("streamUrl = %s", (url) => {
    const input = make({ streamUrl: url as string | null, status: "active" });
    expect(shouldShowStreamOnSurface(input, "lotPage")).toBe(false);
    expect(shouldShowStreamOnSurface(input, "salePage")).toBe(false);
  });
});

// ─── shouldShowStreamOnSurface — full status × surface matrix ────────────────

describe("shouldShowStreamOnSurface — onsite mode", () => {
  const base = { deliveryMode: "onsite", streamUrl: YOUTUBE } as const;

  it("draft → hidden on both surfaces", () => {
    const i = make({ ...base, status: "draft" });
    expect(shouldShowStreamOnSurface(i, "lotPage")).toBe(false);
    expect(shouldShowStreamOnSurface(i, "salePage")).toBe(false);
  });

  it("scheduled → visible on both surfaces", () => {
    const i = make({ ...base, status: "scheduled" });
    expect(shouldShowStreamOnSurface(i, "lotPage")).toBe(true);
    expect(shouldShowStreamOnSurface(i, "salePage")).toBe(true);
  });

  it("active → visible on both surfaces", () => {
    const i = make({ ...base, status: "active" });
    expect(shouldShowStreamOnSurface(i, "lotPage")).toBe(true);
    expect(shouldShowStreamOnSurface(i, "salePage")).toBe(true);
  });

  it("ended → hidden on lotPage, visible on salePage", () => {
    const i = make({ ...base, status: "ended" });
    expect(shouldShowStreamOnSurface(i, "lotPage")).toBe(false);
    expect(shouldShowStreamOnSurface(i, "salePage")).toBe(true);
  });

  it("cancelled → hidden on both surfaces", () => {
    const i = make({ ...base, status: "cancelled" });
    expect(shouldShowStreamOnSurface(i, "lotPage")).toBe(false);
    expect(shouldShowStreamOnSurface(i, "salePage")).toBe(false);
  });
});

describe("shouldShowStreamOnSurface — hybrid mode", () => {
  const base = { deliveryMode: "hybrid", streamUrl: YOUTUBE } as const;

  it("draft → hidden everywhere", () => {
    const i = make({ ...base, status: "draft" });
    expect(shouldShowStreamOnSurface(i, "lotPage")).toBe(false);
    expect(shouldShowStreamOnSurface(i, "salePage")).toBe(false);
  });

  it("scheduled → both visible", () => {
    const i = make({ ...base, status: "scheduled" });
    expect(shouldShowStreamOnSurface(i, "lotPage")).toBe(true);
    expect(shouldShowStreamOnSurface(i, "salePage")).toBe(true);
  });

  it("active → both visible", () => {
    const i = make({ ...base, status: "active" });
    expect(shouldShowStreamOnSurface(i, "lotPage")).toBe(true);
    expect(shouldShowStreamOnSurface(i, "salePage")).toBe(true);
  });

  it("ended → lotPage hidden, salePage visible (recording)", () => {
    const i = make({ ...base, status: "ended" });
    expect(shouldShowStreamOnSurface(i, "lotPage")).toBe(false);
    expect(shouldShowStreamOnSurface(i, "salePage")).toBe(true);
  });

  it("cancelled → both hidden", () => {
    const i = make({ ...base, status: "cancelled" });
    expect(shouldShowStreamOnSurface(i, "lotPage")).toBe(false);
    expect(shouldShowStreamOnSurface(i, "salePage")).toBe(false);
  });
});

// non-embeddable URL follows same visibility rules as embeddable
describe("shouldShowStreamOnSurface — non-embeddable URL", () => {
  it("active hybrid + non-embeddable → visible on both (external link fallback)", () => {
    const i = make({ streamUrl: NON_EMBED, status: "active", deliveryMode: "hybrid" });
    expect(shouldShowStreamOnSurface(i, "lotPage")).toBe(true);
    expect(shouldShowStreamOnSurface(i, "salePage")).toBe(true);
  });

  it("ended hybrid + non-embeddable → lotPage hidden, salePage visible", () => {
    const i = make({ streamUrl: NON_EMBED, status: "ended", deliveryMode: "hybrid" });
    expect(shouldShowStreamOnSurface(i, "lotPage")).toBe(false);
    expect(shouldShowStreamOnSurface(i, "salePage")).toBe(true);
  });
});

// ─── resolveStreamPresentation ───────────────────────────────────────────────

describe("resolveStreamPresentation", () => {
  it("returns null when surface should not show stream", () => {
    const i = make({ status: "ended", deliveryMode: "hybrid" });
    expect(resolveStreamPresentation(i, "lotPage")).toBeNull();
  });

  it("upcoming phase — live stream copy, no pulse icon", () => {
    const p = resolveStreamPresentation(make({ status: "scheduled" }), "lotPage");
    expect(p?.phase).toBe("upcoming");
    expect(p?.sectionHeading).toBe("Live stream");
    expect(p?.embedCtaLabel).toBe("Watch live");
    expect(p?.showPulseIcon).toBe(false);
    expect(p?.overviewTag).toBe("Live stream");
  });

  it("live phase — live stream copy, pulse icon", () => {
    const p = resolveStreamPresentation(make({ status: "active" }), "lotPage");
    expect(p?.phase).toBe("live");
    expect(p?.sectionHeading).toBe("Live stream");
    expect(p?.embedCtaLabel).toBe("Watch live");
    expect(p?.showPulseIcon).toBe(true);
    expect(p?.overviewTag).toBe("Live stream");
  });

  it("recording phase — saleroom recording copy, no pulse, Watch recording CTA", () => {
    const p = resolveStreamPresentation(make({ status: "ended" }), "salePage");
    expect(p?.phase).toBe("recording");
    expect(p?.sectionHeading).toBe("Saleroom recording");
    expect(p?.embedCtaLabel).toBe("Watch recording");
    expect(p?.showPulseIcon).toBe(false);
    expect(p?.overviewTag).toBe("Saleroom recording");
  });

  it("recording phase — body includes sale title", () => {
    const p = resolveStreamPresentation(
      make({ status: "ended", saleTitle: "Evening Auction" }),
      "salePage",
    );
    expect(p?.sectionBody).toContain("Evening Auction");
  });

  it("recording phase — body includes formatted end date when endTime provided", () => {
    const endTime = new Date("2026-06-14T18:00:00.000Z");
    const p = resolveStreamPresentation(make({ status: "ended", endTime }), "salePage");
    expect(p?.sectionBody).toContain("14");
    expect(p?.sectionBody).toContain("Jun");
    expect(p?.sectionBody).toContain("2026");
  });

  it("recording phase — body omits date suffix when endTime not provided", () => {
    const p = resolveStreamPresentation(make({ status: "ended" }), "salePage");
    expect(p?.sectionBody).not.toContain("·");
  });

  it("iframe title uses 'Live stream:' prefix for live phase", () => {
    const p = resolveStreamPresentation(make({ status: "active" }), "lotPage");
    expect(p?.embedTitle).toMatch(/^Live stream:/);
  });

  it("iframe title uses 'Saleroom recording:' prefix for recording phase", () => {
    const p = resolveStreamPresentation(make({ status: "ended" }), "salePage");
    expect(p?.embedTitle).toMatch(/^Saleroom recording:/);
  });
});

// ─── resolveSaleStreamContext ─────────────────────────────────────────────────

describe("resolveSaleStreamContext", () => {
  it("hybrid + active + URL → both surfaces visible, phase live", () => {
    const ctx = resolveSaleStreamContext(make({ status: "active", deliveryMode: "hybrid" }));
    expect(ctx.showOnLotPage).toBe(true);
    expect(ctx.showOnSalePage).toBe(true);
    expect(ctx.phase).toBe("live");
    expect(ctx.presentation?.phase).toBe("live");
  });

  it("hybrid + ended + URL → lotPage hidden, salePage visible, phase recording", () => {
    const ctx = resolveSaleStreamContext(make({ status: "ended", deliveryMode: "hybrid" }));
    expect(ctx.showOnLotPage).toBe(false);
    expect(ctx.showOnSalePage).toBe(true);
    expect(ctx.phase).toBe("recording");
    expect(ctx.presentation?.phase).toBe("recording");
  });

  it("onsite + scheduled + URL → both visible, phase upcoming", () => {
    const ctx = resolveSaleStreamContext(make({ status: "scheduled", deliveryMode: "onsite" }));
    expect(ctx.showOnLotPage).toBe(true);
    expect(ctx.showOnSalePage).toBe(true);
    expect(ctx.phase).toBe("upcoming");
  });

  it("any + cancelled + URL → both hidden, presentation null", () => {
    for (const deliveryMode of ["onsite", "hybrid"] as const) {
      const ctx = resolveSaleStreamContext(make({ status: "cancelled", deliveryMode }));
      expect(ctx.showOnLotPage).toBe(false);
      expect(ctx.showOnSalePage).toBe(false);
      expect(ctx.presentation).toBeNull();
    }
  });

  it("online + active + URL → hidden on both surfaces", () => {
    const ctx = resolveSaleStreamContext(make({ status: "active", deliveryMode: "online" }));
    expect(ctx.showOnLotPage).toBe(false);
    expect(ctx.showOnSalePage).toBe(false);
    expect(ctx.allowsStream).toBe(false);
    expect(ctx.presentation).toBeNull();
  });

  it("hybrid + ended + null URL → both hidden, phase null", () => {
    const ctx = resolveSaleStreamContext(make({ status: "ended", streamUrl: null }));
    expect(ctx.hasStreamUrl).toBe(false);
    expect(ctx.showOnLotPage).toBe(false);
    expect(ctx.showOnSalePage).toBe(false);
    expect(ctx.phase).toBe("recording"); // phase from status alone
    expect(ctx.presentation).toBeNull();
  });

  it("hybrid + draft + URL → both hidden, phase null", () => {
    const ctx = resolveSaleStreamContext(make({ status: "draft", deliveryMode: "hybrid" }));
    expect(ctx.showOnLotPage).toBe(false);
    expect(ctx.showOnSalePage).toBe(false);
    expect(ctx.phase).toBeNull();
  });

  it("hasStreamUrl false when url is whitespace", () => {
    const ctx = resolveSaleStreamContext(make({ streamUrl: "   " }));
    expect(ctx.hasStreamUrl).toBe(false);
    expect(ctx.showOnLotPage).toBe(false);
    expect(ctx.showOnSalePage).toBe(false);
  });

  it("non-embeddable URL produces correct context (visibility same as embeddable)", () => {
    const ctx = resolveSaleStreamContext(
      make({ streamUrl: NON_EMBED, status: "ended", deliveryMode: "onsite" }),
    );
    expect(ctx.showOnLotPage).toBe(false);
    expect(ctx.showOnSalePage).toBe(true);
    expect(ctx.presentation?.embedCtaLabel).toBe("Watch recording");
  });

  it("allowsStream reflects saleroom delivery mode only", () => {
    expect(resolveSaleStreamContext(make({ deliveryMode: "online" })).allowsStream).toBe(false);
    expect(resolveSaleStreamContext(make({ deliveryMode: "onsite" })).allowsStream).toBe(true);
    expect(resolveSaleStreamContext(make({ deliveryMode: "hybrid" })).allowsStream).toBe(true);
  });

  it("voided status treated same as draft — both surfaces hidden", () => {
    const ctx = resolveSaleStreamContext(
      make({ status: "voided" as SaleStreamInput["status"], deliveryMode: "hybrid" }),
    );
    expect(ctx.showOnLotPage).toBe(false);
    expect(ctx.showOnSalePage).toBe(false);
  });
});
