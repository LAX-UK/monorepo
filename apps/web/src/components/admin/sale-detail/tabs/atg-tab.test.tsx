import { SaleAtgTab } from "@/components/admin/sale-detail/tabs/atg-tab";
import { renderWithViewer } from "@/test/render-with-viewer";
import type { AtgLotSyncView, AtgSaleSyncView } from "@auction/types";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const adminAtgSaleActionResultAction = vi.fn();

vi.mock("@/lib/actions/admin-atg", () => ({
  adminAtgSaleActionResultAction: (...args: unknown[]) => adminAtgSaleActionResultAction(...args),
}));

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const SALE_ID = "11111111-1111-4111-8111-111111111111";
const ENABLED = { enabled: true, whiteLabelBaseUrl: "https://wl.example" };

function lot(overrides: Partial<AtgLotSyncView> = {}): AtgLotSyncView {
  return {
    lotId: "lot-1",
    lotNumber: 1,
    title: "Untitled",
    atgLotId: null,
    imageCount: 0,
    lastSyncedAt: null,
    lastError: null,
    remoteStatus: null,
    sold: null,
    hammerPrice: null,
    currentMaxBid: null,
    numberOfBids: null,
    lastPolledAt: null,
    ...overrides,
  };
}

function view(overrides: Partial<AtgSaleSyncView> = {}): AtgSaleSyncView {
  return {
    saleId: SALE_ID,
    saleCancelled: false,
    linked: false,
    atgAuctionId: null,
    remoteStatus: null,
    publishedAt: null,
    closedAt: null,
    lastSyncedAt: null,
    lastPolledAt: null,
    lastError: null,
    results: [],
    lots: [lot()],
    ...overrides,
  };
}

/** The polling interval starts in a passive effect, which may commit after the text renders. */
async function flushEffects() {
  await act(async () => {});
}

describe("SaleAtgTab", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    refresh.mockReset();
    adminAtgSaleActionResultAction.mockReset();
    adminAtgSaleActionResultAction.mockResolvedValue({ ok: true, data: { jobId: "j" } });
  });

  it("explains when sync is turned off and offers no actions", () => {
    renderWithViewer(
      <SaleAtgTab
        saleId={SALE_ID}
        status={{ enabled: false, whiteLabelBaseUrl: null }}
        view={view()}
        canManage
      />,
    );
    expect(screen.getByText("ATG sync is turned off")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /push/i })).not.toBeInTheDocument();
  });

  it("queues a push straight away", async () => {
    renderWithViewer(<SaleAtgTab saleId={SALE_ID} status={ENABLED} view={view()} canManage />);

    fireEvent.click(screen.getByRole("button", { name: "Push to ATG" }));

    await waitFor(() =>
      expect(adminAtgSaleActionResultAction).toHaveBeenCalledWith(SALE_ID, "push"),
    );
  });

  it("asks for confirmation before publishing", async () => {
    renderWithViewer(<SaleAtgTab saleId={SALE_ID} status={ENABLED} view={view()} canManage />);

    fireEvent.click(screen.getByRole("button", { name: "Publish on ATG" }));
    expect(adminAtgSaleActionResultAction).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Publish" }));

    await waitFor(() =>
      expect(adminAtgSaleActionResultAction).toHaveBeenCalledWith(SALE_ID, "publish"),
    );
  });

  it("disables close until the sale is on ATG and everything once closed", () => {
    const { unmount } = renderWithViewer(
      <SaleAtgTab saleId={SALE_ID} status={ENABLED} view={view()} canManage />,
    );
    expect(screen.getByRole("button", { name: "Close on ATG" })).toBeDisabled();
    unmount();

    renderWithViewer(
      <SaleAtgTab
        saleId={SALE_ID}
        status={ENABLED}
        view={view({ linked: true, atgAuctionId: "atg-a", remoteStatus: "closed" })}
        canManage
      />,
    );
    expect(screen.getByRole("button", { name: "Push changes to ATG" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Publish on ATG" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close on ATG" })).toBeDisabled();
  });

  it("surfaces the last sync error", () => {
    renderWithViewer(
      <SaleAtgTab
        saleId={SALE_ID}
        status={ENABLED}
        view={view({ linked: true, remoteStatus: "created", lastError: "Lot 3: Title required" })}
        canManage
      />,
    );
    expect(screen.getByText("Lot 3: Title required")).toBeInTheDocument();
  });

  it("keeps refreshing after an action until the worker result arrives", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    const initial = view();
    const { rerender } = renderWithViewer(
      <SaleAtgTab saleId={SALE_ID} status={ENABLED} view={initial} canManage />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Push to ATG" }));

    expect(await screen.findByText("Syncing with ATG…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Push to ATG" })).toBeDisabled();
    await flushEffects();
    refresh.mockClear();
    await act(async () => {
      vi.advanceTimersByTime(6_000);
    });
    expect(refresh).toHaveBeenCalledTimes(2);

    rerender(
      <SaleAtgTab
        saleId={SALE_ID}
        status={ENABLED}
        view={view({
          linked: true,
          atgAuctionId: "a",
          remoteStatus: "created",
          lastSyncedAt: "2026-10-13T12:00:00.000Z",
        })}
        canManage
      />,
    );
    await waitFor(() => expect(screen.queryByText("Syncing with ATG…")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Push changes to ATG" })).toBeEnabled();
  });

  it("stops refreshing after a minute and says so", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    renderWithViewer(<SaleAtgTab saleId={SALE_ID} status={ENABLED} view={view()} canManage />);

    fireEvent.click(screen.getByRole("button", { name: "Push to ATG" }));
    await screen.findByText("Syncing with ATG…");
    await flushEffects();
    await act(async () => {
      vi.advanceTimersByTime(63_000);
    });

    expect(screen.getByText(/taking longer than usual/)).toBeInTheDocument();
    refresh.mockClear();
    await act(async () => {
      vi.advanceTimersByTime(9_000);
    });
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Push to ATG" })).toBeEnabled();
  });

  it("blocks push and publish for cancelled sales but still allows closing on ATG", () => {
    renderWithViewer(
      <SaleAtgTab
        saleId={SALE_ID}
        status={ENABLED}
        view={view({
          saleCancelled: true,
          linked: true,
          atgAuctionId: "a",
          remoteStatus: "published",
        })}
        canManage
      />,
    );

    expect(screen.getByText("Sale cancelled")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Push changes to ATG" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Published" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close on ATG" })).toBeEnabled();
    expect(screen.getByText(/Close the ATG auction if it is still open/)).toBeInTheDocument();
  });

  it("shows lot states in words, never GAP status codes, and sums results once live", () => {
    renderWithViewer(
      <SaleAtgTab
        saleId={SALE_ID}
        status={ENABLED}
        view={view({
          linked: true,
          atgAuctionId: "a",
          remoteStatus: "published",
          lots: [
            lot({
              lotId: "l1",
              atgLotId: "x1",
              remoteStatus: "7",
              sold: true,
              hammerPrice: "1500.00",
            }),
            lot({
              lotId: "l2",
              atgLotId: "x2",
              remoteStatus: "3",
              numberOfBids: 4,
              currentMaxBid: "200.00",
            }),
            lot({ lotId: "l3", atgLotId: "x3", lastError: "ATG updateLot failed with HTTP 400" }),
            lot({ lotId: "l4" }),
          ],
        })}
        canManage
      />,
    );

    expect(screen.getByText("Sold")).toBeInTheDocument();
    expect(screen.getByText("4 bids")).toBeInTheDocument();
    expect(screen.getByText("Sync error")).toBeInTheDocument();
    expect(screen.getByText("ATG updateLot failed with HTTP 400")).toBeInTheDocument();
    expect(screen.getByText("Not pushed")).toBeInTheDocument();
    expect(screen.queryByText("7")).not.toBeInTheDocument();
    expect(screen.getByText("1 of 3 lots")).toBeInTheDocument();
    expect(screen.getAllByText("£1,500.00").length).toBeGreaterThan(0);
  });
});
