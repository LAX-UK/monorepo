import { VENUES_DEFAULT_SORT, type VenuesStaffRow } from "@/lib/admin/venues/venues-staff-list.vm";
import { expectRowOpensPage, resetRowLinks, rowOf } from "@/test/row-link";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VenuesStaffList, type VenuesStaffListProps } from "./venues-staff-list";

const push = vi.fn();

vi.mock("next/link", async () => (await import("@/test/row-link")).nextLinkMock());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push, replace: vi.fn() }),
  usePathname: () => "/admin/venues",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/auth/capabilities/viewer-capabilities-context", () => ({
  useViewerCapabilities: () => ({ can: () => true }),
}));
vi.mock("@/lib/actions/admin-legal-entities-browse", () => ({
  searchAdminLegalEntitiesBrowseAction: vi.fn(),
}));
vi.mock("@/lib/actions/admin-venues", () => ({ adminArchiveVenueResultAction: vi.fn() }));

function venue(id: string, name: string): VenuesStaffRow {
  return {
    id,
    name,
    slugLabel: null,
    organisationId: "le1",
    organisation: "London Auction Xchange",
    organisationHref: "/admin/legal-entities/le1",
    address: `${name} Road, Whitstable`,
    status: { label: "Active", tone: "success" },
    archived: false,
    capacity: null,
    phone: null,
    email: null,
    website: null,
    createdAt: "2026-01-05T10:00:00.000Z",
    updatedAt: "2026-02-01T10:00:00.000Z",
    href: `/admin/venues/${id}`,
    editHref: `/admin/venues/${id}/edit`,
  } as VenuesStaffRow;
}

function renderList(patch: Partial<VenuesStaffListProps> = {}) {
  const props: VenuesStaffListProps = {
    rows: [venue("v1", "Barnes Gallery"), venue("v2", "Harbour Rooms")],
    search: { q: "gallery", sort: "-updated", offset: "50" },
    sort: { columnId: "updated", direction: "desc" },
    views: [],
    activeView: "active",
    filterChips: [],
    organisation: { id: null, name: null },
    pageSize: 50,
    pagination: null,
    listError: null,
    filtered: true,
    ...patch,
  };
  return render(
    <StaffTooltipProvider>
      <VenuesStaffList {...props} />
    </StaffTooltipProvider>,
  );
}

const IN_LIST = "?list=q%3Dgallery%26sort%3D-updated%26offset%3D50";

describe("VenuesStaffList", () => {
  beforeEach(() => {
    resetRowLinks();
    push.mockClear();
  });

  it("opens a venue's page from its row, keeping the list for Previous, Next and Back", () => {
    renderList();
    expectRowOpensPage({
      title: /Barnes Gallery/,
      href: `/admin/venues/v1${IN_LIST}`,
      background: "Barnes Gallery Road, Whitstable",
    });
  });

  it("has no quick-view panel any more", () => {
    renderList({ search: { venue: "v1" }, sort: VENUES_DEFAULT_SORT });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // An old `?venue=` is not part of the list a record remembers.
    expect(
      within(rowOf(/Harbour Rooms/))
        .getAllByRole("link", { name: /Harbour Rooms/ })[0]
        ?.getAttribute("href"),
    ).toBe("/admin/venues/v2");
  });

  it("keeps the organisation as its own link", () => {
    renderList();
    const organisation = within(rowOf(/Barnes Gallery/)).getByRole("link", {
      name: "London Auction Xchange",
    });
    expect(organisation).toHaveAttribute("href", "/admin/legal-entities/le1");
  });

  it("sorts in the URL when a column header is clicked", () => {
    renderList({ search: { q: "gallery" }, sort: VENUES_DEFAULT_SORT });
    fireEvent.click(screen.getByRole("button", { name: /Organisation/ }));
    expect(push).toHaveBeenCalledWith("/admin/venues?q=gallery&sort=organisation", {
      scroll: false,
    });
  });
});
