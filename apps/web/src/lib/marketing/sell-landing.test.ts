import { faqGroups } from "@/components/marketing/faq/faq-data";
import { allSellDepartments } from "@/lib/marketing/sell-departments";
import { SPECIALIST_RESPONSE_PROMISE } from "@/lib/marketing/sell-flow-copy";
import { SELL_HOW_IT_WORKS_STEPS } from "@/lib/marketing/sell-how-it-works";
import {
  RECENTLY_SOLD_LIMIT,
  SELL_FAQ_IDS,
  SELL_FEES_POINTS,
  recentlySoldWorks,
  sellDepartmentCards,
  sellTrustLine,
} from "@/lib/marketing/sell-landing";
import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";

function lot(id: string, over: Partial<Lot> = {}): Lot {
  return {
    id,
    title: `Lot ${id}`,
    status: "ended",
    currentPrice: "1000.00",
    hasWinner: true,
    images: ["https://example.test/a.jpg"],
    ...over,
  } as Lot;
}

describe("recentlySoldWorks", () => {
  it("keeps sold works only", () => {
    const result = recentlySoldWorks([
      lot("sold"),
      lot("unsold", { hasWinner: false }),
      lot("live", { status: "active" }),
    ]);
    expect(result.map((work) => work.id)).toEqual(["sold"]);
  });

  it("puts works with a picture first and keeps their order", () => {
    const result = recentlySoldWorks([lot("bare", { images: [] }), lot("a"), lot("b")]);
    expect(result.map((work) => work.id)).toEqual(["a", "b", "bare"]);
  });

  it("stops at the row limit", () => {
    const lots = Array.from({ length: RECENTLY_SOLD_LIMIT + 5 }, (_, i) => lot(`l${i}`));
    expect(recentlySoldWorks(lots)).toHaveLength(RECENTLY_SOLD_LIMIT);
  });

  it("returns nothing when nothing sold", () => {
    expect(recentlySoldWorks([])).toEqual([]);
  });
});

describe("sellDepartmentCards", () => {
  const cards = sellDepartmentCards();

  it("leaves out the hidden departments", () => {
    const ids = cards.map((card) => card.id);
    expect(ids).not.toContain("jewellery");
    expect(ids).not.toContain("handbags-accessories");
    const hidden = allSellDepartments().filter((department) => department.hidden);
    expect(hidden.length).toBeGreaterThan(0);
  });

  it("opens a department page where there is one and the form with the category otherwise", () => {
    const watches = cards.find((card) => card.id === "watches-clocks");
    expect(watches).toMatchObject({ href: "/sell/watches", opensDepartmentPage: true });
    const paintings = cards.find((card) => card.id === "paintings");
    expect(paintings).toMatchObject({
      href: "/selling/new?categorySlug=paintings",
      opensDepartmentPage: false,
    });
  });

  it("does not offer an NFT example", () => {
    const digital = cards.find((card) => card.id === "digital-art");
    expect(digital?.examples ?? "").not.toMatch(/nft/i);
  });
});

describe("fees copy", () => {
  it("states no rate", () => {
    for (const point of SELL_FEES_POINTS) {
      expect(point).not.toMatch(/%|percent|\d/);
    }
  });

  it("says the commission is agreed in writing before the sale", () => {
    expect(SELL_FEES_POINTS.join(" ")).toMatch(/in writing before the sale/);
  });
});

describe("how it works", () => {
  it("has three steps and makes the one reply promise", () => {
    expect(SELL_HOW_IT_WORKS_STEPS).toHaveLength(3);
    expect(SELL_HOW_IT_WORKS_STEPS[1]?.body).toBe(SPECIALIST_RESPONSE_PROMISE);
  });
});

describe("sellTrustLine", () => {
  it("names the Bid operator and the identity checks", () => {
    const line = sellTrustLine();
    expect(line).toContain("London Auction Xchange LTD");
    expect(line).toContain("156 New Cavendish Street");
    expect(line).toMatch(/identity of every buyer/);
  });
});

describe("selling questions", () => {
  it("are all present in the FAQ's selling group", () => {
    const selling = faqGroups.find((group) => group.id === "selling");
    const ids = new Set(selling?.items.map((item) => item.id));
    for (const id of SELL_FAQ_IDS) expect(ids.has(id)).toBe(true);
  });
});
