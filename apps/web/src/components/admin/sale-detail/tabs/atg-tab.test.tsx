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
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
  recentReauthAttempt: () => false,
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

async function flushEffects() {
  await act(async () => {});
}

/** Starts an action from the page and confirms it in the dialog that asks first. */
async function runAction(pageButton: string, confirmButton: string) {
  fireEvent.click(screen.getByRole("button", { name: pageButton }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: confirmButton }));
}

function choose(option: string | RegExp) {
  fireEvent.click(screen.getByRole("radio", { name: option }));
}

function expectBlocked(name: string) {
  expect(screen.getByRole("button", { name })).toHaveAttribute("aria-disabled", "true");
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
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
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
    expect(screen.getAllByText("No lot number").length).toBeGreaterThan(0);
  });

  it("leaves lot sync errors to the page-level notice", () => {
    renderWithViewer(
      <SaleAtgTab
        saleId={SALE_ID}
        status={ENABLED}
        view={view({
          linked: true,
          remoteStatus: "created",
          lastError: "Lot 1: image 2 is not a JPG",
          lots: [lot({ atgLotId: "x1", lastError: "Image 2 is not a JPG" })],
        })}
        canManage
      />,
    );
    expect(screen.getByText("The last sync reported a problem")).toBeInTheDocument();
    expect(screen.queryByText("Not ready to publish on ATG")).not.toBeInTheDocument();
    expect(screen.getAllByText("Lot 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Image 2 is not a JPG").length).toBeGreaterThan(0);
  });

  it("asks before pushing, then queues it", async () => {
    renderWithViewer(<SaleAtgTab saleId={SALE_ID} status={ENABLED} view={view()} canManage />);

    fireEvent.click(screen.getByRole("button", { name: "Push to ATG" }));
    expect(adminAtgSaleActionResultAction).not.toHaveBeenCalled();
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Push to ATG" }),
    );

    await waitFor(() =>
      expect(adminAtgSaleActionResultAction).toHaveBeenCalledWith(SALE_ID, "push"),
    );
  });

  it("keeps a refused action in the dialog instead of toasting it", async () => {
    adminAtgSaleActionResultAction.mockResolvedValue({
      ok: false,
      error: "This sale is published on lax.bid.",
    });
    renderWithViewer(<SaleAtgTab saleId={SALE_ID} status={ENABLED} view={view()} canManage />);

    await runAction("Push to ATG", "Push to ATG");

    expect(await screen.findByText("This sale is published on lax.bid.")).toBeInTheDocument();
    expect(screen.getByText("That did not go through")).toBeInTheDocument();
  });

  it("asks for confirmation before publishing", async () => {
    renderWithViewer(<SaleAtgTab saleId={SALE_ID} status={ENABLED} view={view()} canManage />);

    await runAction("Publish on ATG", "Publish");

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
    expect(screen.getByText("Published on lax.bid")).toBeInTheDocument();
    expectBlocked("Push to ATG");
    expectBlocked("Publish on ATG");
  });

  it("disables close until the sale is on ATG and everything once closed", () => {
    const { unmount } = renderWithViewer(
      <SaleAtgTab saleId={SALE_ID} status={ENABLED} view={view()} canManage />,
    );
    expectBlocked("Close on ATG");
    unmount();

    renderWithViewer(
      <SaleAtgTab
        saleId={SALE_ID}
        status={ENABLED}
        view={view({ linked: true, atgAuctionId: "atg-a", remoteStatus: "closed" })}
        canManage
      />,
    );
    expectBlocked("Push changes");
    expectBlocked("Publish on ATG");
    expectBlocked("Close on ATG");
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

    await runAction("Push to ATG", "Push to ATG");

    expect(await screen.findByText("Syncing with ATG")).toBeInTheDocument();
    await flushEffects();
    await act(async () => {
      vi.advanceTimersByTime(3_500);
    });
    await waitFor(() => expect(adminAtgJobStateAction).toHaveBeenCalledWith("job-1"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText("Syncing with ATG")).not.toBeInTheDocument());
  });

  it("stops polling after a minute and says so", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    adminAtgJobStateAction.mockResolvedValue({ ok: true, data: { state: "active" } });

    renderWithViewer(<SaleAtgTab saleId={SALE_ID} status={ENABLED} view={view()} canManage />);

    await runAction("Push to ATG", "Push to ATG");
    await screen.findByText("Syncing with ATG");
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
    expectBlocked("Push changes");
    expectBlocked("Publish on ATG");
    expect(screen.getByRole("button", { name: "Close on ATG" })).not.toHaveAttribute(
      "aria-disabled",
    );
    expect(screen.getByText(/Close the ATG auction if it is still open/)).toBeInTheDocument();
  });

  it("shows lot states, the paddle column and a row menu for each lot", () => {
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
    expect(screen.getAllByText("4 bids").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sync error").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ATG updateLot failed with HTTP 400").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /^Actions for / }).length).toBeGreaterThanOrEqual(
      4,
    );
    expect(screen.getAllByText("Not pushed").length).toBeGreaterThan(0);
    expect(screen.queryByText("7")).not.toBeInTheDocument();
    expect(screen.getByText("1 of 4 lots")).toBeInTheDocument();
    expect(screen.getAllByText("Not sold").length).toBeGreaterThan(0);
    expect(screen.queryByText("Unsold")).not.toBeInTheDocument();
    expect(screen.getAllByText("42").length).toBeGreaterThan(0);
  });

  describe("ATG settings", () => {
    it("saves a changed auction type without asking", async () => {
      renderWithViewer(<SaleAtgTab saleId={SALE_ID} status={ENABLED} view={view()} canManage />);

      expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
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

    it("asks for confirmation before listing a sale publicly", async () => {
      renderWithViewer(<SaleAtgTab saleId={SALE_ID} status={ENABLED} view={view()} canManage />);

      choose(/^Public/);
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
      choose(/^Public/);
      expect(screen.getByRole("button", { name: "Save and send to ATG" })).toBeInTheDocument();
    });

    it("keeps a refused save visible instead of toasting it", async () => {
      adminAtgSaleSettingsAction.mockResolvedValue({
        ok: false,
        error: "Those ATG settings can no longer change. Reload the page.",
      });
      renderWithViewer(<SaleAtgTab saleId={SALE_ID} status={ENABLED} view={view()} canManage />);

      choose("Live");
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      expect(
        await screen.findByText("Those ATG settings can no longer change. Reload the page."),
      ).toBeInTheDocument();
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
      expect(screen.getByRole("radio", { name: /^Public/ })).toBeEnabled();
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
