import type { ConditionReportStaffRow } from "@/lib/admin/condition-reports/condition-reports-staff-list.vm";
import { queuePanel } from "@/test/queue-panel";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConditionReportsStaffList,
  type ConditionReportsStaffListProps,
} from "./condition-reports-staff-list";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/condition-reports",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/actions/admin", () => ({
  adminDeclineConditionReportResultAction: vi.fn(),
  adminMarkConditionReportInProgressResultAction: vi.fn(),
  adminFulfilConditionReportResultAction: vi.fn(),
}));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));

function request(id: string, lotTitle: string, requestedAt: string): ConditionReportStaffRow {
  return {
    id,
    lotId: `lot_${id}`,
    lotTitle,
    requester: `Buyer ${id}`,
    requesterHref: `/admin/clients/user_${id}`,
    requestedAt,
    statusCode: "pending",
    status: { label: "Pending", tone: "warning" },
    requestNote: "Any foxing on the margins?",
    responseNote: null,
    fulfilledAt: null,
    lotHref: `/admin/lots/lot_${id}`,
    closed: false,
  };
}

// Shown newest first, the list's order.
const rows = [
  request("req_a", "Oldest lot", "2026-10-01T10:00:00.000Z"),
  request("req_b", "Newest lot", "2026-10-30T10:00:00.000Z"),
  request("req_c", "Middle lot", "2026-10-15T10:00:00.000Z"),
];

function renderList(overrides: Partial<ConditionReportsStaffListProps> = {}) {
  const props: ConditionReportsStaffListProps = {
    rows,
    search: {},
    views: [],
    activeLens: "all",
    attention: [],
    metrics: null,
    empty: { title: "None", description: "None" },
    pageSize: 50,
    pagination: null,
    listError: null,
    ...overrides,
  };
  return render(
    <StaffTooltipProvider>
      <ConditionReportsStaffList {...props} />
    </StaffTooltipProvider>,
  );
}

describe("ConditionReportsStaffList queue panel", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/admin/condition-reports");
  });
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("opens a request into the URL and steps with J and K in the order shown", () => {
    renderList();
    fireEvent.click(screen.getAllByText("Middle lot")[0] as HTMLElement);
    expect(window.location.search).toBe("?request=req_c");
    expect(queuePanel.position()).toBe("2 of 3");
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "j" });
    expect(queuePanel.title("Oldest lot")).toBeVisible();
    expect(window.location.search).toBe("?request=req_a");
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "k" });
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "k" });
    expect(queuePanel.title("Newest lot")).toBeVisible();
    expect(queuePanel.position()).toBe("1 of 3");
  });

  it("reopens the request from its address", () => {
    window.history.replaceState(null, "", "/admin/condition-reports?request=req_b");
    renderList({ search: { request: "req_b" } });
    expect(queuePanel.title("Newest lot")).toBeVisible();
  });

  it("does not step away from a half-filled fulfil form", () => {
    renderList();
    fireEvent.click(screen.getAllByText("Middle lot")[0] as HTMLElement);
    const dialog = queuePanel.get() as HTMLElement;
    const note = within(dialog).getAllByRole("textbox")[0] as HTMLElement;
    fireEvent.change(note, { target: { value: "Light foxing top left" } });
    fireEvent.keyDown(dialog, { key: "j" });
    expect(queuePanel.title("Middle lot")).toBeVisible();
  });

  it("closes on Back and returns focus to the request last shown on Escape", async () => {
    renderList();
    fireEvent.click(screen.getAllByText("Newest lot")[0] as HTMLElement);
    act(() => window.history.back());
    await waitFor(() => expect(queuePanel.get()).not.toBeInTheDocument());
    expect(window.location.search).toBe("");

    fireEvent.click(screen.getAllByText("Newest lot")[0] as HTMLElement);
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "j" });
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "Escape" });
    await waitFor(() => expect(queuePanel.get()).not.toBeInTheDocument());
    await waitFor(() => expect(queuePanel.focusedRowText()).toContain("Middle lot"));
  });

  it("keeps decline behind its confirmation", () => {
    renderList();
    fireEvent.click(screen.getAllByText("Newest lot")[0] as HTMLElement);
    const dialog = queuePanel.get() as HTMLElement;
    fireEvent.click(within(dialog).getByRole("button", { name: /^Decline/ }));
    expect(screen.getAllByRole("dialog").length).toBeGreaterThan(1);
  });
});
