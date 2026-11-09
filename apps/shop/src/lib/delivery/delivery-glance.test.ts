import { GALLERY_CONTACT } from "@auction/branding";
import { parseLegalPolicyText } from "@auction/marketing-ui";
import type { PublicDeliveryRegions } from "@auction/shop-contracts";
import { DEFAULT_DELIVERY_REGIONS, formatLeadTime } from "@auction/shop-domain";
import { describe, expect, it } from "vitest";
import { type GlanceBlock, buildDeliveryGlance } from "./delivery-glance";

const regions = (overrides: Partial<PublicDeliveryRegions> = {}): PublicDeliveryRegions => ({
  regions: DEFAULT_DELIVERY_REGIONS.map((region) => ({
    ...region,
    countries: [],
  })),
  notDeliveredTo: [],
  ...overrides,
});

const textOf = (blocks: readonly GlanceBlock[]): string =>
  blocks
    .map((block) => {
      switch (block.type) {
        case "paragraph":
        case "subheading":
          return block.text;
        case "list":
          return block.items.join("\n");
        case "table":
          return [...block.columns, ...block.rows.flat()].join(" | ");
        case "panel":
          return textOf(block.blocks);
      }
    })
    .join("\n");

const tableOf = (blocks: readonly GlanceBlock[]) => {
  const table = blocks.find((block) => block.type === "table");
  if (table?.type !== "table") throw new Error("no table");
  return table;
};

describe("Delivery at a glance", () => {
  it("opens the delivery page with a section the page can link to", () => {
    const section = buildDeliveryGlance(regions());
    expect(section).toMatchObject({ id: "delivery-at-a-glance", heading: "Delivery at a glance" });
    expect(section.blocks[0]).toEqual({
      type: "paragraph",
      text: "The full policy follows below.",
    });
  });

  it("covers the topics in order: UK, collection, outside the UK, framed prints, duties, release", () => {
    const headings = buildDeliveryGlance(regions())
      .blocks.filter((block) => block.type === "subheading")
      .map((block) => (block.type === "subheading" ? block.text : ""));
    expect(headings).toEqual([
      "In the UK",
      "Collection",
      "Outside the UK",
      "Framed prints",
      "Duties and insurance",
      "Before anything leaves us",
    ]);
  });

  it("takes every lead time and the UK price from the regions it is given, not from a copy", () => {
    const data = regions();
    const uk = data.regions[0];
    if (!uk) throw new Error("no UK");
    uk.fixedPricePence = 2250;
    uk.standard = { minDays: 2, maxDays: 4 };
    const text = textOf(buildDeliveryGlance(data).blocks);
    expect(text).toContain("Insured delivery, £22.50. Usually 2 to 4 working days after dispatch.");
    const table = tableOf(buildDeliveryGlance(data).blocks);
    expect(table.rows.map((row) => row.slice(0, 3))).toEqual(
      data.regions.map((region) => [
        region.name,
        formatLeadTime(region.standard),
        formatLeadTime(region.specialist),
      ]),
    );
    expect(table.columns).toEqual(["Region", "Standard", "Specialist handling"]);
  });

  it("says the UK is quoted when it has no fixed price", () => {
    const data = regions();
    const uk = data.regions[0];
    if (uk) uk.fixedPricePence = null;
    expect(textOf(buildDeliveryGlance(data).blocks)).toContain(
      "We quote delivery. Usually 5 to 10 working days after dispatch.",
    );
  });

  it("adds a price column only once a region outside the UK has a fixed price", () => {
    const data = regions();
    const eu = data.regions.find((region) => region.id === "eu");
    if (eu) eu.fixedPricePence = 4500;
    const table = tableOf(buildDeliveryGlance(data).blocks);
    expect(table.columns).toEqual(["Region", "Standard", "Specialist handling", "Delivery price"]);
    expect(table.rows.map((row) => row[3])).toEqual(["£15", "£45", "Quote", "Quote"]);
  });

  it("reads collection, address, hours and contact from the gallery's one source", () => {
    const text = textOf(buildDeliveryGlance(regions()).blocks);
    expect(text).toContain(
      `Free, by appointment, at ${GALLERY_CONTACT.streetLine}, ${GALLERY_CONTACT.city} ${GALLERY_CONTACT.postcode}.`,
    );
    expect(text).toContain(GALLERY_CONTACT.openingHours);
    expect(text).toContain(GALLERY_CONTACT.phone);
    expect(text).toContain(GALLERY_CONTACT.email);
  });

  it("says the buyer pays duties and that deliveries are insured", () => {
    const text = textOf(buildDeliveryGlance(regions()).blocks);
    expect(text).toContain("paid by you");
    expect(text).toContain("insured for the price you paid");
    expect(text).toContain("Priced by quote within one working day");
  });

  it("names the countries it does not deliver to, and offers collection", () => {
    const text = textOf(
      buildDeliveryGlance(
        regions({
          notDeliveredTo: [
            { code: "BY", name: "Belarus" },
            { code: "IR", name: "Iran" },
            { code: "RU", name: "Russia" },
          ],
        }),
      ).blocks,
    );
    expect(text).toContain("We can't deliver to Belarus, Iran and Russia.");
    expect(text).toContain("collect from our London gallery");
  });

  it("says nothing about restricted countries when there are none", () => {
    expect(textOf(buildDeliveryGlance(regions()).blocks)).not.toContain("We can't deliver to");
  });

  describe("when the regions cannot be read", () => {
    const text = textOf(buildDeliveryGlance(null).blocks);

    it("shows no times and no table, and says so with a way to ask", () => {
      expect(buildDeliveryGlance(null).blocks.some((block) => block.type === "table")).toBe(false);
      expect(text).toContain("We can't show delivery times just now.");
      expect(text).toContain(GALLERY_CONTACT.email);
      expect(text).not.toMatch(/working days after dispatch\./);
    });

    it("keeps what does not depend on them: collection, duties, insurance, release", () => {
      expect(text).toContain("Collection");
      expect(text).toContain("paid by you");
      expect(text).toContain("cleared payment");
    });
  });

  it("is written in the policy page's own text marks, with no placeholder left in it", () => {
    for (const section of [buildDeliveryGlance(regions()), buildDeliveryGlance(null)]) {
      const parts = parseLegalPolicyText(textOf(section.blocks));
      expect(parts.some((part) => part.kind === "placeholder")).toBe(false);
    }
  });
});
