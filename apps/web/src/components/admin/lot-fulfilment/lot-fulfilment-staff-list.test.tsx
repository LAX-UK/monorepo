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
    updatedAt: "2026-10-24T09:30:00.000Z",
    lotHref: `/admin/lots/${id}`,
    saleHref: null,
    saleTitle: null,
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
    expect(within(dialog).getByRole("link", { name: "Open lot" })).toHaveAttribute(
      "href",
      "/admin/lots/lot_b",
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark delivered" }));
    expect(screen.getAllByRole("dialog").length).toBeGreaterThan(1);
  });
});
