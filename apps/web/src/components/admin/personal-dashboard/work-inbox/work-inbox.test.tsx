// @vitest-environment jsdom
import type { AdminWorkItem } from "@/lib/data/http/admin-work-items.schema";
import { parseAdminWorkItem } from "@/lib/data/http/admin-work-items.schema";
import { queuePanel } from "@/test/queue-panel";
import { StaffAccessProvider, StaffTooltipProvider } from "@auction/staff-ui";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

function task(id: string, title: string, dueAt: string, actions: AdminWorkItem["actions"] = []) {
  return {
    ...unapplied(null),
    id,
    title,
    subtitle: null,
    href: `/admin/disputes/${id}`,
    dueAt,
    actions,
  } satisfies AdminWorkItem;
}

// Shown soonest due first, the queue's order.
const queueItems = [
  task("w_b", "Second due", "2026-11-07T09:00:00.000Z"),
  task("w_c", "Last due", "2026-11-09T09:00:00.000Z"),
  task("w_a", "First due", "2026-11-06T09:00:00.000Z", ["mark_handled"]),
];

function showQueue(openItemId: string | null = null) {
  return render(
    <StaffTooltipProvider>
      <StaffAccessProvider access={{ can: () => true, roleLabel: "Finance" } as never}>
        <WorkInbox
          items={queueItems}
          counts={{ total: 3, byDomain: { finance: 3 } }}
          areas={["finance"]}
          area="all"
          assignment="all"
          openItemId={openItemId}
          actorUserId="u1"
        />
      </StaffAccessProvider>
    </StaffTooltipProvider>,
  );
}

describe("work inbox queue panel", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/admin");
  });
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("links each item to its own page and opens the panel in place", () => {
    showQueue();
    expect(screen.getAllByRole("link", { name: "Second due" })[0]).toHaveAttribute(
      "href",
      "/admin/disputes/w_b",
    );
    fireEvent.click(screen.getAllByText("Second due")[0] as HTMLElement);
    expect(window.location.search).toBe("?item=w_b");
    expect(
      within(queuePanel.get() as HTMLElement).getByRole("link", { name: "Open full page" }),
    ).toHaveAttribute("href", "/admin/disputes/w_b");
  });

  it("shows its place and steps with J and K in the order shown", () => {
    showQueue();
    fireEvent.click(screen.getAllByText("Second due")[0] as HTMLElement);
    expect(queuePanel.position()).toBe("2 of 3");
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "j" });
    expect(queuePanel.title("Last due")).toBeVisible();
    expect(window.location.search).toBe("?item=w_c");
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "k" });
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "k" });
    expect(queuePanel.title("First due")).toBeVisible();
    expect(queuePanel.position()).toBe("1 of 3");
  });

  it("reopens the item from its address", () => {
    window.history.replaceState(null, "", "/admin?item=w_c");
    showQueue("w_c");
    expect(queuePanel.title("Last due")).toBeVisible();
  });

  it("closes on Back and returns focus to the item last shown on Escape", async () => {
    showQueue();
    fireEvent.click(screen.getAllByText("First due")[0] as HTMLElement);
    act(() => window.history.back());
    await waitFor(() => expect(queuePanel.get()).not.toBeInTheDocument());
    expect(window.location.search).toBe("");

    fireEvent.click(screen.getAllByText("First due")[0] as HTMLElement);
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "j" });
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "Escape" });
    await waitFor(() => expect(queuePanel.get()).not.toBeInTheDocument());
    await waitFor(() => expect(queuePanel.focusedRowText()).toContain("Second due"));
  });

  it("offers the item's own work actions, and no second link to the record page when it has none", () => {
    showQueue();
    fireEvent.click(screen.getAllByText("First due")[0] as HTMLElement);
    expect(
      within(queuePanel.get() as HTMLElement).getByRole("button", { name: "Mark handled" }),
    ).toBeVisible();
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "j" });
    const panel = queuePanel.get() as HTMLElement;
    expect(within(panel).queryByRole("button", { name: "Mark handled" })).toBeNull();
    expect(within(panel).queryByRole("link", { name: "Open record" })).toBeNull();
    expect(within(panel).getByRole("link", { name: "Open full page" })).toBeVisible();
  });
});
