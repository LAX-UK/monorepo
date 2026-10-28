/** @vitest-environment jsdom */
import { HomeHero } from "@/components/home/sections/home-hero";
import {
  HomeArtistsSection,
  HomeCollectionsSection,
  HomeStorySection,
  NewEditionsSection,
} from "@/components/home/sections/home-sections";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

const NOW = new Date("2026-10-28T12:00:00.000Z");

describe("home sections when the catalogue is thin", () => {
  afterEach(() => {
    cleanup();
  });

  it("render nothing at all rather than an empty row", () => {
    const { container } = render(
      <>
        <NewEditionsSection editions={null} now={NOW} />
        <HomeStorySection story={null} />
        <HomeArtistsSection artists={null} />
        <HomeCollectionsSection collections={[]} />
      </>,
    );
    expect(container.innerHTML).toBe("");
  });

  it("keeps the first screen whole without a release or quick filters", () => {
    render(
      <HomeHero
        hero={{
          eyebrow: null,
          title: "Limited editions by our gallery artists",
          lead: "Limited-edition prints. Prices include VAT.",
          primary: { label: "Browse editions", href: "/artworks" },
          workLink: null,
          release: null,
        }}
        quickFilters={[]}
      />,
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Limited editions by our gallery artists",
    );
    expect(screen.getByRole("link", { name: "Browse editions" })).toBeTruthy();
    expect(screen.queryByRole("figure")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Quick filters" })).toBeNull();
  });

  it("names each quick filter with its count", () => {
    render(
      <HomeHero
        hero={{
          eyebrow: null,
          title: "Limited editions by our gallery artists",
          lead: "Limited-edition prints. Prices include VAT.",
          primary: { label: "Browse editions", href: "/artworks" },
          workLink: null,
          release: null,
        }}
        quickFilters={[
          { key: "a", label: "Available now", count: 7, href: "/artworks?availability=available" },
          { key: "b", label: "Portraits", count: 1, href: "/artworks?categorySlug=portraits" },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Available now, 7 editions" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Portraits, 1 edition" })).toBeTruthy();
  });
});
