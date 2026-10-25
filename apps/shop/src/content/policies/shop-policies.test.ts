import { LAX_ART_POLICIES } from "@auction/marketing-ui";
import { describe, expect, it } from "vitest";
import {
  SHOP_POLICY_DOCUMENTS,
  SHOP_POLICY_RELEASES,
  SHOP_POLICY_SOURCES,
  type ShopSourcedPolicySlug,
  buildShopHelpDocument,
} from "./index";
import { shopPolicyPlaceholders, shopPolicyTexts } from "./shop-policy-text";

const slugs = Object.keys(SHOP_POLICY_DOCUMENTS) as ShopSourcedPolicySlug[];

function pageText(slug: ShopSourcedPolicySlug): string {
  return shopPolicyTexts(SHOP_POLICY_DOCUMENTS[slug]).join("\n");
}

describe("Shop policy pages", () => {
  it("publish London Art Exchange Ltd's policies from the source lax.art shares", () => {
    for (const slug of slugs) {
      const source = LAX_ART_POLICIES[SHOP_POLICY_SOURCES[slug]];
      expect(SHOP_POLICY_DOCUMENTS[slug], slug).toBe(source.document);
      expect(SHOP_POLICY_RELEASES[slug], slug).toBe(source.release);
    }
  });

  it("are published, with no placeholder left", () => {
    for (const slug of slugs) {
      expect(SHOP_POLICY_RELEASES[slug].status, slug).toBe("approved");
      expect(shopPolicyPlaceholders(SHOP_POLICY_DOCUMENTS[slug]), slug).toEqual([]);
    }
  });

  it("use unique, url-safe section anchors", () => {
    for (const slug of slugs) {
      const ids = SHOP_POLICY_DOCUMENTS[slug].sections.map((section) => section.id);
      expect(new Set(ids).size, slug).toBe(ids.length);
      for (const id of ids) expect(id, slug).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
    }
  });

  it("name the company that runs LAX Shop", () => {
    const terms = pageText("terms");
    expect(terms).toContain("London Art Exchange Ltd");
    expect(terms).toContain("company number 12874213");
    for (const slug of slugs) expect(pageText(slug), slug).not.toContain("London Auction Xchange");
  });

  it("make help a contact page with the live details and plain links", () => {
    const help = buildShopHelpDocument({
      ordersHref: "/account/orders",
      accountHref: "https://account.example/account",
      artBaseUrl: new URL("https://art.example"),
    });
    const text = shopPolicyTexts(help).join("\n");
    for (const detail of [
      "info(@)lax.art",
      "Sales Office: +44 0800 208 4800",
      "General Enquiries: +44 020 804 41334",
      "156 New Cavendish St, London W1W 6YW",
      "[Your orders](/account/orders)",
      "[LAX Account](https://account.example/account)",
      "[Shipping & Delivery](/delivery)",
      "[Returns & Cancellation](/returns)",
      "[Terms of Sale](/terms)",
      "[Complaints & ADR](https://art.example/legal/complaints)",
    ]) {
      expect(text).toContain(detail);
    }
    expect(SHOP_POLICY_RELEASES.help.status).toBe("approved");
  });
});
