import {
  LEGAL_ENTITIES_DEFAULT_SORT,
  type LegalEntitiesStaffRow,
} from "@/lib/admin/people/legal-entities-staff-list.vm";
import { EMPTY_ADMIN_LEGAL_ENTITIES_LIST_SUMMARY } from "@/lib/data/http/admin-legal-entities.shared";
import { expectRowOpensPage, resetRowLinks, rowOf } from "@/test/row-link";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LegalEntitiesStaffList,
  type LegalEntitiesStaffListProps,
} from "./legal-entities-staff-list";

const push = vi.fn();

vi.mock("next/link", async () => (await import("@/test/row-link")).nextLinkMock());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push, replace: vi.fn() }),
  usePathname: () => "/admin/legal-entities",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/legal-entity/acting-context.actions", () => ({
  startAdminImpersonationAfterLookup: vi.fn(),
}));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));

function entity(id: string, name: string, stripeDueCount = 0): LegalEntitiesStaffRow {
  return {
    id,
    name,
    kind: "Organisation · Gallery",
    status: "approved",
    statusPresentation: { label: "Approved", tone: "success" },
    stripeDueCount,
    stripe: stripeDueCount > 0 ? `${stripeDueCount} requirements due` : null,
    updatedAt: "2026-10-20T10:00:00.000Z",
  };
}

function renderList(patch: Partial<LegalEntitiesStaffListProps> = {}) {
  const props: LegalEntitiesStaffListProps = {
    search: { q: "gallery", sort: "name", offset: "50" },
    view: "all",
    sort: { columnId: "name", direction: "asc" },
    rows: [entity("le_1", "Barnes Gallery", 2), entity("le_2", "Harbour Rooms")],
    summary: EMPTY_ADMIN_LEGAL_ENTITIES_LIST_SUMMARY,
    pageSize: 50,
    pagination: null,
    loadError: null,
    ...patch,
  };
  return render(
    <StaffTooltipProvider>
      <LegalEntitiesStaffList {...props} />
    </StaffTooltipProvider>,
  );
}

const IN_LIST = "?list=q%3Dgallery%26sort%3Dname%26offset%3D50";

describe("LegalEntitiesStaffList", () => {
  beforeEach(() => {
    resetRowLinks();
    push.mockClear();
  });

  it("opens the entity's page from its row, keeping the list for Previous, Next and Back", () => {
    renderList();
    expectRowOpensPage({
      title: "Barnes Gallery",
      href: `/admin/legal-entities/le_1${IN_LIST}`,
      background: "2 requirements due",
    });
  });

  it("has no quick-view panel any more", () => {
    renderList({ search: { entity: "le_1" }, sort: LEGAL_ENTITIES_DEFAULT_SORT });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // An old `?entity=` is not part of the list a record remembers.
    expect(
      within(rowOf("Harbour Rooms")).getAllByRole("link", { name: "Harbour Rooms" })[0],
    ).toHaveAttribute("href", "/admin/legal-entities/le_2");
  });

  it("sorts in the URL when a column header is clicked", () => {
    renderList({ search: { q: "gallery" }, sort: LEGAL_ENTITIES_DEFAULT_SORT });
    fireEvent.click(screen.getByRole("button", { name: /^Name/ }));
    expect(push).toHaveBeenCalledWith("/admin/legal-entities?q=gallery&sort=name", {
      scroll: false,
    });
  });

  it("keeps the rows in the order the server sorted them", () => {
    renderList({
      rows: [entity("le_2", "Harbour Rooms"), entity("le_1", "Barnes Gallery")],
      sort: { columnId: "name", direction: "desc" },
    });
    const names = screen
      .getAllByRole("link", { name: /Harbour Rooms|Barnes Gallery/ })
      .map((link) => link.textContent);
    expect(names[0]).toBe("Harbour Rooms");
  });
});
