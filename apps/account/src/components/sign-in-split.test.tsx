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

  it("hangs the whole painting from lg only, as decoration a phone never downloads", () => {
    expect(html).not.toContain("<img");
    const column = html.match(
      /<div aria-hidden="true" class="([^"]*)"><div data-testid="sign-in-painting"/,
    )?.[1];
    expect(column?.split(" ")).toEqual(
      expect.arrayContaining([
        "hidden",
        "lg:flex",
        "sticky",
        "top-0",
        "self-start",
        "h-screen",
        "supports-[height:100dvh]:h-dvh",
        "bg-art-wall",
      ]),
    );
    const painting = html.match(
      /<div data-testid="sign-in-painting" style="([^"]*)" class="([^"]*)"/,
    );
    expect(painting?.[1]).toMatch(/--sign-in-gallery:url\(&quot;[^&]*signin-gallery[^&]*&quot;\)/);
    const classes = painting?.[2]?.split(" ") ?? [];
    expect(classes).toEqual(
      expect.arrayContaining([
        "bg-contain",
        "aspect-square",
        "w-[min(82%,82vh)]",
        "lg:bg-(image:--sign-in-gallery)",
        "[box-shadow:var(--art-shadow)]",
      ]),
    );
    expect(classes.some((c) => c.includes("cover"))).toBe(false);
    expect(classes).not.toContain("bg-(image:--sign-in-gallery)");
  });
});
