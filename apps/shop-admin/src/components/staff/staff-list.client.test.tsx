// @vitest-environment jsdom
import type { AdminStaffMemberList } from "@auction/shop-contracts";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const grantStaffRole = vi.fn();
const revokeStaffRole = vi.fn();

vi.mock("@/server/application/admin-people-actions.server", () => ({
  grantStaffRole,
  revokeStaffRole,
}));
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
      role: "shop_admin",
    }),
    member({
      staffMemberId: "33333333-3333-4333-8333-333333333333",
      identitySubjectId: "subject-theo",
      displayName: "Theo Marsh",
      email: "theo@lax.art",
      role: "finance",
      disabledAt: "2026-09-01T09:00:00.000Z",
    }),
  ],
  nextCursor: null,
  counts: { active: 2, disabled: 1 },
};

function renderList(query: Record<string, string> = {}) {
  render(
    <StaffList
      state={staffList.parse(query)}
      page={page}
      currentSubject="subject-me"
      bidStaffUrl="https://lax.bid/admin/staff"
    />,
  );
}

const rowOf = (text: string) =>
  within(screen.getByRole("grid")).getByText(text).closest("tr") as HTMLElement;
const choose = (text: string, name: RegExp) => {
  fireEvent.click(within(rowOf(text)).getByRole("menuitem", { name }));
};

beforeEach(() => {
  grantStaffRole.mockReset().mockResolvedValue({ ok: true, data: {} });
  revokeStaffRole.mockReset().mockResolvedValue({ ok: true, data: undefined });
});

describe("the staff list", () => {
  it("counts each view by access and shows access as words", () => {
    renderList();
    expect(screen.getByRole("link", { name: /^All\s*3/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Access removed\s*1/ })).toBeInTheDocument();
    expect(within(rowOf("Theo Marsh")).getByText("Access removed")).toBeInTheDocument();
    expect(within(rowOf("Sam Lee")).getByText("Operations")).toBeInTheDocument();
  });

  it("never lets someone change their own access", () => {
    renderList();
    const own = within(rowOf("Eleanor Pereira")).getByRole("menuitem", { name: /Remove access/ });
    expect(own).toHaveAttribute("aria-disabled", "true");
  });

  it("changes a role from a picker that says what each role allows", async () => {
    renderList();
    choose("Sam Lee", /Change role/);
    const dialog = await screen.findByRole("dialog", { name: "Change Sam Lee’s role?" });
    expect(within(dialog).getByText("Operations (current role)")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Orders, refunds, payouts, edition prices and the audit log."),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("radio", { name: /Finance/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Make them Finance" }));
    await waitFor(() => expect(grantStaffRole).toHaveBeenCalledTimes(1));
    expect(grantStaffRole).toHaveBeenCalledWith({
      identitySubjectId: "subject-sam",
      role: "finance",
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });

  it("removes access only with a reason", async () => {
    renderList();
    choose("Sam Lee", /Remove access/);
    const dialog = await screen.findByRole("dialog", { name: "Remove Sam Lee’s access?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove access" }));
    expect(within(dialog).getByText("Say why their access is being removed.")).toBeInTheDocument();
    expect(revokeStaffRole).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "Left the gallery team" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove access" }));
    await waitFor(() => expect(revokeStaffRole).toHaveBeenCalledTimes(1));
    expect(revokeStaffRole).toHaveBeenCalledWith({
      identitySubjectId: "subject-sam",
      reason: "Left the gallery team",
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });

  it("adds someone by email with a chosen role, checked on submit", async () => {
    renderList();
    fireEvent.click(screen.getByRole("button", { name: "Add staff" }));
    const dialog = await screen.findByRole("dialog", { name: "Add staff" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add staff" }));
    expect(
      within(dialog).getAllByText("Enter the email on their LAX login.").length,
    ).toBeGreaterThan(0);
    expect(grantStaffRole).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "ada@lax.art" } });
    fireEvent.click(within(dialog).getByRole("radio", { name: /Catalogue editor/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Add as Catalogue editor" }));
    await waitFor(() => expect(grantStaffRole).toHaveBeenCalledTimes(1));
    expect(grantStaffRole).toHaveBeenCalledWith(
      expect.objectContaining({ email: "ada@lax.art", role: "catalogue_editor" }),
    );
  });

  it("opens a person's panel from the URL with what their role allows", async () => {
    renderList({ staff: "33333333-3333-4333-8333-333333333333" });
    const panel = await screen.findByRole("dialog", { name: /Theo Marsh/ });
    expect(within(panel).getByRole("button", { name: "Give access again" })).toBeInTheDocument();
    expect(
      within(panel).getByText("Orders, refunds, payouts, edition prices and the audit log."),
    ).toBeInTheDocument();
  });
});
