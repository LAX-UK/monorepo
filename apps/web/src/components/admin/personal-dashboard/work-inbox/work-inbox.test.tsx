// @vitest-environment jsdom
import type { AdminWorkItem } from "@/lib/data/http/admin-work-items.schema";
import { parseAdminWorkItem } from "@/lib/data/http/admin-work-items.schema";
import { StaffAccessProvider, StaffTooltipProvider } from "@auction/staff-ui";
import { render, screen, within } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/actions/admin/admin-work-item-actions", () => ({
  executeWorkItemActionAction: vi.fn(),
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));

const { WorkInbox } = await import("./work-inbox");

const HINT = "May belong to the unpaid payment PG-ABCDEF12. Check before acting.";

function unapplied(hint: string | null): AdminWorkItem {
  return {
    id: "payment_money_unapplied:customer_balance_unapplied:evt_1:gbp",
    kind: "payment_money_unapplied",
    domain: "finance",
    title: "Money received that could not be applied",
    subtitle: "Customer balance unapplied · £500.00",
    hint,
    href: "/admin/payments",
    saleId: null,
    createdAt: "2026-11-05T09:00:00.000Z",
    sourceUpdatedAt: "2026-11-05T09:00:00.000Z",
    dueAt: "2026-11-06T09:00:00.000Z",
    severity: "critical",
    assignedToUserId: null,
    actions: ["mark_handled"],
  };
}

function show(item: AdminWorkItem) {
  return render(
    <StaffTooltipProvider>
      <StaffAccessProvider access={{ can: () => true, roleLabel: "Finance" } as never}>
        <WorkInbox
          items={[item]}
          counts={{ total: 1, byDomain: { finance: 1 } }}
          areas={["finance"]}
          area="all"
          assignment="all"
          openItemId={item.id}
          actorUserId="u1"
        />
      </StaffAccessProvider>
    </StaffTooltipProvider>,
  );
}

describe("unapplied money in the work inbox", () => {
  it("shows the possible payment under Check first when the panel opens", () => {
    show(unapplied(HINT));
    const panel = screen.getByRole("dialog");
    expect(within(panel).getByText("Possible payment")).toBeInTheDocument();
    expect(within(panel).getByText(HINT)).toBeInTheDocument();
  });

  it("shows no Check first line when there is no suggestion", () => {
    show(unapplied(null));
    expect(screen.queryByText("Possible payment")).toBeNull();
  });
});

describe("parseAdminWorkItem", () => {
  it("keeps the hint, and reads a missing one as none", () => {
    const raw = { ...unapplied(HINT) };
    expect(parseAdminWorkItem(raw)?.hint).toBe(HINT);
    const { hint: _hint, ...without } = raw;
    expect(parseAdminWorkItem(without)?.hint).toBeNull();
  });
});
