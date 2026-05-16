import { LotCard } from "@/components/marketing/lot-card";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("LotCard", () => {
  it("Grid renders link and image slot", () => {
    render(
      <ul>
        <li>
          <LotCard.Grid
            href="/lot/test"
            image={<span data-testid="img" />}
            title={<h2>Lot title</h2>}
            meta={<p>Meta</p>}
          />
        </li>
      </ul>,
    );
    const link = screen.getByRole("link", { name: /lot title/i });
    expect(link).toHaveAttribute("href", "/lot/test");
    expect(screen.getByTestId("img")).toBeInTheDocument();
  });

  it("HeroTile exposes the marketing hero tile link", () => {
    render(
      <LotCard.HeroTile
        lotId="1"
        index={0}
        href="/lot/a"
        linkAriaLabel="Lot A — view artwork"
        imageUrl={null}
        imageAlt=""
        sizes="100px"
        belowImage={<p>Lot A</p>}
      />,
    );
    expect(screen.getByRole("link", { name: /lot a — view artwork/i })).toHaveAttribute(
      "href",
      "/lot/a",
    );
  });
});
