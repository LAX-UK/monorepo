/** @vitest-environment jsdom */
import { LAX_SOCIAL_LINKS } from "@auction/branding";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingFooterSocials } from "./marketing-footer-socials.js";

describe("MarketingFooterSocials", () => {
  it("renders Lucide social links from LAX SSOT", () => {
    const { container } = render(<MarketingFooterSocials />);
    expect(screen.getByRole("link", { name: /YouTube/i }).getAttribute("href")).toBe(
      LAX_SOCIAL_LINKS.youtube,
    );
    expect(container.querySelectorAll("svg")).toHaveLength(3);
  });
});
