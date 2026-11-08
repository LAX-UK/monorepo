// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MarketingFooterSocials } from "./marketing-footer-socials.js";

afterEach(cleanup);

describe("MarketingFooterSocials for lax.art", () => {
  it("links each London Art Exchange profile by name, in a new tab with noopener", () => {
    render(<MarketingFooterSocials product="art" />);
    const expected: [string, string][] = [
      ["London Art Exchange on YouTube", "https://www.youtube.com/@LondonArtExchange"],
      ["London Art Exchange on Instagram", "https://www.instagram.com/thelondonartexchange/"],
      ["London Art Exchange on X", "https://x.com/TheLAX_art"],
      ["London Art Exchange on TikTok", "https://www.tiktok.com/@thelax_art"],
    ];
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("aria-label"))).toEqual(
      expected.map(([name]) => name),
    );
    for (const [name, href] of expected) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
      expect(link.querySelector("svg")).not.toBeNull();
    }
  });
});
