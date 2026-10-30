import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingOverlayCard } from "./marketing-overlay-card.js";

describe("MarketingOverlayCard", () => {
  it("links the title over the whole card and reads kicker, title and details in order", () => {
    render(
      <MarketingOverlayCard
        media={<img alt="" src="/x.webp" />}
        kicker={["Exhibition", "London"]}
        title="New originals"
        details={["16 Oct – 29 Dec 2026"]}
        href="/exhibitions/new-originals"
        headingLevel="h2"
      />,
    );
    const link = screen.getByRole("link", { name: "New originals" });
    expect(link).toHaveAttribute("href", "/exhibitions/new-originals");
    expect(link).toHaveClass("after:inset-0");
    expect(screen.getByRole("heading", { level: 2, name: "New originals" })).toBeInTheDocument();
    expect(screen.getByText("Exhibition")).toBeInTheDocument();
    expect(screen.getByText("16 Oct – 29 Dec 2026")).toBeInTheDocument();
  });

  it("renders the title as text without a link", () => {
    render(<MarketingOverlayCard media={null} title="Private view" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Private view" })).toBeInTheDocument();
  });
});
