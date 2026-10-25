import { AttachExistingLotDialog } from "@/components/admin/sale-lots-tab/attach-existing-lot-dialog";
import type { Lot } from "@auction/types";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const previewAction = vi.fn();
const updateAction = vi.fn();
const attachAction = vi.fn();
const onAttached = vi.fn();
const onOpenChange = vi.fn();

vi.mock("@/lib/actions/admin", () => ({
  adminGetLotAttachPreviewAction: (...args: unknown[]) => previewAction(...args),
  adminUpdateLotResultAction: (...args: unknown[]) => updateAction(...args),
}));
vi.mock("@/lib/actions/admin-lots-browse", () => ({ searchAdminLotsBrowseAction: vi.fn() }));
vi.mock("@/lib/admin/catalog-lifecycle/admin-catalog-lifecycle-mutations", () => ({
  adminAttachLotToSaleResultAction: (...args: unknown[]) => attachAction(...args),
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
// The searchable list is a popover; the test chooses a lot directly.
vi.mock("@auction/staff-ui", async (importOriginal) => {
  const kit = await importOriginal<typeof import("@auction/staff-ui")>();
  return {
    ...kit,
    EntityPicker: ({
      onValueChange,
    }: {
      onValueChange: (option: { id: string; label: string }) => void;
    }) => (
      <button type="button" onClick={() => onValueChange({ id: "lot-9", label: "Blue Interior" })}>
        Choose Blue Interior
      </button>
    ),
  };
});

const SALE_WINDOW = {
  deliveryMode: "online" as const,
  startTime: new Date("2026-11-01T10:00:00Z"),
  endTime: new Date("2026-11-08T10:00:00Z"),
};

function previewLot(overrides: Partial<Lot> = {}): Lot {
  return {
    id: "lot-9",
    saleId: null,
    lotNumber: null,
    title: "Blue Interior",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    sellerLegalEntityId: "5f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
    categoryId: "6a1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
    categoryIds: ["6a1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f"],
    auctionType: "english",
    startingPrice: "250.00",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "0",
    buyerPremiumRate: "0.25",
    minBidIncrement: "10",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 0,
    dutchLastDecrementAt: null,
    startTime: new Date("2026-11-02T10:00:00Z"),
    endTime: new Date("2026-11-07T10:00:00Z"),
    status: "draft",
    winnerId: null,
    createdAt: new Date("2026-10-01T10:00:00Z"),
    updatedAt: new Date("2026-10-01T10:00:00Z"),
    marketingDetails: {},
    ...overrides,
  } as Lot;
}

function renderDialog() {
  return render(
    <AttachExistingLotDialog
      open
      onOpenChange={onOpenChange}
      saleId="sale-1"
      saleWindow={SALE_WINDOW}
      onAttached={onAttached}
    />,
  );
}

async function chooseLot() {
  fireEvent.click(screen.getByText("Choose Blue Interior"));
  await screen.findByText("Starting price");
}

describe("AttachExistingLotDialog", () => {
  beforeEach(() => {
    for (const fn of [previewAction, updateAction, attachAction, onAttached, onOpenChange]) {
      fn.mockReset();
    }
    attachAction.mockResolvedValue({ ok: true });
    updateAction.mockResolvedValue({ ok: true });
  });
  afterEach(cleanup);

  it("asks for a lot first and keeps Attach off until one is chosen", () => {
    renderDialog();

    expect(screen.getByText("Choose Blue Interior")).toBeInTheDocument();
    expect(screen.getByText("Attach to sale").closest("button")).toBeDisabled();
  });

  it("shows the lot's facts and attaches it without changing times that already fit", async () => {
    previewAction.mockResolvedValue({ ok: true, data: previewLot() });
    renderDialog();
    await chooseLot();

    expect(screen.getByText("Blue Interior")).toBeInTheDocument();
    expect(screen.getByText("£250.00")).toBeInTheDocument();
    expect(screen.queryByText("The lot's times do not fit the sale")).toBeNull();

    fireEvent.click(screen.getByText("Attach to sale"));
    await waitFor(() =>
      expect(attachAction).toHaveBeenCalledWith("sale-1", "lot-9", { via: "attach_endpoint" }),
    );
    expect(updateAction).not.toHaveBeenCalled();
    expect(onAttached).toHaveBeenCalledWith("lot-9", "Blue Interior");
  });

  it("explains a lot whose times miss the sale window and offers to fit them", async () => {
    previewAction.mockResolvedValue({
      ok: true,
      data: previewLot({ endTime: new Date("2026-12-31T10:00:00Z") }),
    });
    renderDialog();
    await chooseLot();

    expect(screen.getByText("The lot's times do not fit the sale")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Attach to sale"));
    expect(attachAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Sync lot to sale window"));
    expect(screen.queryByText("The lot's times do not fit the sale")).toBeNull();
  });

  it("keeps a failed attach in the dialog", async () => {
    previewAction.mockResolvedValue({ ok: true, data: previewLot() });
    attachAction.mockResolvedValue({ ok: false, error: "The sale is locked." });
    renderDialog();
    await chooseLot();

    fireEvent.click(screen.getByText("Attach to sale"));

    expect(await screen.findByText("That did not go through")).toBeInTheDocument();
    expect(onAttached).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("says when the chosen lot cannot be loaded and lets another be chosen", async () => {
    previewAction.mockResolvedValue({ ok: false, error: "Lot not found" });
    renderDialog();
    fireEvent.click(screen.getByText("Choose Blue Interior"));

    expect(await screen.findByText("That lot could not be loaded")).toBeInTheDocument();
    expect(screen.getByText("Choose Blue Interior")).toBeInTheDocument();
  });
});
