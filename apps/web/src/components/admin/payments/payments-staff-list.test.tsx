import type { PaymentsStaffRow } from "@/lib/admin/finance/payments-staff-list.vm";
import { queuePanel } from "@/test/queue-panel";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentsStaffList, type PaymentsStaffListProps } from "./payments-staff-list";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/payments",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/exports/export-jobs-provider", () => ({
  useExportJobs: () => ({ startExport: vi.fn(), jobs: [] }),
}));

const row: PaymentsStaffRow = {
  id: "pay_1",
  lotId: "lot_1",
  lotTitle: "Golden Hour",
  lotContext: "Lot 12 · Autumn sale",
  buyerId: "user_1",
  buyer: "Ada Lovelace",
  sellerId: "seller_1",
  amount: "£4,140.00",
  amountPence: 414_000,
  platformFee: "£414.00",
  status: "captured",
  statusPresentation: { label: "Captured", tone: "success" },
  fulfilment: null,
  createdAt: "2026-10-20T10:00:00.000Z",
  xero: { invoiceNumber: null, invoiceUrl: null, syncStatus: null, lastError: null },
  canCapture: false,
  canRefund: true,
};

function payment(id: string, lotTitle: string, createdAt: string): PaymentsStaffRow {
  return { ...row, id, lotId: `lot_${id}`, lotTitle, createdAt };
}

// Shown newest first, the list's order.
const queueRows = [
  payment("pay_a", "Oldest", "2026-10-01T10:00:00.000Z"),
  payment("pay_b", "Newest", "2026-10-30T10:00:00.000Z"),
  payment("pay_c", "Middle", "2026-10-15T10:00:00.000Z"),
];

function renderList(
  access: { canOpenLot: boolean; canOpenClient: boolean },
  overrides: Partial<PaymentsStaffListProps> = {},
) {
  const props: PaymentsStaffListProps = {
    search: {},
    view: "all",
    rows: [row],
    summary: { totalVolume: 4140, captured: 4140, pending: 0, refunded: 0 },
    attentionCounts: { manualReviewCount: 0, disputesOpen: 0 },
    canWritePayments: true,
    exportFilters: {},
    pageSize: 50,
    pagination: null,
    loadError: null,
    ...access,
    ...overrides,
  };
  return render(
    <StaffTooltipProvider>
      <PaymentsStaffList {...props} />
    </StaffTooltipProvider>,
  );
}

describe("PaymentsStaffList links", () => {
  it("links each payment to its own address and the lot and buyer for people who may open them", () => {
    renderList({ canOpenLot: true, canOpenClient: true });
    expect(screen.getAllByRole("link", { name: "Golden Hour" })[0]).toHaveAttribute(
      "href",
      "/admin/payments?payment=pay_1",
    );
    expect(screen.getAllByRole("link", { name: "Ada Lovelace" })[0]).toHaveAttribute(
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

  it("shows the buyer as plain text and no lot link for a finance-only person", () => {
    renderList({ canOpenLot: false, canOpenClient: false });
    expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Ada Lovelace" })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByText("Golden Hour")[0] as HTMLElement);
    expect(queuePanel.openMenu().queryByRole("menuitem", { name: "Open lot" })).toBeNull();
  });
});

describe("PaymentsStaffList queue panel", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/admin/payments");
  });
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  const panel = () => screen.queryByRole("dialog");
  const position = () =>
    document.querySelector("[data-staff-queue-position]")?.textContent?.replace(/\s+/g, " ");

  it("opens a payment into the URL and steps with J and K in the order shown", () => {
    renderList({ canOpenLot: true, canOpenClient: true }, { rows: queueRows });
    fireEvent.click(screen.getAllByText("Middle")[0] as HTMLElement);
    expect(window.location.search).toBe("?payment=pay_c");
    expect(position()).toMatch(/^2 of 3/);
    fireEvent.keyDown(panel() as HTMLElement, { key: "j" });
    expect(within(panel() as HTMLElement).getByRole("heading", { name: "Oldest" })).toBeVisible();
    expect(window.location.search).toBe("?payment=pay_a");
    fireEvent.keyDown(panel() as HTMLElement, { key: "k" });
    fireEvent.keyDown(panel() as HTMLElement, { key: "k" });
    expect(within(panel() as HTMLElement).getByRole("heading", { name: "Newest" })).toBeVisible();
    expect(position()).toMatch(/^1 of 3/);
  });

  it("reopens the payment from its address", () => {
    window.history.replaceState(null, "", "/admin/payments?payment=pay_c");
    renderList(
      { canOpenLot: true, canOpenClient: true },
      { rows: queueRows, search: { payment: "pay_c" } },
    );
    expect(within(panel() as HTMLElement).getByRole("heading", { name: "Middle" })).toBeVisible();
  });

  it("closes on Back and returns focus to the row last shown on Escape", async () => {
    renderList({ canOpenLot: true, canOpenClient: true }, { rows: queueRows });
    fireEvent.click(screen.getAllByText("Newest")[0] as HTMLElement);
    act(() => window.history.back());
    await waitFor(() => expect(panel()).not.toBeInTheDocument());
    expect(window.location.search).toBe("");

    fireEvent.click(screen.getAllByText("Newest")[0] as HTMLElement);
    fireEvent.keyDown(panel() as HTMLElement, { key: "j" });
    fireEvent.keyDown(panel() as HTMLElement, { key: "Escape" });
    await waitFor(() => expect(panel()).not.toBeInTheDocument());
    await waitFor(() =>
      expect(document.activeElement?.closest("tr")?.textContent).toContain("Middle"),
    );
  });

  it("keeps refund, through its confirmation, to people who may write payments", () => {
    renderList({ canOpenLot: true, canOpenClient: true }, { rows: queueRows });
    fireEvent.click(screen.getAllByText("Newest")[0] as HTMLElement);
    fireEvent.click(
      within(panel() as HTMLElement).getByRole("button", { name: "Refund £4,140.00" }),
    );
    expect(
      screen.getByRole("heading", { name: "Refund £4,140.00 to Ada Lovelace?" }),
    ).toBeInTheDocument();
  });

  it("offers no money actions in the panel to a read-only person", () => {
    renderList(
      { canOpenLot: true, canOpenClient: true },
      { rows: queueRows, canWritePayments: false },
    );
    fireEvent.click(screen.getAllByText("Newest")[0] as HTMLElement);
    expect(
      within(panel() as HTMLElement).queryByRole("button", { name: /Refund|Capture/ }),
    ).not.toBeInTheDocument();
  });
});
