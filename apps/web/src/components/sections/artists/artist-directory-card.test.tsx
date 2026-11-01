import { ArtistDirectoryCard } from "@/components/sections/artists/artist-directory-card";
import type { PublicArtistDirectoryRow } from "@auction/types";
import { render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: (props: ComponentProps<"img">) => (
    // biome-ignore lint/a11y/useAltText: alt is supplied by the component under test.
    <img {...props} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: { children: ReactNode; href: string } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/marketing/artist-watch-heart", () => ({
  ArtistWatchHeart: () => <button type="button">Follow</button>,
}));

const baseArtist: PublicArtistDirectoryRow = {
  id: "artist-1",
  displayName: "Jane Doe",
  slug: "jane-doe",
  portraitUrl: null,
  heroImageUrl: null,
  shortBio: "Painter",
  longBio: null,
  statement: null,
  nationality: "British",
  location: null,
  countryCode: null,
  birthYear: "1980",
  deathYear: null,
  foundedYear: null,
  dissolvedYear: null,
  websiteUrl: null,
  socialLinks: {},
  attributes: {},
  featured: false,
  verified: false,
  archived: false,
  ownerUserId: null,
  createdAt: new Date("2020-01-01"),
  updatedAt: new Date("2020-01-01"),
  lotCount: 3,
  resultCount: 0,
  workImageUrl: null,
};

describe("ArtistDirectoryCard", () => {
  it("is a text-only card, not a hatched tile, when there is no portrait and no work", () => {
    const { container } = render(
      <ul>
        <ArtistDirectoryCard
          artist={{ ...baseArtist, lotCount: 0, resultCount: 2 }}
          watching={false}
          isAuthenticated={false}
        />
      </ul>,
    );

    expect(screen.queryByText("JD")).not.toBeInTheDocument();
    expect(container.querySelector(".marketing-work-mat")).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Jane Doe" })).toBeInTheDocument();
    expect(screen.getByText("2 results")).toBeInTheDocument();
  });

  it("shows a representative work on the paper mat when there is no portrait", () => {
    const { container } = render(
      <ul>
        <ArtistDirectoryCard
          artist={{ ...baseArtist, workImageUrl: "https://example.com/work.jpg" }}
          watching={false}
          isAuthenticated={false}
        />
      </ul>,
    );

    expect(container.querySelector(".marketing-work-mat")).not.toBeNull();
    expect(screen.queryByText("JD")).not.toBeInTheDocument();
  });

  it("shows the facts line and the lot count", () => {
    render(
      <ul>
        <ArtistDirectoryCard
          artist={baseArtist}
          watching={false}
          isAuthenticated={false}
          density="compact"
        />
      </ul>,
    );

    expect(screen.getByRole("heading", { level: 3, name: "Jane Doe" })).toBeInTheDocument();
    expect(screen.getByText("British · b. 1980")).toBeInTheDocument();
    expect(screen.getByText("3 lots")).toBeInTheDocument();
    expect(screen.queryByText("Painter")).not.toBeInTheDocument();
  });

  it("leaves out the lot count when there are no lots", () => {
    render(
      <ul>
        <ArtistDirectoryCard
          artist={{ ...baseArtist, lotCount: 0 }}
          watching={false}
          isAuthenticated={false}
        />
      </ul>,
    );

    expect(screen.queryByText(/lots?$/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Jane Doe" })).toHaveAttribute(
      "href",
      expect.stringContaining("/artist/jane-doe/artist-1"),
    );
  });
});
