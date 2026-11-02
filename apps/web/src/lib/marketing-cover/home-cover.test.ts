import { resolveHomeState } from "@auction/domain";
import type { Lot, Sale } from "@auction/types";
import { describe, expect, it } from "vitest";
import { type HomeCoverSale, buildHomeCover, coverPlateLots, coverSaleIds } from "./home-cover";
import { HOME_COVER_LINKS } from "./home-cover-links";

const now = new Date("2026-11-01T15:25:00Z");
const hours = (n: number) => new Date(now.getTime() + n * 3_600_000);

const sale = (id: string, over: Partial<Sale> = {}): Sale =>
  ({
    id,
    title: `Sale ${id}`,
    status: "active",
    deliveryMode: "online",
    startTime: hours(-48),
    endTime: hours(50),
    heroPresentation: "cover",
    heroVideoUrl: null,
    coverImages: [],
    subtitle: null,
    featuredLotIds: [],
    homePinOrder: null,
    ...over,
  }) as unknown as Sale;

const lot = (id: string, over: Record<string, unknown> = {}): Lot =>
  ({
    id,
    saleId: "a",
    lotNumber: 1,
    title: `Lot ${id}`,
    images: [`https://cdn.test/${id}.jpg`],
    imageAssets: [{ src: `https://cdn.test/${id}.jpg`, width: 1600, height: 1200 }],
    status: "active",
    startingPrice: "1000",
    currentPrice: "2000",
    buyerPremiumRate: "0.25",
    startTime: hours(-48),
    endTime: hours(50),
    winnerId: null,
    ...over,
  }) as unknown as Lot;

const row = (s: Sale, lotCount = 8): HomeCoverSale => ({ sale: s, lotCount });

function build(sales: Sale[], lots: Record<string, Lot[]> = {}) {
  const state = resolveHomeState({
    sales: sales.map((s) => ({
      id: s.id,
      status: s.status,
      startTime: new Date(s.startTime as Date),
      endTime: new Date(s.endTime as Date),
    })),
    now,
    pinnedSaleIds: sales.filter((s) => s.homePinOrder != null).map((s) => s.id),
  });
  const input = {
    state,
    sales: sales.map((s) => row(s)),
    lotsBySale: new Map(Object.entries(lots)),
    now,
  };
  const cover = buildHomeCover({
    ...input,
    fieldFor: () => "#1a1f26",
    links: HOME_COVER_LINKS,
    notifyAction: "/api/newsletter/notify",
    betweenSeasons: { title: "Between", fact: "Join the list." },
  });
  return { state, cover, input };
}

describe("home cover by state", () => {
  it("live: leads with the live sale, plate of its top lot, credited", () => {
    const { cover } = build([sale("a")], { a: [lot("l1"), lot("l2", { currentPrice: "9000" })] });
    expect(cover.slides).toHaveLength(1);
    const [slide] = cover.slides;
    expect(slide?.badge).toBe("Live");
    expect(slide?.media.map((m) => m.kind)).toEqual(["plate"]);
    expect(slide?.credit?.text).toContain("Lot l2");
    expect(slide?.credit?.text).toContain("current bid");
    expect(cover.lots.map((l) => l.id)).toEqual(["l2"]);
    expect(cover.leadSale).toEqual({ id: "a", status: "active", href: expect.any(String) });
  });

  it("live: a featured lot leads over the top lot", () => {
    const { cover } = build([sale("a", { featuredLotIds: ["l1"] })], {
      a: [lot("l1"), lot("l2", { currentPrice: "9000" })],
    });
    expect(cover.lots.map((l) => l.id)).toEqual(["l1"]);
  });

  it("live: counts the final hour second by second", () => {
    const { cover } = build([sale("a", { endTime: hours(0.5) })], { a: [lot("l1")] });
    expect(cover.slides[0]?.timeTick?.template).toContain("{time}");
  });

  it("just ended: leads with the ended sale, results wording and a sell link", () => {
    const { state, cover } = build([sale("e", { status: "ended", endTime: hours(-5) })], {
      e: [lot("l1", { status: "ended", winnerId: "w" })],
    });
    expect(state.state).toBe("justEnded");
    expect(cover.slides[0]?.badge).toBe("Ended");
    expect(cover.slides[0]?.primary.label).toBe("See the results");
    expect(cover.slides[0]?.link?.label).toBe("Sell with LAX");
  });

  it("upcoming: opens wording and a preview action", () => {
    const { state, cover } = build(
      [sale("u", { status: "scheduled", startTime: hours(24 * 9), endTime: hours(24 * 12) })],
      { u: [lot("l1", { status: "scheduled" })] },
    );
    expect(state.state).toBe("upcoming");
    expect(cover.slides[0]?.badge).toBe("Upcoming");
    expect(cover.slides[0]?.primary.label).toBe("Preview the lots");
  });

  it("recent results: leads with the ended sale from the last three months", () => {
    const { state, cover } = build(
      [sale("e", { status: "ended", startTime: hours(-24 * 40), endTime: hours(-24 * 30) })],
      { e: [lot("l1", { status: "ended", winnerId: "w" })] },
    );
    expect(state.state).toBe("recentResults");
    expect(cover.slides[0]?.badge).toBe("Ended");
  });

  it("between seasons: one slide with the email field, a sold work and the season list", () => {
    const { state, cover } = build(
      [
        sale("old", { status: "ended", startTime: hours(-24 * 200), endTime: hours(-24 * 190) }),
        sale("next", {
          status: "scheduled",
          title: "Winter Sale",
          startTime: hours(24 * 100),
          endTime: hours(24 * 103),
          consignmentDeadline: hours(24 * 60),
        } as Partial<Sale>),
      ],
      {
        old: [
          lot("sold", { status: "ended", winnerId: "w" }),
          lot("unsold", { status: "ended", currentPrice: "99999" }),
        ],
      },
    );
    expect(state.state).toBe("betweenSeasons");
    expect(cover.slides).toHaveLength(1);
    const [slide] = cover.slides;
    expect(slide?.alert?.action).toBe("/api/newsletter/notify");
    expect(slide?.seasons?.map((r) => r.label)).toEqual(["Consign by", "February"]);
    expect(slide?.credit?.text).toContain("Recently sold");
    expect(cover.lots.map((l) => l.id)).toEqual(["sold"]);
    expect(cover.leadSale).toBeNull();
  });

  it("no usable picture: type only, no credit, and nothing reserved", () => {
    const { cover } = build([sale("a")], {
      a: [lot("l1", { images: [], imageAssets: [] })],
    });
    expect(cover.slides[0]?.media).toEqual([]);
    expect(cover.slides[0]?.credit).toBeUndefined();
    expect(cover.lots).toEqual([]);
  });

  it("a video sale carries its film, which only starts when pressed", () => {
    const { cover } = build(
      [
        sale("a", {
          heroPresentation: "video",
          heroVideoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        }),
      ],
      { a: [lot("l1")] },
    );
    expect(cover.slides[0]?.film?.src).toContain("mute=1");
  });
});

describe("pinned sales", () => {
  const live = sale("live", { homePinOrder: 3 });
  const pinnedA = sale("pa", {
    status: "scheduled",
    startTime: hours(24 * 5),
    endTime: hours(24 * 8),
    homePinOrder: 1,
  });
  const pinnedB = sale("pb", {
    status: "scheduled",
    startTime: hours(24 * 9),
    endTime: hours(24 * 12),
    homePinOrder: 2,
  });
  const pinnedC = sale("pc", {
    status: "scheduled",
    startTime: hours(24 * 13),
    endTime: hours(24 * 15),
    homePinOrder: 4,
  });

  it("puts the live sale first, then pins in staff order, three at most", () => {
    const { state } = build([pinnedA, pinnedB, live, pinnedC]);
    expect(coverSaleIds(state, [pinnedA, pinnedB, live, pinnedC])).toEqual(["live", "pa", "pb"]);
  });

  it("builds one slide per pinned sale and keeps the lead for the viewer swaps", () => {
    const all = [pinnedA, pinnedB, live];
    const { cover } = build(all, { live: [lot("l1")], pa: [lot("l2")], pb: [lot("l3")] });
    expect(cover.slides.map((s) => s.id)).toEqual(["live", "pa", "pb"]);
    expect(cover.leadSale?.id).toBe("live");
    expect(cover.lots.map((l) => l.id)).toEqual(["l1", "l2", "l3"]);
  });

  it("names the plate lots so their colours can be read first", () => {
    const { input } = build([live], { live: [lot("l1")] });
    expect(coverPlateLots(input.state, input.sales, input.lotsBySale).map((l) => l.id)).toEqual([
      "l1",
    ]);
  });
});
