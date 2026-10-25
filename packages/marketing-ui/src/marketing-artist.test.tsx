import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingArtistCard } from "./marketing-artist-card.js";
import { MarketingArtistCrossLinks } from "./marketing-artist-cross-links.js";
import {
  MarketingArtistFacts,
  formatMarketingArtistLifespan,
  marketingArtistFacts,
  marketingArtistFactsLine,
} from "./marketing-artist-facts.js";
import { MarketingArtistHero } from "./marketing-artist-hero.js";
import { MarketingFilterLinkGroups } from "./marketing-filter-link-groups.js";
import { MarketingWorkCard } from "./marketing-work-card.js";

describe("artist facts", () => {
  it("formats life spans from numbers and registry strings", () => {
    expect(formatMarketingArtistLifespan(1471, 1528)).toBe("1471–1528");
    expect(formatMarketingArtistLifespan("1956", null)).toBe("b. 1956");
    expect(formatMarketingArtistLifespan(null, "1528")).toBeNull();
    expect(formatMarketingArtistLifespan("unknown", null)).toBeNull();
  });

  it("orders facts and leaves out empty values", () => {
    expect(
      marketingArtistFactsLine({ nationality: " British ", birthYear: 1956, discipline: "" }),
    ).toBe("British · b. 1956");
    expect(marketingArtistFactsLine({})).toBeNull();
  });

  it("labels each fact for screen readers", () => {
    render(
      <MarketingArtistFacts
        facts={marketingArtistFacts({ nationality: "German", discipline: "Printmaker" })}
      />,
    );
    expect(screen.getByText("Nationality")).toHaveClass("sr-only");
    expect(screen.getByText("German")).toBeInTheDocument();
    expect(screen.getByText("Printmaker")).toBeInTheDocument();
  });
});

describe("MarketingArtistHero", () => {
  it("renders the name as the page heading and omits the portrait column without one", () => {
    const { container } = render(<MarketingArtistHero name="Rowan Hale" eyebrow="Editions by" />);
    expect(screen.getByRole("heading", { level: 1, name: "Rowan Hale" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Rowan Hale" })).toBeInTheDocument();
    expect(container.querySelector(".aspect-\\[4\\/5\\]")).toBeNull();
  });

  it("frames a portrait when given", () => {
    render(
      <MarketingArtistHero name="Rowan Hale" portrait={<img alt="Portrait" src="/p.jpg" />} />,
    );
    expect(screen.getByAltText("Portrait").parentElement).toHaveClass("aspect-[4/5]");
  });
});

describe("MarketingArtistCrossLinks", () => {
  it("renders nothing without links", () => {
    const { container } = render(<MarketingArtistCrossLinks links={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists links to the other products", () => {
    render(
      <MarketingArtistCrossLinks
        links={[{ id: "shop", label: "Editions in LAX Shop", href: "https://shop.example/a" }]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "This artist elsewhere at LAX" });
    const link = within(nav).getByRole("link", { name: "Editions in LAX Shop" });
    expect(link).toHaveAttribute("href", "https://shop.example/a");
    expect(link).toHaveAttribute("rel", "noopener");
  });
});

describe("MarketingArtistCard", () => {
  it("links the name once for keyboard users and shows initials without a portrait", () => {
    render(
      <MarketingArtistCard
        href="/artists/rowan-hale"
        name="Rowan Hale"
        facts="British"
        caption="3 editions"
      />,
    );
    const links = screen.getAllByRole("link", { hidden: false });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName("Rowan Hale");
    expect(screen.getByText("RH")).toBeInTheDocument();
    expect(screen.getByText("3 editions")).toBeInTheDocument();
  });
});

describe("MarketingWorkCard", () => {
  it("shows the whole work on a mat and links the title", () => {
    render(
      <MarketingWorkCard
        href="/artworks/field-notes"
        title="Field notes"
        media={<img alt="Field notes" src="/w.jpg" />}
        footer="£450"
      />,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Field notes" })).toBeInTheDocument();
    expect(screen.getByAltText("Field notes").parentElement?.className).toContain("object-contain");
    expect(screen.getByText("£450")).toBeInTheDocument();
  });
});

describe("MarketingFilterLinkGroups", () => {
  it("marks the active option and offers clear only while filtered", () => {
    const groups = [
      {
        id: "show",
        title: "Show",
        links: [
          { label: "All artists", href: "/artists", active: false },
          { label: "Featured", href: "/artists?featured=1", active: true, count: 4 },
        ],
      },
    ];
    const { rerender } = render(
      <MarketingFilterLinkGroups groups={groups} clearHref="/artists" hasFilters />,
    );
    expect(screen.getByRole("link", { name: "Featured 4" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Clear all filters" })).toBeInTheDocument();
    rerender(<MarketingFilterLinkGroups groups={groups} clearHref="/artists" hasFilters={false} />);
    expect(screen.queryByRole("link", { name: "Clear all filters" })).toBeNull();
  });
});
