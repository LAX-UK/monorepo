import { describe, expect, it } from "vitest";
import {
  isHomeHeroEligibleStatus,
  resolveHomeHeroLiveFromSale,
  resolveHomeHeroRotatorFromSales,
  resolveHomeHeroState,
} from "./home-hero-policy";

const YOUTUBE = "https://www.youtube.com/watch?v=jNQXAC9IVRw";

function baseSale(overrides: Partial<Parameters<typeof resolveHomeHeroLiveFromSale>[0]> = {}) {
  return {
    id: "sale-1",
    title: "Evening Sale",
    status: "active" as const,
    deliveryMode: "online" as const,
    heroPresentation: "cover" as const,
    heroVideoUrl: null,
    coverImages: ["cover-a.jpg", "cover-b.jpg"],
    startTime: new Date("2030-01-01T10:00:00.000Z"),
    endTime: new Date("2030-01-02T10:00:00.000Z"),
    ...overrides,
  };
}

describe("isHomeHeroEligibleStatus", () => {
  it.each(["scheduled", "active"] as const)("includes %s", (status) => {
    expect(isHomeHeroEligibleStatus(status)).toBe(true);
  });

  it.each(["draft", "ended", "cancelled"] as const)("excludes %s", (status) => {
    expect(isHomeHeroEligibleStatus(status)).toBe(false);
  });
});

describe("resolveHomeHeroLiveFromSale", () => {
  it.each(["online", "onsite", "hybrid"] as const)(
    "returns a video hero for %s delivery mode",
    (deliveryMode) => {
      const hero = resolveHomeHeroLiveFromSale(
        baseSale({
          deliveryMode,
          heroPresentation: "video",
          heroVideoUrl: YOUTUBE,
        }),
      );
      expect(hero?.kind).toBe("live");
      expect(hero?.saleId).toBe("sale-1");
      expect(hero?.provider).toBe("youtube");
      expect(hero?.posterImageUrl).toBe("cover-a.jpg");
    },
  );

  it("returns a video hero for a scheduled sale", () => {
    const hero = resolveHomeHeroLiveFromSale(
      baseSale({
        status: "scheduled",
        heroPresentation: "video",
        heroVideoUrl: YOUTUBE,
      }),
    );

    expect(hero?.kind).toBe("live");
  });

  it("ignores live streamUrl and requires heroPresentation video", () => {
    expect(
      resolveHomeHeroLiveFromSale(
        baseSale({
          deliveryMode: "onsite",
          heroPresentation: "cover",
          heroVideoUrl: null,
          streamUrl: YOUTUBE,
        } as Parameters<typeof resolveHomeHeroLiveFromSale>[0] & { streamUrl: string }),
      ),
    ).toBeNull();
  });

  it("returns null for invalid hero video URL", () => {
    expect(
      resolveHomeHeroLiveFromSale(
        baseSale({
          heroPresentation: "video",
          heroVideoUrl: "https://example.com/not-embeddable",
        }),
      ),
    ).toBeNull();
  });

  it("returns null for ineligible status", () => {
    expect(
      resolveHomeHeroLiveFromSale(
        baseSale({ status: "ended", heroPresentation: "video", heroVideoUrl: YOUTUBE }),
      ),
    ).toBeNull();
  });
});

describe("resolveHomeHeroRotatorFromSales", () => {
  it("builds rotator slides from scheduled and active sales", () => {
    const rotator = resolveHomeHeroRotatorFromSales([
      baseSale({ status: "scheduled", id: "s1" }),
      baseSale({ status: "active", id: "s2" }),
      baseSale({ status: "ended", id: "s3" }),
    ]);
    expect(rotator?.kind).toBe("rotator");
    expect(rotator?.slides).toHaveLength(2);
  });
});

describe("resolveHomeHeroState", () => {
  it("leads with the running sale", () => {
    const state = resolveHomeHeroState([
      baseSale({ status: "scheduled", id: "later" }),
      baseSale({ status: "active", id: "now" }),
    ]);
    expect(state.kind).toBe("rotator");
    if (state.kind === "rotator") expect(state.slides[0]?.id).toBe("now");
  });

  it("prefers a running sale's hero video", () => {
    const state = resolveHomeHeroState([
      baseSale({
        status: "scheduled",
        id: "later",
        heroPresentation: "video",
        heroVideoUrl: YOUTUBE,
      }),
      baseSale({ status: "active", id: "now", heroPresentation: "video", heroVideoUrl: YOUTUBE }),
    ]);
    expect(state.kind).toBe("live");
    if (state.kind === "live") expect(state.saleId).toBe("now");
  });

  it("shows the upcoming sale when only scheduled sales exist", () => {
    const state = resolveHomeHeroState([baseSale({ status: "scheduled", id: "next" })]);
    expect(state.kind).toBe("rotator");
    if (state.kind === "rotator") expect(state.slides.map((s) => s.status)).toEqual(["scheduled"]);
  });

  it("falls back to between seasons when nothing is live or scheduled", () => {
    expect(resolveHomeHeroState([])).toEqual({ kind: "betweenSeasons" });
    expect(
      resolveHomeHeroState([baseSale({ status: "ended" }), baseSale({ status: "draft" })]),
    ).toEqual({ kind: "betweenSeasons" });
  });
});
