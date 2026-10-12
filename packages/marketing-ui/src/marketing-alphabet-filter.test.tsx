import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingAlphabetFilter, marketingAlphabetHref } from "./marketing-alphabet-filter.js";
import { MarketingVideoPoster } from "./marketing-video-poster.js";

describe("MarketingAlphabetFilter", () => {
  it("renders All plus A–Z links and marks the active letter", () => {
    render(<MarketingAlphabetFilter basePath="/artists" active="f" />);
    const nav = screen.getByRole("navigation", { name: "Filter by first letter" });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(27);
    expect(within(nav).getByRole("link", { name: "F" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "F" })).toHaveAttribute(
      "href",
      "/artists?letter=f",
    );
    expect(within(nav).getByRole("link", { name: "All" })).not.toHaveAttribute("aria-current");
  });

  it("marks All active when no letter is selected", () => {
    render(<MarketingAlphabetFilter basePath="/artists" active={null} />);
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "page");
    expect(marketingAlphabetHref("/artists", null)).toBe("/artists");
  });
});

describe("MarketingVideoPoster", () => {
  it("links out in a new tab with an accessible name", () => {
    render(<MarketingVideoPoster href="https://vimeo.com/1" title="Studio visit" />);
    const link = screen.getByRole("link", {
      name: "Watch film: Studio visit (opens in a new tab)",
    });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
