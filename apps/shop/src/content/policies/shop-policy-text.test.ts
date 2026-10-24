import { describe, expect, it } from "vitest";
import { parseShopPolicyText, shopPolicyPlaceholders } from "./shop-policy-text";

describe("parseShopPolicyText", () => {
  it("splits links, strong text and placeholders out of plain text", () => {
    expect(
      parseShopPolicyText(
        "See [Delivery](/delivery) within **14 days** at [TO CONFIRM: returns address].",
      ),
    ).toEqual([
      { kind: "text", value: "See " },
      { kind: "link", label: "Delivery", href: "/delivery" },
      { kind: "text", value: " within " },
      { kind: "strong", value: "14 days" },
      { kind: "text", value: " at " },
      { kind: "placeholder", value: "returns address" },
      { kind: "text", value: "." },
    ]);
  });

  it("leaves text without marks whole", () => {
    expect(parseShopPolicyText("Prices include VAT.")).toEqual([
      { kind: "text", value: "Prices include VAT." },
    ]);
  });
});

describe("shopPolicyPlaceholders", () => {
  it("lists placeholders from every block type in reading order", () => {
    expect(
      shopPolicyPlaceholders({
        slug: "help",
        title: "Help",
        summary: "Lead [TO CONFIRM: a]",
        sections: [
          {
            id: "one",
            heading: "One",
            blocks: [
              { type: "list", items: ["[TO CONFIRM: b]"] },
              {
                type: "table",
                caption: "Options",
                columns: ["Option", "When"],
                rows: [["Collect", "[TO CONFIRM: c]"]],
              },
              {
                type: "panel",
                title: "Form",
                blocks: [{ type: "paragraph", text: "To [TO CONFIRM: d]" }],
              },
            ],
          },
        ],
      }),
    ).toEqual(["a", "b", "c", "d"]);
  });
});
