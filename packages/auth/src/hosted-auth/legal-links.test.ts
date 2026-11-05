import { describe, expect, it } from "vitest";
import type { HostedAuthProduct } from "./flow-context.js";
import { hostedAgreementLinks, hostedFooterLinks, hostedLegalProduct } from "./legal-links.js";
import { EMPTY_HOSTED_AUTH_CAPABILITIES } from "./view.js";

const capabilities = {
  ...EMPTY_HOSTED_AUTH_CAPABILITIES,
  bidOrigin: "https://lax.bid/",
  shopOrigin: "https://shop.example",
  artOrigin: "https://lax.art",
};

describe("hostedAgreementLinks", () => {
  it.each<[HostedAuthProduct, string, string]>([
    ["bid", "https://lax.bid/terms", "https://lax.bid/privacy"],
    ["account", "https://lax.bid/terms", "https://lax.bid/privacy"],
    ["unknown", "https://lax.bid/terms", "https://lax.bid/privacy"],
    ["shop", "https://shop.example/terms", "https://shop.example/privacy"],
    ["shop-admin", "https://shop.example/terms", "https://shop.example/privacy"],
    ["art", "https://lax.art/legal/terms", "https://lax.art/legal/privacy"],
  ])("links %s sign-up to its own company's documents", (product, terms, privacy) => {
    expect(hostedAgreementLinks(product, capabilities)).toEqual({ terms, privacy });
  });
});

describe("hostedFooterLinks", () => {
  it("links LAX Account's privacy notice and help, wherever the person came from", () => {
    expect(hostedFooterLinks(capabilities)).toEqual({
      privacy: "https://lax.bid/privacy",
      help: "https://lax.bid/faq",
    });
  });
});

describe("hostedLegalProduct", () => {
  it.each<[HostedAuthProduct, string]>([
    ["bid", "bid"],
    ["account", "account"],
    ["unknown", "account"],
    ["shop", "shop"],
    ["shop-admin", "shop"],
    ["art", "art"],
  ])("names %s sign-up as the %s documents", (product, legalProduct) => {
    expect(hostedLegalProduct(product)).toBe(legalProduct);
  });
});
