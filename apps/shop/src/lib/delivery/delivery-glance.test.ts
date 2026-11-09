import { workingDayWindowLine, workingDaysLabel } from "@/lib/checkout/checkout-delivery";
import { presentDeliveryEstimate } from "@/lib/presenters/delivery-estimate.presenter";
import { GALLERY_CONTACT } from "@auction/branding";
import { parseLegalPolicyText } from "@auction/marketing-ui";
import type { PublicDeliveryRegions } from "@auction/shop-contracts";
import {
  DEFAULT_DELIVERY_REGIONS,
  FULFILMENT_SURCHARGE_PENCE,
  formatLeadTime,
} from "@auction/shop-domain";
import { describe, expect, it } from "vitest";
import { type DeliveryGlanceInput, type GlanceBlock, buildDeliveryGlance } from "./delivery-glance";

const regions = (overrides: Partial<PublicDeliveryRegions> = {}): PublicDeliveryRegions => ({
  regions: DEFAULT_DELIVERY_REGIONS.map((region) => ({ ...region, countries: [] })),
  notDeliveredTo: [],
  ...overrides,
});

const glance = (overrides: Partial<DeliveryGlanceInput> = {}) =>
  buildDeliveryGlance({
    regions: regions(),
    ukDelivery: { min: 3, max: 5 },
    framingEnabled: true,
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
    const section = glance();
    expect(section).toMatchObject({ id: "delivery-at-a-glance", heading: "Delivery at a glance" });
    expect(section.blocks[0]).toEqual({
      type: "paragraph",
      text: "The full policy follows below.",
    });
  });

  it("covers the topics in order: UK, collection, outside the UK, framed prints, duties, release", () => {
    const headings = glance()
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

  describe("the UK", () => {
    it("charges what checkout charges, whatever the regions say", () => {
      const data = regions();
      const uk = data.regions[0];
      if (uk) uk.fixedPricePence = 9999;
      const section = glance({ regions: data });
      const expected = `£${FULFILMENT_SURCHARGE_PENCE.uk_insured_delivery / 100}`;
      expect(textOf(section.blocks)).toContain(`Insured delivery, ${expected}.`);
      expect(textOf(section.blocks)).not.toContain("99.99");
      const table = tableOf(section.blocks);
      expect(table.rows[0]?.[0]).toBe("United Kingdom");
    });

    it("shows the window checkout and the edition page show, not the regions' own", () => {
      const data = regions();
      const uk = data.regions[0];
      if (uk) uk.standard = { minDays: 30, maxDays: 40 };
      const section = glance({ regions: data, ukDelivery: { min: 2, max: 4 } });
      expect(textOf(section.blocks)).toContain("Usually 2 to 4 working days.");
      expect(tableOf(section.blocks).rows[0]?.[1]).toBe("2 to 4");
      expect(textOf(section.blocks)).not.toContain("30 to 40");
    });

    it("names the same window on the delivery page and the edition page", () => {
      const times = { ukDelivery: { min: 3, max: 5 }, collection: { min: 2, max: 2 } };
      const now = new Date("2026-11-09T10:00:00Z");
      const page = textOf(glance({ ukDelivery: times.ukDelivery }).blocks);
      const edition = presentDeliveryEstimate({ now, times });
      expect(page).toContain(workingDaysLabel(times.ukDelivery));
      // The edition page dates the very same window: its line starts with the dates for 3 to 5.
      expect(
        edition?.delivery.startsWith(workingDayWindowLine(now, times.ukDelivery, "Arrives")),
      ).toBe(true);
      expect(edition?.delivery).toMatch(/with insured UK delivery, £15$/);
    });

    it("says no time when none is configured, and 'Not stated' in the table", () => {
      const section = glance({ ukDelivery: null });
      expect(textOf(section.blocks)).toContain("Insured delivery, £15.");
      expect(textOf(section.blocks)).not.toMatch(/Usually/);
      expect(tableOf(section.blocks).rows[0]?.[1]).toBe("Not stated");
    });
  });

  describe("the other regions", () => {
    it("take their times from the regions they are given, not from a copy", () => {
      const data = regions();
      const eu = data.regions.find((region) => region.id === "eu");
      if (eu) eu.standard = { minDays: 7, maxDays: 9 };
      const table = tableOf(glance({ regions: data }).blocks);
      expect(table.rows.map((row) => row[0])).toEqual(data.regions.map((region) => region.name));
      const euRow = table.rows.find((row) => row[0] === "European Union");
      expect(euRow?.slice(1, 3)).toEqual([
        "7 to 9",
        formatLeadTime(eu?.specialist ?? { minDays: 0, maxDays: 0 }),
      ]);
      expect(table.columns).toEqual(["Region", "Standard", "Specialist handling"]);
    });

    it("add a price column only once a region outside the UK has a fixed price", () => {
      const data = regions();
      const eu = data.regions.find((region) => region.id === "eu");
      if (eu) eu.fixedPricePence = 4500;
      const table = tableOf(glance({ regions: data }).blocks);
      expect(table.columns).toEqual([
        "Region",
        "Standard",
        "Specialist handling",
        "Delivery price",
      ]);
      expect(table.rows.map((row) => row[3])).toEqual(["£15", "£45", "Quote", "Quote"]);
    });
  });

  it("reads collection, address, hours and contact from the gallery's one source", () => {
    const text = textOf(glance().blocks);
    expect(text).toContain(
      `Free, by appointment, at ${GALLERY_CONTACT.streetLine}, ${GALLERY_CONTACT.city} ${GALLERY_CONTACT.postcode}.`,
    );
    expect(text).toContain(GALLERY_CONTACT.openingHours);
    expect(text).toContain(GALLERY_CONTACT.phone);
    expect(text).toContain(GALLERY_CONTACT.email);
  });

  it("says duties are the buyer's and insurance is in the delivery price or quote", () => {
    const text = textOf(glance().blocks);
    expect(text).toContain("paid by you");
    expect(text).toContain(
      "insured for the price you paid, included in your delivery price or quote.",
    );
    expect(text).toContain("Priced by quote within one working day");
  });

  it("does not repeat a closing 'Questions about delivery?' line", () => {
    expect(textOf(glance().blocks)).not.toContain("Questions about delivery");
  });

  describe("framing", () => {
    it("is mentioned only when the Shop offers it, as UV-filtering acrylic", () => {
      const on = textOf(glance({ framingEnabled: true }).blocks);
      expect(on).toContain("Frames we make use UV-filtering acrylic.");
      expect(on).toContain("A framed print leaves us after framing.");
      const off = textOf(glance({ framingEnabled: false }).blocks);
      expect(off).not.toMatch(/fram/i);
    });
  });

  it("names the countries it does not deliver to, and offers collection", () => {
    const text = textOf(
      glance({
        regions: regions({
          notDeliveredTo: [
            { code: "BY", name: "Belarus" },
            { code: "IR", name: "Iran" },
            { code: "RU", name: "Russia" },
          ],
        }),
      }).blocks,
    );
    expect(text).toContain("We can't deliver to Belarus, Iran and Russia.");
    expect(text).toContain("collect from our London gallery");
  });

  it("says nothing about restricted countries when there are none", () => {
    expect(textOf(glance().blocks)).not.toContain("We can't deliver to");
  });

  describe("when the regions cannot be read", () => {
    const section = glance({ regions: null });
    const text = textOf(section.blocks);

    it("shows no table and says the other regions' times are unavailable, with a way to ask", () => {
      expect(section.blocks.some((block) => block.type === "table")).toBe(false);
      expect(text).toContain("We can't show delivery times for other regions just now.");
      expect(text).toContain(GALLERY_CONTACT.email);
    });

    it("keeps what does not depend on them: the UK, collection, duties, insurance, release", () => {
      expect(text).toContain("Insured delivery, £15. Usually 3 to 5 working days.");
      expect(text).toContain("Collection");
      expect(text).toContain("paid by you");
      expect(text).toContain("cleared payment");
    });
  });

  it("is written in the policy page's own text marks, with no placeholder left in it", () => {
    for (const section of [glance(), glance({ regions: null, framingEnabled: false })]) {
      const parts = parseLegalPolicyText(textOf(section.blocks));
      expect(parts.some((part) => part.kind === "placeholder")).toBe(false);
    }
  });
});
