import { SaleAtgTab } from "@/components/admin/sale-detail/tabs/atg-tab";
import { renderWithViewer } from "@/test/render-with-viewer";
import type { AtgSaleSyncView } from "@auction/types";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const adminAtgSaleActionResultAction = vi.fn();

vi.mock("@/lib/actions/admin-atg", () => ({
  adminAtgSaleActionResultAction: (...args: unknown[]) => adminAtgSaleActionResultAction(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const SALE_ID = "11111111-1111-4111-8111-111111111111";
const ENABLED = { enabled: true, whiteLabelBaseUrl: "https://wl.example" };

function view(overrides: Partial<AtgSaleSyncView> = {}): AtgSaleSyncView {
  return {
    saleId: SALE_ID,
    linked: false,
    atgAuctionId: null,
    remoteStatus: null,
    publishedAt: null,
    closedAt: null,
    lastSyncedAt: null,
    lastPolledAt: null,
    lastError: null,
    results: [],
    lots: [
      {
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
      },
    ],
    ...overrides,
  };
}

describe("SaleAtgTab", () => {
  beforeEach(() => {
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
});
