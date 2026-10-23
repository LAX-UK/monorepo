import { describe, expect, it } from "vitest";
import { buildHostedErrorHtml, isBrowserNavigation } from "./error-page.js";
import { hostedAuthViewFromSearch } from "./view.js";

describe("isBrowserNavigation", () => {
  it("is true for a document navigation", () => {
    const headers = new Headers({
      accept: "text/html,application/xhtml+xml",
      "sec-fetch-mode": "navigate",
    });
    expect(isBrowserNavigation(headers)).toBe(true);
  });

  it("is false for fetch/XHR, even when it accepts HTML", () => {
    expect(
      isBrowserNavigation(new Headers({ accept: "text/html", "sec-fetch-mode": "cors" })),
    ).toBe(false);
    expect(
      isBrowserNavigation(
        new Headers({ accept: "application/json", "sec-fetch-mode": "navigate" }),
      ),
    ).toBe(false);
  });

  it("is false for API clients that send neither header", () => {
    expect(isBrowserNavigation(new Headers())).toBe(false);
    expect(isBrowserNavigation(new Headers({ accept: "text/html" }))).toBe(false);
  });
});

describe("buildHostedErrorHtml", () => {
  const view = hostedAuthViewFromSearch("client_id=lax-shop-web");

  it("offers Start again at the product's sign-in", () => {
    const html = buildHostedErrorHtml(400, view);
    expect(html).toContain("Start again");
    expect(html).toContain(`href="${view.config.restartUrl}"`);
    expect(html).toContain("/hosted-auth/lockups/lax-account.svg");
  });

  it.each([
    [429, "Too many attempts"],
    [403, "We couldn&#39;t verify that request"],
    [404, "We can&#39;t find that page"],
    [500, "Something went wrong on our side"],
    [400, "We couldn&#39;t complete that"],
  ])("explains a %i in plain words", (status, title) => {
    expect(buildHostedErrorHtml(status, view)).toContain(title);
  });
});
