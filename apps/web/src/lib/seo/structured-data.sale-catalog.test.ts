import { describe, expect, it } from "vitest";
import { itemListJsonLd } from "./structured-data";
import { lotPath } from "./url";

const siteBase = "https://www.example.test";

/** Mirrors sale detail page mapping: current page lots only, absolute canonical URLs. */
function salePageItemList(lots: Array<{ id: string; title: string }>, base = siteBase) {
  return itemListJsonLd(
    lots.map((lot) => ({
      name: lot.title,
      url: `${base}${lotPath(lot)}`,
    })),
  );
}

describe("sale catalog itemListJsonLd", () => {
  it("uses canonical lotPath URLs with site origin", () => {
    const ld = salePageItemList([{ id: "abc-123", title: "Blue Period Study" }]);

    const elements = ld.itemListElement as Array<{ url: string; name: string; position: number }>;
    expect(elements).toHaveLength(1);
    expect(elements[0]?.url).toBe(`${siteBase}/lot/blue-period-study/abc-123`);
    expect(elements[0]?.name).toBe("Blue Period Study");
    expect(elements[0]?.position).toBe(1);
  });

  it("reflects only the lots passed in (current pagination page)", () => {
    const pageOne = [
      { id: "1", title: "Lot A" },
      { id: "2", title: "Lot B" },
    ];
    const pageTwo = [{ id: "3", title: "Lot C" }];

    const ldPageOne = salePageItemList(pageOne);
    const ldPageTwo = salePageItemList(pageTwo);

    const elementsOne = ldPageOne.itemListElement as Array<{ position: number; url: string }>;
    const elementsTwo = ldPageTwo.itemListElement as Array<{ position: number; url: string }>;

    expect(elementsOne).toHaveLength(2);
    expect(elementsTwo).toHaveLength(1);
    expect(elementsOne.map((e) => e.position)).toEqual([1, 2]);
    expect(elementsTwo[0]?.position).toBe(1);
    expect(elementsTwo[0]?.url).toContain("/lot/lot-c/3");
    expect(elementsOne.some((e) => e.url.includes("/3"))).toBe(false);
  });

  it("emits schema.org ItemList with sequential ListItem entries", () => {
    const ld = salePageItemList([
      { id: "x", title: "First" },
      { id: "y", title: "Second" },
    ]);

    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("ItemList");

    const elements = ld.itemListElement as Array<{
      "@type": string;
      position: number;
      name: string;
      url: string;
    }>;
    expect(elements[0]?.["@type"]).toBe("ListItem");
    expect(elements[1]?.["@type"]).toBe("ListItem");
    expect(elements[0]?.name).toBe("First");
    expect(elements[1]?.name).toBe("Second");
  });
});
