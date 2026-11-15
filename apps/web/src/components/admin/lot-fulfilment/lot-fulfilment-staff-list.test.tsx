import type { LotFulfilmentStaffRow } from "@/lib/admin/lot-fulfilment-staff-list.vm";
import { queuePanel } from "@/test/queue-panel";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LotFulfilmentStaffList,
  type LotFulfilmentStaffListProps,
} from "./lot-fulfilment-staff-list";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/lot-fulfilment",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/actions/admin", () => ({
  adminLotFulfilmentShipResultAction: vi.fn(),
  adminLotFulfilmentDeliveredResultAction: vi.fn(),
  adminLotFulfilmentReleaseResultAction: vi.fn(),
  adminLotFulfilmentReadyForCollectionResultAction: vi.fn(),
  adminLotFulfilmentCollectedResultAction: vi.fn(),
  adminRefundGroupDeliveryResultAction: vi.fn(),
}));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));

function lot(id: string, title: string, step: string): LotFulfilmentStaffRow {
  return {
    id,
    title,
    context: "Lot 12 · Autumn sale",
    step,
    status: { label: step, tone: "info" },
    method: "Shipping",
    shipping: null,
    collection: null,
    updatedAt: "2026-10-24T09:30:00.000Z",
    lotHref: `/admin/lots/${id}`,
    saleHref: null,
    saleTitle: null,
    courierPaid: [],
  };
}

// The server's order (most recently changed first).
const rows = [
  lot("lot_a", "Blue Interior", "awaiting_release"),
  lot("lot_b", "Red Studio", "in_transit"),
  lot("lot_c", "Green Field", "released"),
];

function renderList(overrides: Partial<LotFulfilmentStaffListProps> = {}) {
  const props: LotFulfilmentStaffListProps = {
    rows,
    search: {},
    counts: {},
    filterChips: [],
    pageSize: 50,
    pagination: null,
    loadError: null,
    filtered: false,
    ...overrides,
  };
  return render(
    <StaffTooltipProvider>
      <LotFulfilmentStaffList {...props} />
    </StaffTooltipProvider>,
  );
}

describe("LotFulfilmentStaffList queue panel", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/admin/lot-fulfilment?status=released");
  });
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("opens a lot into the URL, keeps the view, and steps with J and K", () => {
    renderList({ search: { status: "released" } });
    fireEvent.click(screen.getAllByText("Red Studio")[0] as HTMLElement);
    expect(window.location.search).toBe("?status=released&lot=lot_b");
    expect(queuePanel.position()).toBe("2 of 3");
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "j" });
    expect(queuePanel.title("Green Field")).toBeVisible();
    expect(window.location.search).toBe("?status=released&lot=lot_c");
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "k" });
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "k" });
    expect(queuePanel.title("Blue Interior")).toBeVisible();
  });

  it("marks a courier charge paid with the invoice on the row and in the panel", () => {
    const paidRow = {
      ...lot("lot_c", "Green Field", "released"),
      courierPaid: [
        {
          paymentGroupId: "5d2f7c1a-9e3b-4f60-8a1d-3b7c9e2f4a61",
          deliveryQuoteId: "8c4e2a17-3f5b-4d9e-b1a6-7e2c9f3d5b80",
          label: "Paid with invoice · £180.00",
          remainingPence: 18000,
          remainingLabel: "£180.00",
        },
      ],
    };
    window.history.replaceState(null, "", "/admin/lot-fulfilment?lot=lot_c");
    renderList({ rows: [rows[0] as LotFulfilmentStaffRow, paidRow], search: { lot: "lot_c" } });
    expect(screen.getAllByText("Courier paid with invoice").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Paid with invoice · £180.00").length).toBeGreaterThan(0);
    expect(screen.getByText(/Do not take a separate courier payment/)).toBeVisible();
  });

  it("reopens the lot from its address", () => {
    window.history.replaceState(null, "", "/admin/lot-fulfilment?lot=lot_c");
    renderList({ search: { lot: "lot_c" } });
    expect(queuePanel.title("Green Field")).toBeVisible();
  });

  it("closes on Back and returns focus to the lot last shown on Escape", async () => {
    renderList({ search: { status: "released" } });
    fireEvent.click(screen.getAllByText("Blue Interior")[0] as HTMLElement);
    act(() => window.history.back());
    await waitFor(() => expect(queuePanel.get()).not.toBeInTheDocument());
    expect(window.location.search).toBe("?status=released");

    fireEvent.click(screen.getAllByText("Blue Interior")[0] as HTMLElement);
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "j" });
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "Escape" });
    await waitFor(() => expect(queuePanel.get()).not.toBeInTheDocument());
    await waitFor(() => expect(queuePanel.focusedRowText()).toContain("Red Studio"));
  });

  it("keeps the next step as the main button, still asking before it runs", () => {
    renderList();
    fireEvent.click(screen.getAllByText("Red Studio")[0] as HTMLElement);
    const dialog = queuePanel.get() as HTMLElement;
    expect(within(dialog).queryByRole("link", { name: "Open lot" })).not.toBeInTheDocument();
    expect(queuePanel.openMenu().getByRole("menuitem", { name: "Open lot" })).toHaveAttribute(
      "href",
      "/admin/lots/lot_b",
    );
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark delivered" }));
    expect(screen.getAllByRole("dialog").length).toBeGreaterThan(1);
  });
});

describe("LotFulfilmentStaffList collection column", () => {
  it("shows the booked visit, Not booked, and nothing for a lot that ships", () => {
    renderList({
      rows: [
        {
          ...lot("lot_a", "Blue Interior", "released"),
          method: "Collection",
          collection: "Thu 12 Nov, 14:00–14:30 GMT",
        },
        { ...lot("lot_b", "Red Studio", "released"), method: "Collection" },
        lot("lot_c", "Green Field", "released"),
      ],
    });
    expect(screen.getByRole("columnheader", { name: /Collection/ })).toBeTruthy();
    expect(screen.getByText("Thu 12 Nov, 14:00–14:30 GMT")).toBeTruthy();
    expect(screen.getAllByText("Not booked")).toHaveLength(1);
  });
});
