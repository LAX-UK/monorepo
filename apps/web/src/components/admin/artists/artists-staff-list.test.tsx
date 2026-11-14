import type { ArtistsStaffRow } from "@/lib/admin/artists/artists-staff-list.vm";
import { expectRowOpensPage, resetRowLinks, rowOf } from "@/test/row-link";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArtistsStaffList, type ArtistsStaffListProps } from "./artists-staff-list";

vi.mock("next/link", async () => (await import("@/test/row-link")).nextLinkMock());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/artists",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/actions/admin", () => ({ adminReviewArtistResultAction: vi.fn() }));

function artist(id: string, name: string): ArtistsStaffRow {
  return {
    id,
    name,
    portraitUrl: null,
    statusCode: "approved",
    status: { label: "Approved", tone: "success" },
    context: "Artist · 1920 – 1999",
    kind: "Artist",
    lifespan: "1920 – 1999",
    lots: 7,
    aliases: 0,
    owner: "Owner Gallery",
    flags: [],
    updatedAt: "2026-11-01T09:00:00.000Z",
    href: `/admin/artists/${id}`,
    editHref: `/admin/artists/${id}/edit`,
    duplicatesHref: `/admin/artists/${id}/duplicates`,
    publicHref: null,
  };
}

function renderList(patch: Partial<ArtistsStaffListProps> = {}) {
  const props: ArtistsStaffListProps = {
    rows: [artist("art_1", "Mary Fedden"), artist("art_2", "John Piper")],
    search: { status: "approved", sort: "popular", offset: "50" },
    views: [],
    activeLens: "all",
    attention: [],
    metrics: null,
    filterChips: [],
    categoryOptions: [],
    countryOptions: [],
    pageSize: 50,
    pagination: null,
    permissions: { canWrite: false, canReview: false, canMerge: false },
    listError: null,
    filtered: true,
    ...patch,
  };
  return render(
    <StaffTooltipProvider>
      <ArtistsStaffList {...props} />
    </StaffTooltipProvider>,
  );
}

const IN_LIST = "?list=status%3Dapproved%26sort%3Dpopular%26offset%3D50";

describe("ArtistsStaffList", () => {
  beforeEach(resetRowLinks);

  it("opens an artist's page from its row, keeping the list for Previous, Next and Back", () => {
    renderList();
    expectRowOpensPage({
      title: /Mary Fedden/,
      href: `/admin/artists/art_1${IN_LIST}`,
      background: "Approved",
    });
  });

  it("has no quick-view panel any more", () => {
    renderList({ search: { artist: "art_1" } });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // An old `?artist=` is not part of the list a record remembers.
    expect(
      within(rowOf(/John Piper/))
        .getAllByRole("link", { name: /John Piper/ })[0]
        ?.getAttribute("href"),
    ).toBe("/admin/artists/art_2");
  });
});
