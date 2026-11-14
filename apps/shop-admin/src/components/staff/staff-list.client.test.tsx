// @vitest-environment jsdom
import { pinClock } from "@/test/pin-clock";
import type { AdminStaffMemberList } from "@auction/shop-contracts";
import { capabilitiesForRoles } from "@auction/shop-domain";
import { StaffAccessProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/saved-views-port.client", () => ({
  createSavedViewsPort: () => ({
    load: async () => [],
    create: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
    reorder: vi.fn(),
  }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/staff",
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));
vi.mock("@auction/ui/components/dropdown-menu", async () =>
  (await import("@/test/radix-stubs")).dropdownMenuStub(),
);
vi.mock("@auction/ui/components/popover", async () =>
  (await import("@/test/radix-stubs")).popoverStub(),
);

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { StaffList } = await import("./staff-list.client");
const { staffList } = await import("@/server/domain/people-lists.vm");

const member = (overrides: Partial<AdminStaffMemberList["items"][number]> = {}) => ({
  staffMemberId: "11111111-1111-4111-8111-111111111111",
  identitySubjectId: "subject-sam",
  displayName: "Sam Lee",
  email: "sam@lax.art",
  lastActiveAt: "2026-10-20T09:00:00.000Z",
  role: "operations",
  roles: [{ role: "operations", startsAt: "2026-01-10T09:00:00.000Z", endsAt: null }],
  disabledAt: null,
  createdAt: "2026-01-10T09:00:00.000Z",
  ...overrides,
});

const page: AdminStaffMemberList = {
  items: [
    member(),
    member({
      staffMemberId: "22222222-2222-4222-8222-222222222222",
      identitySubjectId: "subject-me",
      displayName: "Eleanor Pereira",
      email: "eleanor@lax.art",
      role: "catalogue_editor",
      roles: [
        { role: "catalogue_editor", startsAt: "2026-10-03T09:00:00.000Z", endsAt: null },
        {
          role: "editor",
          startsAt: "2026-10-03T09:00:00.000Z",
          endsAt: "2026-12-01T00:00:00.000Z",
        },
      ],
    }),
    member({
      staffMemberId: "33333333-3333-4333-8333-333333333333",
      identitySubjectId: "subject-theo",
      displayName: "Theo Marsh",
      email: "theo@lax.art",
      role: "finance",
      roles: [],
      disabledAt: "2026-09-01T09:00:00.000Z",
    }),
  ],
  nextCursor: null,
  counts: { active: 2, disabled: 1 },
};

function renderList(
  query: Record<string, string> = {},
  roles: ("shop_admin" | "read_only")[] = ["shop_admin"],
) {
  const held = capabilitiesForRoles(roles);
  render(
    <StaffAccessProvider access={{ can: (p) => typeof p === "string" && held.has(p as never) }}>
      <StaffList
        state={staffList.parse(query)}
        page={page}
        currentSubject="subject-me"
        bidStaffUrl="https://lax.bid/admin/staff"
      />
    </StaffAccessProvider>,
  );
}

const rowOf = (text: string) =>
  // Rows open nothing, so the table is a plain table rather than a grid.
  within(screen.getByRole("table"))
    .getAllByRole("row")
    .find((row) => row.textContent?.includes(text)) as HTMLElement;

pinClock();

describe("the staff list", () => {
  it("counts each view by access and shows every role a person holds", () => {
    renderList();
    expect(screen.getByRole("link", { name: /^All\s*3/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Access removed\s*1/ })).toBeInTheDocument();
    expect(within(rowOf("Theo Marsh")).getByText("Access removed")).toBeInTheDocument();
    expect(within(rowOf("Sam Lee")).getByText("Operations")).toBeInTheDocument();
    expect(
      within(rowOf("Eleanor Pereira")).getByText("Catalogue editor, Editor"),
    ).toBeInTheDocument();
  });

  it("offers no way to change roles here, only a link to Bid admin for Administrators", () => {
    renderList();
    expect(screen.queryByRole("button", { name: "Add staff" })).toBeNull();
    expect(
      within(rowOf("Sam Lee")).queryByRole("menuitem", { name: /Change role|Remove access/ }),
    ).toBeNull();
    expect(screen.getByRole("link", { name: "Manage in Bid admin" })).toHaveAttribute(
      "href",
      "https://lax.bid/admin/staff",
    );
  });

  it("hides the Bid admin link from people who may not manage staff", () => {
    renderList({}, ["read_only"]);
    expect(screen.queryByRole("link", { name: "Manage in Bid admin" })).toBeNull();
  });

  it("shows a person's roles in the row, with the ones that end, and no panel", () => {
    renderList();
    const row = rowOf("Eleanor Pereira");
    expect(within(row).getByText("Catalogue editor, Editor")).toBeInTheDocument();
    expect(within(row).getByText("Editor until Mon 30 Nov")).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: /role/i })).toBeNull();
    expect(row).not.toHaveClass("cursor-pointer");
    fireEvent.click(within(row).getByText("Catalogue editor, Editor"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("links the name to the person's page in Bid admin, in a new tab, and says so", () => {
    renderList();
    const link = within(rowOf("Eleanor Pereira")).getByRole("link", {
      name: "Eleanor Pereira (opens Bid admin)",
    });
    expect(link).toHaveAttribute("href", "https://lax.bid/admin/staff/subject-me");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("title", "Opens Bid admin in a new tab");
  });

  it("shows the name without a link to people who may not manage staff", () => {
    renderList({}, ["read_only"]);
    expect(within(rowOf("Sam Lee")).queryByRole("link", { name: /Sam Lee/ })).toBeNull();
    expect(within(rowOf("Sam Lee")).getByText("Sam Lee")).toBeInTheDocument();
  });
});
