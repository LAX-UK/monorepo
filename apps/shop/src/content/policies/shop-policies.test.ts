import { LAX_ART_POLICIES } from "@auction/marketing-ui";
import { QUOTE_HOLD_WORKING_DAYS, QUOTE_PAYMENT_WINDOW_MS } from "@auction/shop-domain";
import { describe, expect, it } from "vitest";
import { quotePaymentWindowWords } from "./help";
import {
  OUTSIDE_UK_HELP_HREF,
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
      "info(@)thelax.art",
      "Phone: +44 800 208 4800",
      "156 New Cavendish St, London W1W 6YW",
      "[Your orders](/account/orders)",
      "[LAX Account](https://account.example/account)",
      "[Shipping and delivery](/delivery)",
      "[Returns and cancellation](/returns)",
      "[Terms of sale](/terms)",
      "[Complaints and ADR](https://art.example/legal/complaints)",
    ]) {
      expect(text).toContain(detail);
    }
    expect(SHOP_POLICY_RELEASES.help.status).toBe("approved");
  });
});

describe("the help page's delivery outside the UK entry", () => {
  const build = (bidBaseUrl: URL | null) =>
    buildShopHelpDocument({
      ordersHref: "/account/orders",
      accountHref: "https://account.example/account",
      artBaseUrl: null,
      bidBaseUrl,
    });

  it("is a section the quote steps can link to, and says who quotes, when, and how it is paid", () => {
    const help = build(new URL("https://bid.example"));
    const section = help.sections.find((s) => s.id === "delivery-outside-uk");
    expect(section?.heading).toBe("Delivery outside the UK");
    expect(OUTSIDE_UK_HELP_HREF).toBe("/help#delivery-outside-uk");
    const text = shopPolicyTexts({ ...help, sections: section ? [section] : [] }).join("\n");
    expect(text).toContain("our gallery team quotes delivery outside the UK");
    expect(text).toContain("within one working day");
    expect(text).toContain("pay for your print and its delivery together");
  });

  const sectionText = () => {
    const help = build(null);
    const section = help.sections.find((s) => s.id === "delivery-outside-uk");
    return shopPolicyTexts({ ...help, sections: section ? [section] : [] }).join("\n");
  };

  it("has the buyer accept the quote, then pay within the payment window", () => {
    const text = sectionText();
    expect(text).toContain("Accept the quote from our email");
    expect(text).toContain(`you have ${quotePaymentWindowWords(QUOTE_PAYMENT_WINDOW_MS)} to pay`);
    expect(quotePaymentWindowWords(60 * 60 * 1000)).toBe("one hour");
    expect(quotePaymentWindowWords(90 * 60 * 1000)).toBe("90 minutes");
    expect(quotePaymentWindowWords(2 * 60 * 60 * 1000)).toBe("2 hours");
    expect(text).not.toContain("from the link in our email");
  });

  it("sends buyers to the dates in their confirmation and quote email, not one hold for all", () => {
    const text = sectionText();
    expect(text).toContain("confirmation at checkout and our quote email show the exact date");
    expect(text).toContain("shorter for guests");
    expect(text).toContain(`${QUOTE_HOLD_WORKING_DAYS} working days`);
    expect(text).not.toContain("up to three working days");
  });

  it("leads with the fixed-price case so it stays true when a region has a fixed price", () => {
    const text = sectionText();
    expect(text).toMatch(/(^|\n)Where we have not set a fixed price, our gallery team quotes/);
    expect(text).toContain("Where a fixed price is set, you pay it with your order");
  });

  it("claims the invoice for guests and signed-in buyers alike, only once paid", () => {
    expect(sectionText()).toContain(
      "Once you have paid, your invoice is on your order page, whether you are signed in or checked out as a guest",
    );
  });

  it("points the full terms at lax.bid/shipping as a plain link", () => {
    const text = shopPolicyTexts(build(new URL("https://bid.example"))).join("\n");
    expect(text).toContain("[shipping and logistics](https://bid.example/shipping)");
  });

  it("leaves the terms link out when lax.bid is not configured", () => {
    const text = shopPolicyTexts(build(null)).join("\n");
    expect(text).not.toContain("/shipping");
  });
});
