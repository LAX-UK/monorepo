import type { InvitationStaffRow } from "@/lib/admin/people/invitations-staff-list.vm";
import { queuePanel } from "@/test/queue-panel";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvitationsStaffList, type InvitationsStaffListProps } from "./invitations-staff-list";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/invitations",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/actions/admin/admin-invitations", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return Object.fromEntries(Object.keys(actual).map((name) => [name, vi.fn()]));
});
vi.mock("@/components/admin/invite-people-dialog", () => ({ InvitePeopleDialog: () => null }));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));

function invitation(id: string, email: string, resendBlocked: string | null = null) {
  return {
    id,
    email,
    targetRole: "staff",
    targetStaffRole: null,
    grants: [],
    status: { label: "Sent", tone: "info" },
    invitedBy: "Sam Staff",
    sentAt: "2026-11-01T10:00:00.000Z",
    openedAt: null,
    expiresAt: "2026-11-08T10:00:00.000Z",
    delivery: "Delivered",
    resendBlocked,
    revokeBlocked: null,
  } as InvitationStaffRow;
}

const rows = [
  invitation("inv_a", "ada@example.test"),
  invitation("inv_b", "grace@example.test", "Accepted invitations cannot be resent."),
  invitation("inv_c", "alan@example.test"),
];

function renderList(overrides: Partial<InvitationsStaffListProps> = {}) {
  const props: InvitationsStaffListProps = {
    rows,
    search: {},
    counts: { total: 3, pending: 3, accepted: 0 },
    filterChips: [],
    pageSize: 50,
    pagination: null,
    offPage: null,
    loadError: null,
    filtered: false,
    ...overrides,
  };
  return render(
    <StaffTooltipProvider>
      <InvitationsStaffList {...props} />
    </StaffTooltipProvider>,
  );
}

describe("InvitationsStaffList queue panel", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/admin/invitations");
  });
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("links each invitation to its own address: the panel is the record", () => {
    renderList();
    expect(screen.getAllByRole("link", { name: "ada@example.test" })[0]).toHaveAttribute(
      "href",
      "/admin/invitations?invitation=inv_a",
    );
  });

  it("opens into the URL, shows its place and steps with J and K", () => {
    renderList();
    fireEvent.click(screen.getAllByText("grace@example.test")[0] as HTMLElement);
    expect(window.location.search).toBe("?invitation=inv_b");
    expect(queuePanel.position()).toBe("2 of 3");
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "j" });
    expect(queuePanel.title("alan@example.test")).toBeVisible();
    expect(window.location.search).toBe("?invitation=inv_c");
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "k" });
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "k" });
    expect(queuePanel.title("ada@example.test")).toBeVisible();
  });

  it("reopens from its address, off this page too, and says when a link is stale", () => {
    window.history.replaceState(null, "", "/admin/invitations?invitation=inv_z");
    const { unmount } = renderList({
      search: { invitation: "inv_z" },
      offPage: invitation("inv_z", "off@example.test"),
    });
    expect(queuePanel.title("off@example.test")).toBeVisible();
    unmount();
    renderList({ search: { invitation: "inv_gone" } });
    expect(queuePanel.title("Invitation not found")).toBeVisible();
  });

  it("closes on Back and returns focus to the invitation last shown on Escape", async () => {
    renderList();
    fireEvent.click(screen.getAllByText("ada@example.test")[0] as HTMLElement);
    act(() => window.history.back());
    await waitFor(() => expect(queuePanel.get()).not.toBeInTheDocument());
    expect(window.location.search).toBe("");

    fireEvent.click(screen.getAllByText("ada@example.test")[0] as HTMLElement);
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "j" });
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "Escape" });
    await waitFor(() => expect(queuePanel.get()).not.toBeInTheDocument());
    await waitFor(() => expect(queuePanel.focusedRowText()).toContain("grace@example.test"));
  });

  it("resends through its confirmation, and says why when resend is blocked", () => {
    renderList();
    fireEvent.click(screen.getAllByText("ada@example.test")[0] as HTMLElement);
    fireEvent.click(
      within(queuePanel.get() as HTMLElement).getByRole("button", { name: "Resend invitation" }),
    );
    expect(screen.getAllByRole("dialog").length).toBeGreaterThan(1);
  });

  it("shows the reason instead of Resend when an invitation cannot be resent", () => {
    renderList();
    fireEvent.click(screen.getAllByText("grace@example.test")[0] as HTMLElement);
    const panel = queuePanel.get() as HTMLElement;
    expect(within(panel).queryByRole("button", { name: "Resend invitation" })).toBeNull();
    expect(within(panel).getByText("Accepted invitations cannot be resent.")).toBeVisible();
  });
});
