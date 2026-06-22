import { CatalogArtistViewClient } from "@/components/sections/artists/catalog-artist-view-client";
import {
  replaceMarketingViewUrl,
  resetMarketingViewClientState,
} from "@/lib/preferences/view-url-store";
import type { PublicArtistDirectoryRow } from "@auction/types";
import { act, render } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/components/ui/media-image", () => ({
  MediaImage: () => <div data-testid="media-image" />,
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
};

describe("CatalogArtistViewClient", () => {
  beforeEach(() => {
    resetMarketingViewClientState();
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    resetMarketingViewClientState();
    window.history.replaceState({}, "", "/");
  });

  it("reacts to client view URL changes without a server prop update", () => {
    const { container } = render(
      <CatalogArtistViewClient
        initialView="grid"
        rows={[baseArtist]}
        watchSet={new Set()}
        isAuthenticated={false}
      />,
    );

    expect(container.querySelector("ul")?.className).toMatch(/grid/);

    act(() => {
      replaceMarketingViewUrl("/artists?view=list", "list");
    });

    expect(container.querySelector("ul")?.className).toMatch(/divide-y/);
  });
});
