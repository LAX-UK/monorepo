import { describe, expect, it } from "vitest";
import {
  buildHostedErrorHtml,
  buildHostedLinkErrorHtml,
  isBrowserNavigation,
  knownLinkErrorCode,
} from "./error-page.js";
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

describe("buildHostedLinkErrorHtml", () => {
  const view = hostedAuthViewFromSearch("client_id=lax-shop-web");

  it.each([
    ["EXPIRED_TOKEN", "That link has expired"],
    ["payload_expired", "That link has expired"],
    ["account_already_linked_to_different_user", "That account is already in use"],
    ["user_cancelled_authorize", "Nothing was changed"],
    ["email_doesn't_match", "That account doesn&#39;t match"],
    ["new_user_signup_disabled", "We can&#39;t create an account that way"],
    ["unable_to_link_account", "We couldn&#39;t finish that"],
  ])("words %s for the person", (code, title) => {
    const html = buildHostedLinkErrorHtml(code, view);
    expect(html).toContain(title);
    expect(html).toContain(`href="${view.config.restartUrl}"`);
  });

  it.each([undefined, null, "", "nope", "constructor", "__proto__", "<img src=x onerror=1>"])(
    "falls back to the general message for %s, and echoes nothing",
    (code) => {
      const html = buildHostedLinkErrorHtml(code, view);
      expect(html).toContain("We couldn&#39;t complete that");
      expect(html).not.toContain("onerror");
    },
  );

  it("knows only the codes on its list", () => {
    expect(knownLinkErrorCode("INVALID_TOKEN")).toBe("INVALID_TOKEN");
    expect(knownLinkErrorCode("toString")).toBeNull();
    expect(knownLinkErrorCode(undefined)).toBeNull();
  });
});
