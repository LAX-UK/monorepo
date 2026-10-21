import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { MarketingEditorialCard } from "./marketing-editorial-card.js";

describe("MarketingEditorialCard", () => {
  it("renders kicker parts, a stretched title link and detail lines", () => {
    render(
      <MarketingEditorialCard
        media={<span data-testid="media" />}
        kicker={["Exhibition", "London"]}
        title="Forms in Suspension"
        details={["16 Apr – 20 Apr 2026", "1:00 PM | London"]}
        href="/exhibitions/forms"
        data-testid="card"
      />,
    );
    const card = screen.getByTestId("card");
    expect(card.tagName).toBe("ARTICLE");
    expect(screen.getByText("Exhibition")).toHaveClass("border-r");
    expect(screen.getByText("London", { selector: "span" })).not.toHaveClass("border-r");
    const link = screen.getByRole("link", { name: "Forms in Suspension" });
    expect(link).toHaveAttribute("href", "/exhibitions/forms");
    expect(link.className).toContain("after:inset-0");
    expect(screen.getByRole("heading", { level: 3 })).toContainElement(link);
    expect(screen.getByText("1:00 PM | London")).toBeInTheDocument();
    expect(screen.getByTestId("media").parentElement?.className).toContain("aspect-[4/3]");
    expect(card.className).not.toContain("rounded");
  });

  it("supports portrait media, a custom link component and a trailing control", () => {
    function SafeLink({
      href,
      className,
      children,
    }: { href: string; className?: string; children: ReactNode }) {
      return (
        <a href={href} className={className} data-safe>
          {children}
        </a>
      );
    }
    render(
      <MarketingEditorialCard
        media={<span data-testid="media" />}
        aspect="portrait"
        title="Why Matisse Lithographs Matter"
        href="/stories/matisse"
        linkAs={SafeLink}
        trailing={<button type="button">Save</button>}
      />,
    );
    const link = screen.getByRole("link", { name: "Why Matisse Lithographs Matter" });
    expect(link).toHaveAttribute("data-safe");
    expect(link).not.toContainElement(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByTestId("media").parentElement?.className).toContain("aspect-[8/11]");
  });

  it("supports wide media for a full-width lead", () => {
    render(
      <MarketingEditorialCard media={<span data-testid="media" />} aspect="wide" title="Lead" />,
    );
    expect(screen.getByTestId("media").parentElement?.className).toContain("aspect-[21/10]");
  });

  it("renders a plain title without an href", () => {
    render(<MarketingEditorialCard media={null} title="Untitled" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("heading", { name: "Untitled" })).toBeInTheDocument();
  });
});
