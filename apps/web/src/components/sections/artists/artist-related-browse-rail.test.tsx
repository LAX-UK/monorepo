import { ArtistRelatedBrowseRail } from "@/components/sections/artists/catalog-artist-views";
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

const row = (id: string, name: string): PublicArtistDirectoryRow => ({
  id,
  displayName: name,
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  portraitUrl: null,
  heroImageUrl: null,
  shortBio: null,
  longBio: null,
  statement: null,
  nationality: null,
  location: null,
  birthYear: null,
  deathYear: null,
  websiteUrl: null,
  socialLinks: {},
  featured: false,
  verified: false,
  archived: false,
  ownerUserId: null,
  createdAt: new Date("2020-01-01"),
  updatedAt: new Date("2020-01-01"),
  lotCount: 1,
});

describe("ArtistRelatedBrowseRail", () => {
  it("renders a horizontal list of compact artist cards", () => {
    const rows = [row("a1", "Alpha"), row("a2", "Beta")];
    render(<ArtistRelatedBrowseRail rows={rows} watchSet={new Set()} isAuthenticated={false} />);

    const list = screen.getByRole("list");
    expect(list).toHaveClass("overflow-x-auto");

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Beta" })).toBeInTheDocument();
  });
});
