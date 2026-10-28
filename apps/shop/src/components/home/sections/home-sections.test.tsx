/** @vitest-environment jsdom */
import { HomeArtistsSection } from "@/components/home/sections/home-artists";
import { HomeCollectionsSection } from "@/components/home/sections/home-collections";
import { HomeHero } from "@/components/home/sections/home-hero";
import { NewEditionsSection } from "@/components/home/sections/home-new-editions";
import { buildHomeArtists } from "@/lib/home/home-artists";
import type { HomeHeroVm } from "@/lib/home/home-page.vm";
import { artworkSummary } from "@/test/artwork-summary.fixture";
import type { PublicArtistSummary } from "@auction/shop-contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

const NOW = new Date("2026-10-28T12:00:00.000Z");

const hero: HomeHeroVm = {
  eyebrow: null,
  title: "Limited-edition prints from our Marylebone gallery",
  lead: "Editions by Flora Powers. Prices include VAT.",
  primary: { label: "Browse editions", href: "/artworks" },
  workLink: null,
  release: null,
  browseRows: [],
  emptyAction: null,
};

const artist = (slug: string, name = slug): PublicArtistSummary => ({
  slug,
  name,
  discipline: null,
  portraitUrl: null,
  artworkCount: 3,
});

describe("home sections", () => {
  afterEach(() => {
    cleanup();
  });

  it("render nothing at all rather than an empty row", () => {
    const { container } = render(
      <>
        <NewEditionsSection editions={null} now={NOW} />
        <HomeArtistsSection artists={null} />
        <HomeCollectionsSection collections={[]} />
      </>,
    );
    expect(container.innerHTML).toBe("");
  });

  it("keeps the first screen whole without a release or browse rows", () => {
    render(<HomeHero hero={hero} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(hero.title);
    expect(screen.getByRole("link", { name: "Browse editions" })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Browse by" })).toBeNull();
  });

  it("names each browse-by row with its count", () => {
    render(
      <HomeHero
        hero={{
          ...hero,
          browseRows: [
            {
              key: "a",
              label: "Available now",
              count: 3,
              href: "/artworks?availability=available",
            },
            { key: "b", label: "Flora Powers", count: 1, href: "/artists/flora-powers" },
          ],
        }}
      />,
    );
    expect(screen.getByRole("link", { name: "Available now, 3 editions" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Flora Powers, 1 edition" })).toBeTruthy();
  });

  it("offers one way on when nothing is on sale", () => {
    render(
      <HomeHero
        hero={{
          ...hero,
          title: "New editions are on their way",
          primary: null,
          emptyAction: { label: "See original works on lax.art", href: "https://art.test" },
        }}
      />,
    );
    expect(screen.queryByRole("link", { name: "Browse editions" })).toBeNull();
    expect(screen.getByRole("link", { name: "See original works on lax.art" })).toBeTruthy();
  });

  it("sets two new editions side by side, each saying where it leads", () => {
    render(
      <NewEditionsSection
        editions={{
          items: [
            artworkSummary({ slug: "a", title: "A" }),
            artworkSummary({ slug: "b", title: "B" }),
          ],
          viewAll: { label: "View all 3 editions", href: "/artworks?availability=available" },
        }}
        now={NOW}
      />,
    );
    const list = screen.getByRole("list", { name: "New editions" });
    expect(list.getAttribute("data-layout")).toBe("pair");
    expect(screen.getAllByText("See the edition")).toHaveLength(2);
  });

  it("features one artist with their editions and their lax.art profile", () => {
    const artists = buildHomeArtists({
      artists: [artist("flora-powers", "Flora Powers")],
      total: 1,
      soloDetail: null,
      artBaseUrl: new URL("https://art.test"),
    });
    render(<HomeArtistsSection artists={artists} />);
    expect(screen.getByRole("heading", { level: 2, name: "Flora Powers" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Editions by Flora Powers" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Read the profile on lax.art" }).getAttribute("href"),
    ).toBe("https://art.test/artists/flora-powers");
  });

  it("shows initials for an artist without a portrait in a pair", () => {
    const artists = buildHomeArtists({
      artists: [artist("juno-frost", "Juno Frost"), artist("theo-marsh", "Theo Marsh")],
      total: 2,
      soloDetail: null,
      artBaseUrl: null,
    });
    render(<HomeArtistsSection artists={artists} />);
    expect(screen.getByText("JF")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Editions by Theo Marsh" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /lax\.art/ })).toBeNull();
  });
});
