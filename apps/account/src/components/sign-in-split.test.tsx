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

  it("fills the right-hand column with the painting from lg only, as decoration", () => {
    expect(html).not.toContain("<img");
    const classes = html.match(
      /<div aria-hidden="true" data-testid="sign-in-painting" style="([^"]*)" class="([^"]*)"/,
    );
    expect(classes?.[1]).toMatch(/--sign-in-gallery:url\(&quot;[^&]*signin-gallery[^&]*&quot;\)/);
    const list = classes?.[2]?.split(" ") ?? [];
    expect(list).toEqual(
      expect.arrayContaining([
        "hidden",
        "lg:block",
        "sticky",
        "top-0",
        "self-start",
        "h-screen",
        "supports-[height:100dvh]:h-dvh",
        "bg-cover",
        "[background-position:58%_40%]",
        "lg:bg-(image:--sign-in-gallery)",
      ]),
    );
    expect(list.some((c) => c.includes("min-h"))).toBe(false);
    expect(list).not.toContain("bg-(image:--sign-in-gallery)");
  });
});
