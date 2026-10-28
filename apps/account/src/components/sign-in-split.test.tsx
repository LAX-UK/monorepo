import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SignInSplit } from "./sign-in-split";

const support = {
  helpCentre: "https://lax.bid/faq",
  contact: "https://lax.bid/contact",
  terms: "https://lax.bid/terms",
  privacyPolicy: "https://lax.bid/privacy",
};

describe("SignInSplit", () => {
  const html = renderToStaticMarkup(
    <SignInSplit support={support}>
      <h1>We couldn't sign you in</h1>
    </SignInSplit>,
  );

  it("frames the content with the lockup, theme toggle and who provides the account", () => {
    expect(html).toContain("<h1>We couldn&#x27;t sign you in</h1>");
    expect(html).toContain('aria-label="Switch to dark theme"');
    expect(html).toContain(
      "LAX Account is provided by London Auction Xchange LTD and London Art Exchange Ltd.",
    );
    expect(html).toContain('href="https://lax.bid/privacy"');
    expect(html).toContain('href="https://lax.bid/faq"');
  });

  it("shows the painting from lg only, as decoration", () => {
    expect(html).toMatch(
      /<div class="[^"]*hidden[^"]*lg:block[^"]*"><img src="[^"]*signin-gallery[^"]*" alt=""/,
    );
  });
});
