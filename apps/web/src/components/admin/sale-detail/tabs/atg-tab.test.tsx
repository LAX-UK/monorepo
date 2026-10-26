import { SaleAtgTab } from "@/components/admin/sale-detail/tabs/atg-tab";
import { notify } from "@/lib/ui/notify";
import { renderWithViewer } from "@/test/render-with-viewer";
import type { AtgLotSyncView, AtgSaleSyncView } from "@auction/types";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const adminAtgSaleActionResultAction = vi.fn();
const adminAtgJobStateAction = vi.fn();
const adminAtgSaleSettingsAction = vi.fn();

vi.mock("@/lib/actions/admin-atg", () => ({
  adminAtgSaleActionResultAction: (...args: unknown[]) => adminAtgSaleActionResultAction(...args),
  adminAtgJobStateAction: (...args: unknown[]) => adminAtgJobStateAction(...args),
  adminAtgSaleSettingsAction: (...args: unknown[]) => adminAtgSaleSettingsAction(...args),
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
    saleStatus: "draft",
    sellingPlatform: "free",
    saleCancelled: false,
    linked: false,
    atgAuctionId: null,
    remoteStatus: null,
    approvedAt: null,
    publishedAt: null,
    closedAt: null,
    lastSyncedAt: null,
    lastPolledAt: null,
    lastError: null,
    settings: { auctionType: "Timed", distribution: "private_test" },
    settingsUpdatedAt: null,
    results: [],
    lots: [lot()],
    ...overrides,
  };
}

function choose(option: string | RegExp) {
  fireEvent.click(screen.getByRole("radio", { name: option }));
}

async function flushEffects() {
  await act(async () => {});
}

describe("SaleAtgTab", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.mocked(notify.success).mockClear();
    refresh.mockReset();
    adminAtgSaleActionResultAction.mockReset();
    adminAtgJobStateAction.mockReset();
    adminAtgSaleSettingsAction.mockReset();
    adminAtgSaleSettingsAction.mockResolvedValue({
      ok: true,
      data: { settings: { auctionType: "Live", distribution: "private_test" }, pushJobId: null },
    });
    adminAtgSaleActionResultAction.mockResolvedValue({ ok: true, data: { jobId: "job-1" } });
    adminAtgJobStateAction.mockResolvedValue({ ok: true, data: { state: "active" } });
  });

  it("explains when sync is turned off, hides push, and still lets settings be edited", () => {
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
    expect(screen.getByRole("radio", { name: "Live" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.queryByText("Not ready to publish on ATG")).not.toBeInTheDocument();
  });

  it("lists readiness blockers from the sale view", () => {
    renderWithViewer(
      <SaleAtgTab
        saleId={SALE_ID}
        status={ENABLED}
        view={view({ lots: [lot({ lotNumber: null, title: "Garden study" })] })}
        canManage
      />,
    );
    expect(screen.getByText("Not ready to publish on ATG")).toBeInTheDocument();
    expect(screen.getByText("“Garden study” needs a lot number.")).toBeInTheDocument();
    // Shown in the Lot column on wide screens and under the title on narrow ones.
    expect(screen.getAllByText("No lot number").length).toBeGreaterThan(0);
  });

  it("leaves lot sync errors out of the readiness notice", () => {
    renderWithViewer(
      <SaleAtgTab
        saleId={SALE_ID}
        status={ENABLED}
        view={view({
          linked: true,
          remoteStatus: "created",
          lots: [lot({ atgLotId: "x1", lastError: "Image 2 is not a JPG" })],
        })}
        canManage
      />,
    );
    expect(screen.queryByText("Not ready to publish on ATG")).not.toBeInTheDocument();
    expect(screen.getByText("Image 2 is not a JPG")).toBeInTheDocument();
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

  it("disables ATG actions when lax.bid owns the sale", () => {
    renderWithViewer(
      <SaleAtgTab
        saleId={SALE_ID}
        status={ENABLED}
        view={view({ sellingPlatform: "lax", saleStatus: "scheduled" })}
        canManage
      />,
    );
    expect(screen.getByRole("heading", { name: "Published on lax.bid" })).toBeInTheDocument();
    expect(screen.getAllByText("Fixed: published on lax.bid.").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Push to ATG" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Publish on ATG" })).toBeDisabled();
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

  it("polls the job until done then refreshes", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    adminAtgJobStateAction
      .mockResolvedValueOnce({ ok: true, data: { state: "active" } })
      .mockResolvedValueOnce({ ok: true, data: { state: "done" } });

    renderWithViewer(<SaleAtgTab saleId={SALE_ID} status={ENABLED} view={view()} canManage />);

    fireEvent.click(screen.getByRole("button", { name: "Push to ATG" }));

    expect(await screen.findByText("Syncing with ATG…")).toBeInTheDocument();
    await flushEffects();
    await act(async () => {
      vi.advanceTimersByTime(3_500);
    });
    await waitFor(() => expect(adminAtgJobStateAction).toHaveBeenCalledWith("job-1"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText("Syncing with ATG…")).not.toBeInTheDocument());
  });

  it("stops polling after a minute and says so", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    adminAtgJobStateAction.mockResolvedValue({ ok: true, data: { state: "active" } });

    renderWithViewer(<SaleAtgTab saleId={SALE_ID} status={ENABLED} view={view()} canManage />);

    fireEvent.click(screen.getByRole("button", { name: "Push to ATG" }));
    await screen.findByText("Syncing with ATG…");
    await flushEffects();
    await act(async () => {
      vi.advanceTimersByTime(63_000);
    });

    expect(screen.getByText(/taking longer than usual/)).toBeInTheDocument();
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

  it("shows lot states, paddle column, and edit lot link on errors", () => {
    renderWithViewer(
      <SaleAtgTab
        saleId={SALE_ID}
        status={ENABLED}
        view={view({
          linked: true,
          atgAuctionId: "a",
          remoteStatus: "published",
          sellingPlatform: "atg",
          results: [
            {
              atgLotId: "x1",
              lotNumber: "1",
              lotStatus: null,
              numberOfBids: 1,
              paddleNumber: "42",
              hammerPrice: 1500,
              totalHammerPrice: null,
              endTimeUtc: null,
            },
          ],
          lots: [
            lot({
              lotId: "l1",
              atgLotId: "x1",
              remoteStatus: "4",
              sold: true,
              hammerPrice: "1500.00",
            }),
            lot({
              lotId: "l2",
              atgLotId: "x2",
              remoteStatus: "7",
              numberOfBids: 4,
              currentMaxBid: "200.00",
            }),
            lot({ lotId: "l3", atgLotId: "x3", lastError: "ATG updateLot failed with HTTP 400" }),
            lot({ lotId: "l4" }),
            lot({ lotId: "l5", atgLotId: "x5", sold: false }),
          ],
        })}
        canManage
      />,
    );

    expect(screen.getAllByText("Sold").length).toBeGreaterThan(0);
    expect(screen.getByText("4 bids")).toBeInTheDocument();
    expect(screen.getByText("Sync error")).toBeInTheDocument();
    expect(screen.getByText("ATG updateLot failed with HTTP 400")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit lot" })).toHaveAttribute(
      "href",
      "/admin/lots/l3/edit",
    );
    expect(screen.getByText("Not pushed")).toBeInTheDocument();
    expect(screen.queryByText("7")).not.toBeInTheDocument();
    expect(screen.getByText("1 of 4 lots")).toBeInTheDocument();
    expect(screen.getByText("Not sold")).toBeInTheDocument();
    expect(screen.queryByText("Unsold")).not.toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText(/1 lot needs fixing before/)).toBeInTheDocument();
  });

  it("hides the Result column when the status badge already says it for every lot", () => {
    renderWithViewer(
      <SaleAtgTab
        saleId={SALE_ID}
        status={ENABLED}
        view={view({
          linked: true,
          atgAuctionId: "a",
          remoteStatus: "published",
          sellingPlatform: "atg",
          lots: [lot({ lotId: "l1", atgLotId: "x1", remoteStatus: "4", sold: true })],
        })}
        canManage
      />,
    );
    expect(screen.queryByRole("columnheader", { name: "Result" })).not.toBeInTheDocument();
  });

  it("shows the Result column when a lot has a result the badge can't give", () => {
    renderWithViewer(
      <SaleAtgTab
        saleId={SALE_ID}
        status={ENABLED}
        view={view({
          linked: true,
          atgAuctionId: "a",
          remoteStatus: "published",
          sellingPlatform: "atg",
          lots: [lot({ lotId: "l5", atgLotId: "x5", sold: false })],
        })}
        canManage
      />,
    );
    expect(screen.getByRole("columnheader", { name: "Result" })).toBeInTheDocument();
  });

  it("says a pushed, unpublished auction is waiting for ATG approval", () => {
    renderWithViewer(
      <SaleAtgTab
        saleId={SALE_ID}
        status={ENABLED}
        view={view({ linked: true, atgAuctionId: "a", remoteStatus: "created" })}
        canManage
      />,
    );
    expect(screen.getByText("Awaiting ATG approval")).toBeInTheDocument();
    expect(screen.queryByText("Approved by ATG — ready to publish")).not.toBeInTheDocument();
  });

  it("says when ATG has approved the auction and it is ready to publish", () => {
    renderWithViewer(
      <SaleAtgTab
        saleId={SALE_ID}
        status={ENABLED}
        view={view({
          linked: true,
          atgAuctionId: "a",
          remoteStatus: "created",
          approvedAt: "2026-10-13T12:00:00.000Z",
        })}
        canManage
      />,
    );
    expect(screen.getByText("Approved by ATG — ready to publish")).toBeInTheDocument();
    expect(screen.queryByText("Awaiting ATG approval")).not.toBeInTheDocument();
  });

  describe("ATG settings", () => {
    it("saves a changed auction type without asking", async () => {
      renderWithViewer(<SaleAtgTab saleId={SALE_ID} status={ENABLED} view={view()} canManage />);

      expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
      choose("Live");
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() =>
        expect(adminAtgSaleSettingsAction).toHaveBeenCalledWith(
          SALE_ID,
          { auctionType: "Live", distribution: "private_test" },
          false,
        ),
      );
    });

    it("shows what each distribution choice means", () => {
      renderWithViewer(<SaleAtgTab saleId={SALE_ID} status={ENABLED} view={view()} canManage />);
      expect(screen.getByText("Hidden from public listings")).toBeInTheDocument();
      expect(screen.getByText("White Label and The Saleroom")).toBeInTheDocument();
    });

    it("asks for confirmation before listing a sale publicly", async () => {
      renderWithViewer(<SaleAtgTab saleId={SALE_ID} status={ENABLED} view={view()} canManage />);

      choose("Public");
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
      expect(adminAtgSaleSettingsAction).not.toHaveBeenCalled();
      fireEvent.click(
        within(await screen.findByRole("dialog")).getByRole("button", { name: "List publicly" }),
      );

      await waitFor(() =>
        expect(adminAtgSaleSettingsAction).toHaveBeenCalledWith(
          SALE_ID,
          { auctionType: "Timed", distribution: "public_marketplace" },
          true,
        ),
      );
      await waitFor(() =>
        expect(notify.success).toHaveBeenCalledWith("ATG settings saved", {
          description: "They apply when you push this sale to ATG.",
        }),
      );
    });

    it("says a linked sale's save goes to ATG", () => {
      renderWithViewer(
        <SaleAtgTab
          saleId={SALE_ID}
          status={ENABLED}
          view={view({ linked: true, atgAuctionId: "a", remoteStatus: "created" })}
          canManage
        />,
      );
      choose("Public");
      expect(screen.getByRole("button", { name: "Save and send to ATG" })).toBeEnabled();
    });

    it("locks the type once ATG has the auction and everything once published", () => {
      const { unmount } = renderWithViewer(
        <SaleAtgTab
          saleId={SALE_ID}
          status={ENABLED}
          view={view({ linked: true, atgAuctionId: "a", remoteStatus: "created" })}
          canManage
        />,
      );
      expect(screen.getByRole("textbox", { name: "Auction type" })).toHaveAttribute("readonly");
      expect(screen.getByRole("textbox", { name: "Auction type" })).toHaveValue("Timed");
      expect(screen.getByRole("radio", { name: "Public" })).toBeEnabled();
      expect(screen.getByText(/awaiting ATG approval/)).toBeInTheDocument();
      unmount();

      renderWithViewer(
        <SaleAtgTab
          saleId={SALE_ID}
          status={ENABLED}
          view={view({ linked: true, atgAuctionId: "a", remoteStatus: "published" })}
          canManage
        />,
      );
      expect(screen.queryByRole("radio")).not.toBeInTheDocument();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(
        screen.getByText("Fixed: the auction is already published on ATG."),
      ).toBeInTheDocument();
      expect(screen.getByText("Fixed: ATG already has this auction.")).toBeInTheDocument();
    });

    it("is read-only without manage rights", () => {
      renderWithViewer(
        <SaleAtgTab saleId={SALE_ID} status={ENABLED} view={view()} canManage={false} />,
      );
      expect(screen.queryByRole("radio")).not.toBeInTheDocument();
      expect(screen.getByText("Private test")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    });
  });
});
