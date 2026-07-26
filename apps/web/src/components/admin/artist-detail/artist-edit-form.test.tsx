import { ArtistEditForm } from "@/components/admin/artist-detail/artist-edit-form";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import type { ArtistProfile, CategoryNode } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const adminArtistFormProps: Array<Record<string, unknown>> = [];

vi.mock("@/components/admin/admin-artist-form", () => ({
  AdminArtistForm: (props: Record<string, unknown>) => {
    adminArtistFormProps.push(props);
    return <div data-testid="admin-artist-form" />;
  },
}));

const category: CategoryNode = {
  id: "cat-1",
  name: "Paintings",
  slug: "paintings",
  parentId: null,
  sortOrder: 0,
  archived: false,
  description: null,
  heroImageKey: null,
  children: [],
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const artist: ArtistProfile = {
  id: "artist-1",
  displayName: "Carolina Vale",
  slug: "carolina-vale",
  kind: "artist",
  status: "approved",
  portraitUrl: null,
  heroImageUrl: null,
  shortBio: null,
  longBio: null,
  statement: null,
  nationality: null,
  location: null,
  countryCode: null,
  birthYear: null,
  deathYear: null,
  foundedYear: null,
  dissolvedYear: null,
  websiteUrl: null,
  socialLinks: {},
  ownerUserId: null,
  featured: false,
  verified: false,
  archived: false,
  categories: [],
  attributes: {},
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("ArtistEditForm", () => {
  it("renders sidebar wizard edit form with external submit id and cancel href", () => {
    adminArtistFormProps.length = 0;

    render(
      <ArtistEditForm
        artist={artist}
        categories={[category]}
        cancelHref="/admin/artists/artist-1"
      />,
    );

    expect(screen.getByTestId("admin-artist-form")).toBeInTheDocument();
    expect(adminArtistFormProps.at(-1)).toMatchObject({
      mode: "edit",
      artistId: "artist-1",
      slug: "carolina-vale",
      htmlFormId: CATALOG_FORM_IDS.artist,
      wizardLayout: "sidebar",
      cancelHref: "/admin/artists/artist-1",
    });
  });
});
