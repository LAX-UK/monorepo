import { describe, expect, it } from "vitest";
import { EMPTY_HOSTED_AUTH_CAPABILITIES, hostedAuthViewFromSearch } from "../view.js";
import { buildHostedLoginHtml } from "./login.js";
import { buildHostedSignUpHtml } from "./sign-up.js";

const capabilities = {
  ...EMPTY_HOSTED_AUTH_CAPABILITIES,
  googleEnabled: true,
  appleEnabled: true,
  shopOrigin: "https://shop.example",
  artOrigin: "https://lax.art",
  bidOrigin: "https://lax.bid",
};

const LINE = /<p class="auth-fineprint">By continuing, you agree to the .*<\/p>/;

function loginFor(clientId: string, emailFirst = true): string {
  return buildHostedLoginHtml(
    hostedAuthViewFromSearch(`client_id=${clientId}`, { ...capabilities, emailFirst }),
  );
}

describe("sign-in Terms statement under Google and Apple", () => {
  it.each([
    ["lax-shop-web", "shop", "https://shop.example/terms", "https://shop.example/privacy"],
    ["lax-art-web", "art", "https://lax.art/legal/terms", "https://lax.art/legal/privacy"],
    ["lax-bid-web", "bid", "https://lax.bid/terms", "https://lax.bid/privacy"],
  ])("%s links its own company's documents", (clientId, product, terms, privacy) => {
    for (const emailFirst of [true, false]) {
      const html = loginFor(clientId, emailFirst);
      expect(html).toContain(`data-legal-product="${product}"`);
      const line = html.match(LINE)?.[0] ?? "";
      expect(line).toContain(`href="${terms}"`);
      expect(line).toContain(`href="${privacy}"`);
    }
  });

  it("sits between the provider buttons and the divider, in the sign-up statement's style", () => {
    const html = loginFor("lax-shop-web");
    const apple = html.indexOf('data-social-provider="apple"');
    const line = html.search(LINE);
    expect(apple).toBeGreaterThan(-1);
    expect(line).toBeGreaterThan(apple);
    expect(line).toBeLessThan(html.indexOf('class="auth-divider"'));
    const signUp = buildHostedSignUpHtml(
      hostedAuthViewFromSearch("client_id=lax-shop-web", capabilities),
    );
    expect(signUp).toContain('<p class="auth-fineprint">By creating an account');
  });

  it("is not shown when there are no Google or Apple buttons", () => {
    const html = buildHostedLoginHtml(hostedAuthViewFromSearch("client_id=lax-shop-web"));
    expect(html).not.toContain("By continuing, you agree");
  });
});
