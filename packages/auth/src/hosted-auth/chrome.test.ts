import { describe, expect, it } from "vitest";
import { selectHostedBrand } from "./brand.js";
import { contextLine } from "./chrome.js";
import { HOSTED_COPY } from "./copy.js";
import { appendOidcAuthorizeParams, parseHostedAuthFlow } from "./flow-context.js";

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
  const bid =
    "response_type=code&client_id=lax-bid-web&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fcallback%2Flax-bid-web&state=s&code_challenge=c&code_challenge_method=S256";
  const read = (query: string) => parseHostedAuthFlow(new URLSearchParams(query)).context;

  it("is read only when it says sell, for Bid's own authorize request", () => {
    expect(read(`${bid}&hosted_context=sell`)).toBe("sell");
    expect(read(`${bid}&hosted_context=x`)).toBeNull();
  });

  it("is ignored without a registered return address or for another client", () => {
    const evil = bid.replace(/redirect_uri=[^&]*/, "redirect_uri=https%3A%2F%2Fevil.test%2Fcb");
    expect(read("client_id=lax-bid-web&hosted_context=sell")).toBeNull();
    expect(read(`${evil}&hosted_context=sell`)).toBeNull();
    expect(read("client_id=lax-shop-web&hosted_context=sell")).toBeNull();
  });
});

describe("reauth_reason", () => {
  it("rides along with the authorize parameters, so the sign-in page can say why", () => {
    const target = new URL("https://auth.test/login");
    appendOidcAuthorizeParams(
      target,
      new URLSearchParams("client_id=lax-account-web&reauth_reason=add_sign_in_method&junk=1"),
    );
    expect(target.searchParams.get("reauth_reason")).toBe("add_sign_in_method");
    expect(target.searchParams.has("junk")).toBe(false);
  });
});
