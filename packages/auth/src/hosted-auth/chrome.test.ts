import { describe, expect, it } from "vitest";
import { selectHostedBrand } from "./brand.js";
import { leadWithDestination } from "./chrome.js";

const textOf = (html: string) => html.replace(/<[^>]+>/g, "");

describe("leadWithDestination", () => {
  it.each([
    ["signIn", null, "Sign in with your LAX Account."],
    ["signIn", "lax-bid-web", "Sign in with your LAX Account to continue to LAX Bid."],
    ["signIn", "lax-shop-web", "Sign in with your LAX Account to continue to LAX Shop."],
    ["signIn", "lax-art-web", "Sign in with your LAX Account to continue to lax.art."],
    ["signIn", "lax-account-web", "Sign in with your LAX Account."],
    ["signUp", null, "Create an account once and use it across LAX."],
    ["signUp", "lax-bid-web", "Create an account once to continue to LAX Bid."],
    ["signUp", "lax-art-web", "Create an account once to continue to lax.art."],
  ] as const)("%s from %s reads %s", (key, clientId, text) => {
    expect(textOf(leadWithDestination(key, selectHostedBrand(clientId).chip))).toBe(text);
  });

  it("sets the destination in its product's colour", () => {
    expect(leadWithDestination("signIn", selectHostedBrand("lax-bid-web").chip)).toContain(
      '<span class="product-name product-name--bid">LAX Bid</span>.',
    );
  });
});
