import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingCardMedia } from "./marketing-card-media.js";
import { MarketingCardShell } from "./marketing-card-shell.js";
import { MarketingViewAllLink } from "./marketing-view-all-link.js";

describe("MarketingCardShell", () => {
  it("renders static article without lift classes when not interactive", () => {
    render(
      <MarketingCardShell interactive={false} data-testid="shell">
        Card
      </MarketingCardShell>,
    );
    const shell = screen.getByTestId("shell");
    expect(shell.tagName).toBe("ARTICLE");
    expect(shell.className).not.toContain("hover:-translate-y-px");
  });

  it("applies Bid card lift on interactive shells without an idle border", () => {
    render(<MarketingCardShell data-testid="interactive-shell">Card</MarketingCardShell>);
    const shell = screen.getByTestId("interactive-shell");
    expect(shell.className).toContain("hover:-translate-y-px");
    expect(shell.className).toContain("hover:ring-primary/20");
    expect(shell.className).not.toContain("border-border-hairline");
  });

  it("applies media zoom to images rather than the media frame", () => {
    render(
      <MarketingCardMedia>
        <img src="/art.webp" alt="Artwork" />
      </MarketingCardMedia>,
    );
    const frame = screen.getByRole("img").parentElement;
    expect(frame?.className).toContain("group-hover:[&_img]:scale-[1.02]");
    expect(frame?.className).not.toContain("group-hover:scale-[1.02]");
  });

  it("composes exactly one consumer-owned link through asChild", () => {
    render(
      <MarketingViewAllLink asChild>
        <a href="/artworks">View all artworks</a>
      </MarketingViewAllLink>,
    );
    expect(screen.getByRole("link", { name: "View all artworks" }).getAttribute("href")).toBe(
      "/artworks",
    );
  });
});
