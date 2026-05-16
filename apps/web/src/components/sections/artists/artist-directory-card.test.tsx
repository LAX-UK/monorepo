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
  birthYear: "1980",
  deathYear: null,
  websiteUrl: null,
  socialLinks: {},
  featured: false,
  verified: false,
  archived: false,
  ownerUserId: null,
  createdAt: new Date("2020-01-01"),
  updatedAt: new Date("2020-01-01"),
  lotCount: 3,
};

describe("ArtistDirectoryCard", () => {
  it("renders MediaPlaceholder when portraitUrl is null", () => {
    render(
      <ul>
        <ArtistDirectoryCard artist={baseArtist} watching={false} isAuthenticated={false} />
      </ul>,
    );

    expect(screen.getByLabelText("Artist portrait placeholder")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Jane Doe" })).toBeInTheDocument();
  });
});
