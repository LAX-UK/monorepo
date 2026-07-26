import { ArtistCreateForm } from "@/components/admin/artist-detail/artist-create-form";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import type { CategoryNode } from "@auction/types";
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

describe("ArtistCreateForm", () => {
  it("renders sidebar wizard create form with external submit id", () => {
    adminArtistFormProps.length = 0;

    render(
      <ArtistCreateForm
        categories={[category]}
        ownerUserId={null}
        displayName=""
        initialScenario={null}
      />,
    );

    expect(screen.getByTestId("admin-artist-form")).toBeInTheDocument();
    expect(adminArtistFormProps.at(-1)).toMatchObject({
      mode: "create",
      htmlFormId: CATALOG_FORM_IDS.artist,
      wizardLayout: "sidebar",
      cancelHref: "/admin/artists",
    });
  });
});
