/** @vitest-environment jsdom */
import { HomeArtistsSection } from "@/components/home/sections/home-artists";
import { HomeBrowseSection } from "@/components/home/sections/home-browse";
import { HomeCollectionsSection } from "@/components/home/sections/home-collections";
import { NewEditionsSection } from "@/components/home/sections/home-new-editions";
import { groupEditionVersions } from "@/lib/catalogue/edition-work-group";
import { buildHomeArtists } from "@/lib/home/home-artists";
import { artworkSummary } from "@/test/artwork-summary.fixture";
import type { PublicArtistSummary } from "@auction/shop-contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

const NOW = new Date("2026-10-28T12:00:00.000Z");

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

  it("renders no browse-by rows when there are none", () => {
    const { container } = render(<HomeBrowseSection rows={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("names each browse-by row with its count", () => {
    render(
      <HomeBrowseSection
        rows={[
          { key: "a", label: "Available now", count: 3, href: "/artworks?availability=available" },
          { key: "b", label: "Flora Powers", count: 1, href: "/artists/flora-powers" },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Available now, 3 editions" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Flora Powers, 1 edition" })).toBeTruthy();
  });

  it("sets two new editions side by side, one card per work", () => {
    render(
      <NewEditionsSection
        editions={{
          groups: groupEditionVersions([
            artworkSummary({ slug: "a", title: "A" }),
            artworkSummary({ slug: "b", title: "B" }),
          ]),
          viewAll: { label: "View all 3 editions", href: "/artworks?availability=available" },
        }}
        now={NOW}
      />,
    );
    const list = screen.getByRole("list", { name: "New editions" });
    expect(list.getAttribute("data-layout")).toBe("pair");
    expect(screen.getAllByTestId("shop-edition-card")).toHaveLength(2);
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
