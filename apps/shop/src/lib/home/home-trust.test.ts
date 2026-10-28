import { describe, expect, it } from "vitest";
import { buildHomeTrust } from "./home-trust";

describe("buildHomeTrust", () => {
  it("states delivery, collection, cancellation and a person to call", () => {
    const trust = buildHomeTrust({
      deliveryTimes: { ukDelivery: { min: 3, max: 5 }, collection: { min: 2, max: 2 } },
      linkablePolicies: ["delivery", "returns", "help"],
    });
    expect(trust.columns.map((column) => [column.title, column.line])).toEqual([
      ["Insured UK delivery, £15", "3 to 5 working days"],
      ["Free collection", "From 156 New Cavendish Street, ready in 2 working days"],
      ["14-day cancellation", "Change your mind after delivery"],
      ["Help from the gallery", "+44 800 208 4800"],
    ]);
    expect(trust.columns[3]?.href).toBe("tel:+448002084800");
    expect(trust.phone).toEqual({
      text: "£15 insured, or free collection",
      link: { label: "Delivery and returns", href: "/delivery" },
    });
  });

  it("makes no claim about signing or numbering", () => {
    const trust = buildHomeTrust({
      deliveryTimes: { ukDelivery: null, collection: null },
      linkablePolicies: [],
    });
    const words = JSON.stringify(trust).toLowerCase();
    expect(words).not.toMatch(/sign|number/);
  });

  it("leaves times out when none are configured and links help when no policy is live", () => {
    const trust = buildHomeTrust({
      deliveryTimes: { ukDelivery: null, collection: null },
      linkablePolicies: [],
    });
    expect(trust.columns[0]?.line).toBe("Tracked and insured to your door");
    expect(trust.columns[1]?.line).toBe("From 156 New Cavendish Street");
    expect(trust.phone.link.href).toBe("/help");
  });
});
