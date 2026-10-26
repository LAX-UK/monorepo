import {
  PersonalDashboard,
  type PersonalDashboardProps,
} from "@/components/admin/personal-dashboard/personal-dashboard";
import { DEFAULT_DASHBOARD_WIDGETS } from "@/lib/admin/dashboard-widgets.vm";
import type { AdminWorkItem } from "@/lib/data/http/admin-work-items.schema";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/socket", () => ({
  getSocket: () => ({ emit: vi.fn(), on: vi.fn(), off: vi.fn() }),
}));

const payment: AdminWorkItem = {
  id: "payment:pay-1",
  kind: "payment_manual_review",
  domain: "finance",
  title: "Harbour at dusk",
  subtitle: "£4,200.00 · Eleanor Pereira",
  href: "/admin/payments/pay-1",
  saleId: null,
  createdAt: "2026-07-27T10:00:00.000Z",
  sourceUpdatedAt: "2026-07-27T10:00:00.000Z",
  dueAt: null,
  severity: "critical",
  assignedToUserId: null,
  actions: ["capture", "refund"],
};

function props(overrides: Partial<PersonalDashboardProps> = {}): PersonalDashboardProps {
  return {
    title: "Good day, Sam",
    actorUserId: "user-1",
    staffRole: "super_admin",
    widgets: DEFAULT_DASHBOARD_WIDGETS,
    primaryAction: { href: "/admin/payments", label: "Review payments" },
    workInbox: {
      status: "ready",
      data: {
        items: [payment],
        nextCursor: null,
        counts: { total: 1, urgent: 1, byDomain: { finance: 1 } as never },
      },
    },
    workAreas: ["finance", "compliance"],
    area: "all",
    assignment: "all",
    periodDays: 30,
    metrics: [{ id: "live-lots", label: "Live lots", value: "12", href: "/admin/lots" }],
    metricsPeriod: "Now, with trends over the last 30 days",
    saleReadiness: {
      status: "empty",
      data: { rows: [], bidsPerMinute: 0, activeSaleroomSessions: 0 },
      message: "No upcoming sales.",
    },
    activeLotIds: [],
    activity: [],
    ...overrides,
  };
}

function renderDashboard(overrides?: Partial<PersonalDashboardProps>) {
  return render(
    <StaffTooltipProvider>
      <PersonalDashboard {...props(overrides)} />
    </StaffTooltipProvider>,
  );
}

describe("PersonalDashboard", () => {
  it("puts the work first, then the numbers, then recent activity", () => {
    renderDashboard();
    const work = screen.getByRole("region", { name: "Your work" });
    const numbers = screen.getByRole("region", { name: "Your numbers" });
    const activity = screen.getByRole("region", { name: "Recent activity" });
    expect(work.compareDocumentPosition(numbers) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      numbers.compareDocumentPosition(activity) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("marks urgent work and names its area in words", () => {
    renderDashboard();
    const work = screen.getByRole("region", { name: "Your work" });
    expect(within(work).getAllByText("Harbour at dusk").length).toBeGreaterThan(0);
    expect(within(work).getAllByText("Urgent").length).toBeGreaterThan(0);
    expect(within(work).getAllByText("Finance").length).toBeGreaterThan(0);
    expect(within(work).queryByText("finance")).toBeNull();
  });

  it("gives every row its actions menu instead of inline buttons", () => {
    renderDashboard();
    expect(
      screen.getAllByRole("button", { name: "Actions for Harbour at dusk" }).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Capture payment" })).toBeNull();
  });

  it("says nothing needs the person when the inbox is empty", () => {
    renderDashboard({
      workInbox: {
        status: "empty",
        data: {
          items: [],
          nextCursor: null,
          counts: { total: 0, urgent: 0, byDomain: {} as never },
        },
        message: "No individual work items need action right now.",
      },
    });
    expect(screen.getByText("Nothing needs you right now")).toBeTruthy();
  });

  it("keeps one primary action in the header", () => {
    renderDashboard();
    expect(screen.getByRole("link", { name: "Review payments" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Customise" })).toBeTruthy();
  });

  it("leaves out the numbers when the role has none", () => {
    renderDashboard({ metrics: [] });
    expect(screen.queryByRole("region", { name: "Your numbers" })).toBeNull();
  });
});
