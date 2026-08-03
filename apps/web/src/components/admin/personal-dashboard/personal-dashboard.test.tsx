import { PersonalDashboard } from "@/components/admin/personal-dashboard/personal-dashboard";
import { DEFAULT_DASHBOARD_WIDGETS } from "@/lib/admin/dashboard-widgets.vm";
import { buildRecentActivitySlice } from "@/lib/admin/dashboard/recent-activity.slice";
import { TooltipProvider } from "@auction/ui/components/tooltip";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/admin",
  useSearchParams: () => new URLSearchParams(),
}));

const emptyWorkInbox = {
  status: "ready" as const,
  data: {
    items: [
      {
        id: "payment:pay-1",
        kind: "payment_manual_review" as const,
        domain: "finance" as const,
        title: "Manual review payment",
        subtitle: null,
        href: "/admin/payments/pay-1",
        saleId: null,
        createdAt: "2026-07-27T10:00:00.000Z",
        sourceUpdatedAt: "2026-07-27T10:00:00.000Z",
        dueAt: null,
        severity: "critical" as const,
        assignedToUserId: null,
        actions: ["capture"] as "capture"[],
      },
    ],
    nextCursor: null,
    counts: {
      total: 1,
      urgent: 1,
      byDomain: {
        finance: 1,
        compliance: 0,
        catalogue: 0,
        saleroom: 0,
        fulfilment: 0,
        clients: 0,
      },
    },
  },
};

describe("PersonalDashboard", () => {
  it("renders work inbox as the primary surface", () => {
    render(
      <TooltipProvider>
        <PersonalDashboard
          actorUserId="user-1"
          widgets={DEFAULT_DASHBOARD_WIDGETS}
          staffRole="super_admin"
          activeLotIds={[]}
          workInbox={emptyWorkInbox}
          saleReadiness={{
            status: "empty",
            data: { rows: [], bidsPerMinute: 0, activeSaleroomSessions: 0 },
            message: "No upcoming sales.",
          }}
          recentActivity={buildRecentActivitySlice([])}
        />
      </TooltipProvider>,
    );

    expect(screen.getByRole("heading", { name: /work inbox/i })).toBeTruthy();
    expect(screen.getAllByText("Manual review payment").length).toBeGreaterThan(0);
  });

  it("keeps operational context collapsed by default when there is no attention signal", () => {
    render(
      <TooltipProvider>
        <PersonalDashboard
          actorUserId="user-1"
          widgets={DEFAULT_DASHBOARD_WIDGETS}
          staffRole="super_admin"
          activeLotIds={[]}
          workInbox={emptyWorkInbox}
          saleReadiness={{
            status: "empty",
            data: { rows: [], bidsPerMinute: 0, activeSaleroomSessions: 0 },
            message: "No upcoming sales.",
          }}
          recentActivity={buildRecentActivitySlice([])}
        />
      </TooltipProvider>,
    );

    expect(screen.queryByText("Saleroom pulse")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /saleroom and sale readiness/i }));
    expect(screen.getByText("Saleroom pulse")).toBeTruthy();
  });
});
