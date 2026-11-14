import { BidStaffAccessProvider } from "@/components/admin/access/bid-staff-access-provider";
import type { ClientsStaffRow } from "@/lib/admin/people/clients-staff-list.vm";
import type { StaffAccessReviewPageModel } from "@/lib/admin/people/load-staff-access-review-page";
import type { StaffDirectoryRow } from "@/lib/admin/people/staff-directory-list.vm";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClientsStaffList } from "./clients-staff-list";
import { StaffAccessReviewList } from "./staff-access-review-list";
import { StaffDirectoryList } from "./staff-directory-list";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/clients",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/admin/saved-views-port", () => ({
  createSavedViewsPort: () => ({
    list: async () => [],
    create: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
    reorder: vi.fn(),
  }),
}));
vi.mock("@/components/exports/export-button", () => ({ ExportButton: () => null }));

let open: MockInstance<typeof window.open>;
beforeEach(() => {
  push.mockReset();
  open = vi.spyOn(window, "open").mockImplementation(() => null);
});
afterEach(() => {
  open.mockRestore();
  window.history.replaceState(null, "", "/");
});

function wrap(children: ReactNode) {
  return render(
    <StaffTooltipProvider>
      <BidStaffAccessProvider platformRole="staff" staffRoles={["administrator"]}>
        {children}
      </BidStaffAccessProvider>
    </StaffTooltipProvider>,
  );
}

const CLIENT_HREF = "/admin/clients/user_1?list=status%3Dactive";
const client: ClientsStaffRow = {
  id: "user_1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  account: { label: "Active", tone: "success" },
  identity: { label: "Verified", tone: "success" },
  emailVerified: true,
  twoFactor: false,
  persona: "Individual",
  mobile: null,
  joinedAt: "2026-10-01T09:00:00.000Z",
  identityVerifiedAt: null,
  role: "client",
  staffRole: null,
  suspended: false,
  href: CLIENT_HREF,
};

const STAFF_HREF = "/admin/staff/staff_1?list=sort%3Dname_asc";
const staffMember: StaffDirectoryRow = {
  id: "staff_1",
  name: "Grace Hopper",
  email: "grace@lax.test",
  account: { label: "Active", tone: "success" },
  staffRole: "finance",
  staffRoleLabel: "Finance",
  access: ["Bid · Finance"],
  twoFactor: true,
  lastSignInAt: null,
  joinedAt: "2026-10-01T09:00:00.000Z",
  suspended: false,
  href: STAFF_HREF,
};

function renderClients() {
  return wrap(
    <ClientsStaffList
      rows={[client]}
      search={{ status: "active" }}
      counts={{ total: 1, active: 1, suspended: 0 }}
      filterChips={[]}
      pageSize={50}
      pagination={null}
      canModerate={false}
      canManageRoles={false}
      exportFilters={{}}
      loadError={null}
      filtered={false}
    />,
  );
}

function renderStaff() {
  return wrap(
    <StaffDirectoryList
      rows={[staffMember]}
      search={{ sort: "name_asc" }}
      counts={{ total: 1, active: 1, suspended: 0 }}
      roleCounts={{}}
      filterChips={[]}
      pageSize={50}
      pagination={null}
      canModerate={false}
      canManageRoles={false}
      canInvite={false}
      loadError={null}
      filtered={false}
    />,
  );
}

const REVIEW_HREF = "/admin/staff/ada";
function renderReview(href: string | null = REVIEW_HREF) {
  const model: StaffAccessReviewPageModel = {
    filters: { view: "all", product: null, role: null, q: "" },
    counts: { all: 1, ending: 0 },
    total: 1,
    loadError: null,
    csv: { shown: [], all: [] },
    rows: [
      {
        id: "ada",
        name: "Ada Lovelace",
        email: "ada@lax.test",
        suspended: false,
        lastSignInAt: null,
        nextEnd: null,
        href,
        roleGroups: [],
      },
    ],
  };
  return wrap(<StaffAccessReviewList model={model} search={{}} />);
}

/** The body row holding `text`, in the table (the phone cards are hidden in jsdom too). */
function rowWith(text: string): HTMLElement {
  // A table whose rows open something is a grid; one whose rows open nothing is a plain table.
  const grid = screen.queryByRole("grid") ?? screen.getByRole("table");
  const row = within(grid)
    .getAllByRole("row")
    .find((candidate) => within(candidate).queryByText(text));
  if (!row) throw new Error(`no row with ${text}`);
  return row;
}

describe.each([
  {
    list: "Clients",
    render: renderClients,
    name: "Ada Lovelace",
    other: "Individual",
    href: CLIENT_HREF,
  },
  {
    list: "Staff directory",
    render: renderStaff,
    name: "Grace Hopper",
    other: "Finance",
    href: STAFF_HREF,
  },
  {
    list: "Staff access review",
    render: () => renderReview(),
    name: "Ada Lovelace",
    other: "ada@lax.test",
    href: REVIEW_HREF,
  },
])("$list: a row opens the person's page", ({ render: show, name, other, href }) => {
  it("makes the name a real link to the page, never to a panel", () => {
    show();
    const row = rowWith(other);
    expect(within(row).getByRole("link", { name: new RegExp(name) })).toHaveAttribute("href", href);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("follows the link on a plain click anywhere on the row", () => {
    show();
    fireEvent.click(within(rowWith(other)).getAllByText(other)[0] as HTMLElement);
    expect(push).toHaveBeenCalledWith(href, expect.anything());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens a new tab on Cmd-, Ctrl- and middle-click, leaving the list as it is", () => {
    show();
    const cell = within(rowWith(other)).getAllByText(other)[0] as HTMLElement;
    fireEvent.click(cell, { metaKey: true });
    fireEvent.click(cell, { ctrlKey: true });
    fireEvent(cell, new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 }));
    expect(open).toHaveBeenCalledTimes(3);
    for (const call of open.mock.calls) expect(call[0]).toBe(href);
    expect(push).not.toHaveBeenCalled();
  });

  it("opens the page on Enter, in a new tab on Cmd+Enter", () => {
    show();
    const row = rowWith(other);
    fireEvent.keyDown(row, { key: "Enter", metaKey: true });
    expect(open).toHaveBeenCalledWith(href, "_blank", "noopener");
    fireEvent.keyDown(row, { key: "Enter" });
    expect(push).toHaveBeenCalledWith(href, expect.anything());
  });
});

describe("Staff access review without access to staff records", () => {
  it("leaves the row as plain text that opens nothing", () => {
    renderReview(null);
    const row = rowWith("ada@lax.test");
    expect(within(row).queryByRole("link")).toBeNull();
    fireEvent.click(within(row).getByText("ada@lax.test"));
    fireEvent.click(within(row).getByText("ada@lax.test"), { metaKey: true });
    expect(push).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
});
