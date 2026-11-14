import type { ManualReviewStaffRow } from "@/lib/admin/finance/payments-staff-list.vm";
import { queuePanel } from "@/test/queue-panel";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ManualReviewStaffList, type ManualReviewStaffListProps } from "./manual-review-staff-list";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/payments",
  useSearchParams: () => new URLSearchParams(),
}));

const row: ManualReviewStaffRow = {
  id: "pay_1",
  lotId: "lot_1",
  lotTitle: "Golden Hour",
  lotNumber: 12,
  winnerId: "user_1",
  winner: "ada@example.test",
  seller: "Gallery One",
  amount: "£4,140.00",
  reason: "High value",
  compliance: false,
  source: {
    amount: "4140.00",
    createdAt: "2026-10-20T10:00:00.000Z",
  } as ManualReviewStaffRow["source"],
};

function hold(id: string, lotTitle: string, amount: string): ManualReviewStaffRow {
  return {
    ...row,
    id,
    lotId: `lot_${id}`,
    lotTitle,
    amount: `£${amount}`,
    source: { ...row.source, amount, paymentId: id },
  };
}

// Shown largest amount first, the queue's order.
const queueRows = [
  hold("pay_a", "Small study", "100.00"),
  hold("pay_b", "Large canvas", "9000.00"),
  hold("pay_c", "Mid print", "500.00"),
];

function renderList(
  access: { canOpenLot: boolean; canOpenClient: boolean },
  overrides: Partial<ManualReviewStaffListProps> = {},
) {
  const props: ManualReviewStaffListProps = {
    search: { manualReview: "1" },
    rows: [row],
    queueSize: 1,
    reasonFilter: "",
    summary: { total: 1, financeHolds: 1, complianceHolds: 0 },
    attentionCounts: { manualReviewCount: 1, disputesOpen: 0 },
    canOpenComplianceQueues: false,
    canResolveManualReview: true,
    loadError: null,
    ...access,
    ...overrides,
  };
  return render(
    <StaffTooltipProvider>
      <ManualReviewStaffList {...props} />
    </StaffTooltipProvider>,
  );
}

describe("ManualReviewStaffList links", () => {
  it("links each hold to its own address and keeps the lot and winner links to people who may open them", () => {
    renderList({ canOpenLot: true, canOpenClient: true });
    expect(screen.getAllByRole("link", { name: "Golden Hour" })[0]).toHaveAttribute(
      "href",
      "/admin/payments?manualReview=1&payment=pay_1",
    );
    expect(screen.getAllByRole("link", { name: "ada@example.test" })[0]).toHaveAttribute(
      "href",
      "/admin/clients/user_1",
    );
    fireEvent.click(screen.getAllByText("Golden Hour")[0] as HTMLElement);
    expect(
      within(screen.getByRole("dialog")).queryByRole("link", { name: "Open lot" }),
    ).not.toBeInTheDocument();
    expect(queuePanel.openMenu().getByRole("menuitem", { name: "Open lot" })).toHaveAttribute(
      "href",
      "/admin/lots/lot_1",
    );
  });

  it("shows the winner as plain text and offers no lot link to a finance-only person", async () => {
    renderList({ canOpenLot: false, canOpenClient: false });
    expect(screen.getAllByText("ada@example.test").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "ada@example.test" })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByText("Golden Hour")[0] as HTMLElement);
    expect(queuePanel.openMenu().queryByRole("menuitem", { name: "Open lot" })).toBeNull();
  });
});

describe("ManualReviewStaffList queue panel", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/admin/payments?manualReview=1");
  });
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  const panel = () => screen.queryByRole("dialog");
  const position = () =>
    document.querySelector("[data-staff-queue-position]")?.textContent?.replace(/\s+/g, " ");

  it("opens a hold into the URL, shows its place and steps with J and K in the order shown", () => {
    renderList({ canOpenLot: true, canOpenClient: true }, { rows: queueRows, queueSize: 3 });
    fireEvent.click(screen.getAllByText("Mid print")[0] as HTMLElement);
    expect(window.location.search).toBe("?manualReview=1&payment=pay_c");
    expect(
      within(panel() as HTMLElement).getByRole("heading", { name: "Mid print" }),
    ).toBeVisible();
    expect(position()).toMatch(/^2 of 3/);

    fireEvent.keyDown(panel() as HTMLElement, { key: "j" });
    expect(
      within(panel() as HTMLElement).getByRole("heading", { name: "Small study" }),
    ).toBeVisible();
    expect(window.location.search).toBe("?manualReview=1&payment=pay_a");
    expect(position()).toMatch(/^3 of 3/);

    fireEvent.keyDown(panel() as HTMLElement, { key: "k" });
    fireEvent.keyDown(panel() as HTMLElement, { key: "k" });
    expect(
      within(panel() as HTMLElement).getByRole("heading", { name: "Large canvas" }),
    ).toBeVisible();
    expect(position()).toMatch(/^1 of 3/);
  });

  it("reopens the hold from its address, even when the reason filter leaves it out", () => {
    window.history.replaceState(null, "", "/admin/payments?manualReview=1&payment=pay_z");
    const offFilter = hold("pay_z", "Filtered out", "75.00");
    renderList(
      { canOpenLot: true, canOpenClient: true },
      {
        search: { manualReview: "1", payment: "pay_z" },
        rows: queueRows,
        selected: offFilter,
      },
    );
    expect(
      within(panel() as HTMLElement).getByRole("heading", { name: "Filtered out" }),
    ).toBeVisible();
  });

  it("closes on Back and returns focus to the hold's row on Escape", async () => {
    renderList({ canOpenLot: true, canOpenClient: true }, { rows: queueRows });
    fireEvent.click(screen.getAllByText("Large canvas")[0] as HTMLElement);
    expect(panel()).toBeInTheDocument();
    act(() => window.history.back());
    await waitFor(() => expect(panel()).not.toBeInTheDocument());
    expect(window.location.search).toBe("?manualReview=1");

    fireEvent.click(screen.getAllByText("Large canvas")[0] as HTMLElement);
    fireEvent.keyDown(panel() as HTMLElement, { key: "j" });
    fireEvent.keyDown(panel() as HTMLElement, { key: "Escape" });
    await waitFor(() => expect(panel()).not.toBeInTheDocument());
    await waitFor(() =>
      expect(document.activeElement?.closest("tr")?.textContent).toContain("Mid print"),
    );
  });

  it("keeps refund and release, with their confirmations, to people who may resolve holds", () => {
    renderList({ canOpenLot: true, canOpenClient: true }, { rows: queueRows });
    fireEvent.click(screen.getAllByText("Large canvas")[0] as HTMLElement);
    const dialog = panel() as HTMLElement;
    fireEvent.click(within(dialog).getByRole("button", { name: "Refund £9000.00" }));
    expect(
      screen.getByRole("heading", { name: "Refund £9000.00 to ada@example.test?" }),
    ).toBeInTheDocument();
  });

  it("offers no money actions in the panel to someone who cannot resolve holds", () => {
    renderList(
      { canOpenLot: true, canOpenClient: true },
      { rows: queueRows, canResolveManualReview: false },
    );
    fireEvent.click(screen.getAllByText("Large canvas")[0] as HTMLElement);
    const dialog = panel() as HTMLElement;
    expect(within(dialog).queryByRole("button", { name: /Refund/ })).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Release for checkout" }),
    ).not.toBeInTheDocument();
  });
});
