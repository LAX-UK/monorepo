import { describe, expect, it } from "vitest";
import { selectHostedBrand } from "./brand.js";
import { contextLine } from "./chrome.js";
import { HOSTED_COPY } from "./copy.js";
import { parseHostedAuthFlow } from "./flow-context.js";

const textOf = (html: string) => html.replace(/<[^>]+>/g, "");

describe("contextLine", () => {
  it.each([
    [null, null, ""],
    ["lax-bid-web", null, "to bid at LAX Bid"],
    ["lax-bid-web", "sell", "to send your work to LAX Bid specialists"],
    ["lax-shop-web", null, "to buy at LAX Shop"],
    ["lax-shop-web", "sell", "to buy at LAX Shop"],
    ["lax-art-web", null, "to enquire and follow artists on lax.art"],
    ["lax-account-web", null, ""],
    ["lax-shop-admin", null, ""],
  ] as const)("from %s with context %s reads %j", (clientId, context, text) => {
    expect(textOf(contextLine(selectHostedBrand(clientId).chip, context))).toBe(text);
  });

  it("sets the product in its own colour", () => {
    expect(contextLine(selectHostedBrand("lax-bid-web").chip, null)).toContain(
      '<span class="product-name product-name--bid">LAX Bid</span>',
    );
  });
});

describe("hosted titles", () => {
  it("name the account in words", () => {
    expect(HOSTED_COPY.titles).toEqual({
      signIn: "Sign in to LAX Account",
      signUp: "Create your LAX Account",
    });
  });
});

describe("hosted_context", () => {
  it("is read only when it says sell", () => {
    expect(
      parseHostedAuthFlow(new URLSearchParams("client_id=lax-bid-web&hosted_context=sell")).context,
    ).toBe("sell");
    expect(
      parseHostedAuthFlow(new URLSearchParams("client_id=lax-bid-web&hosted_context=x")).context,
    ).toBeNull();
  });
});
