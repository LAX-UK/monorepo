import { SaleLotsTabBoard } from "@/components/admin/sale-detail/sale-lots-tab-board";
import type { Lot } from "@auction/types";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const detachAction = vi.fn();
const setStatusAction = vi.fn();
const router = vi.hoisted(() => ({ refresh: () => undefined }));

// The row menus are Radix popovers, slow in jsdom; they render their actions in place.
vi.mock("@auction/staff-ui", async (importOriginal) =>
  (await import("@/test/inline-row-actions")).withInlineRowActions(
    await importOriginal<typeof import("@auction/staff-ui")>(),
  ),
);
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/actions/admin", () => ({
  adminApproveWithdrawalRequestResultAction: vi.fn(),
  adminCancelLotResultAction: vi.fn(),
  adminDeclineWithdrawalRequestResultAction: vi.fn(),
  adminGetLotAttachPreviewAction: vi.fn(),
  adminPublishLotResultAction: vi.fn(),
  adminReturnLotToInventoryResultAction: vi.fn(),
  adminSoftDeleteLotResultAction: vi.fn(),
  adminUpdateLotResultAction: vi.fn(),
}));
vi.mock("@/lib/actions/admin-lots-browse", () => ({ searchAdminLotsBrowseAction: vi.fn() }));
vi.mock("@/lib/actions/admin-legal-entities-browse", () => ({
  searchAdminLegalEntitiesBrowseAction: vi.fn(),
}));
vi.mock("@/lib/actions/admin-sales", () => ({ adminAddLotToSaleResultAction: vi.fn() }));
vi.mock("@/lib/admin/catalog-lifecycle/admin-catalog-lifecycle-mutations", () => ({
  adminAttachLotToSaleResultAction: vi.fn(),
  adminDetachLotFromSaleResultAction: (...args: unknown[]) => detachAction(...args),
  adminSetLotStatusResultAction: (...args: unknown[]) => setStatusAction(...args),
}));
vi.mock("@/components/exports/export-button", () => ({
  ExportButton: () => <button type="button">Export</button>,
}));
vi.mock("@/components/admin/qr-code/admin-sale-lot-qr-print-button", () => ({
  AdminSaleLotQrPrintButton: () => <button type="button">Print QR labels</button>,
}));
vi.mock("@/components/forms/image-upload-field", () => ({ ImageUploadField: () => null }));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));

function lot(overrides: Partial<Lot> & Pick<Lot, "id" | "title">): Lot {
  return {
    saleId: "sale-1",
    lotNumber: null,
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: "cat-1",
    auctionType: "english",
    startingPrice: "100.00",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "0",
    buyerPremiumRate: "0.25",
    minBidIncrement: "10",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 0,
    dutchLastDecrementAt: null,
    startTime: new Date("2026-11-01T10:00:00Z"),
    endTime: new Date("2026-11-08T10:00:00Z"),
    status: "draft",
    winnerId: null,
    createdAt: new Date("2026-10-01T10:00:00Z"),
    updatedAt: new Date("2026-10-01T10:00:00Z"),
    marketingDetails: {},
    ...overrides,
  } as Lot;
}

const SALE = {
  status: "draft" as const,
  deliveryMode: "online" as const,
  startTime: new Date("2026-11-01T10:00:00Z"),
  endTime: new Date("2026-11-08T10:00:00Z"),
};

const LOTS = [
  lot({
    id: "lot-2",
    title: "Second lot",
    lotNumber: 2,
    marketingDetails: { estimate: { low: "1000", high: "2000", currency: "GBP" } },
    reservePrice: "800",
  }),
  lot({ id: "lot-1", title: "First lot", lotNumber: 1 }),
];

describe("SaleLotsTabBoard", () => {
  beforeEach(() => {
    detachAction.mockReset();
    detachAction.mockResolvedValue({ ok: true });
    setStatusAction.mockReset();
  });
  afterEach(cleanup);

  it("lists the lots by lot number with their estimate and reserve", () => {
    render(<SaleLotsTabBoard saleId="sale-1" sale={SALE} lots={LOTS} canManageAuction />);

    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0] as HTMLElement).getByText("First lot")).toBeInTheDocument();
    const second = within(rows[1] as HTMLElement);
    expect(second.getByText("Second lot")).toBeInTheDocument();
    expect(second.getByText("£1,000–£2,000")).toBeInTheDocument();
    expect(second.getByText("£800.00")).toBeInTheDocument();
    expect(second.getByText("Draft")).toBeInTheDocument();
  });

  it("names each lot's artist under its title, with the artist in the row menu", () => {
    render(
      <SaleLotsTabBoard
        saleId="sale-1"
        sale={SALE}
        lots={[{ ...LOTS[0], artistId: "artist-1" } as Lot, LOTS[1] as Lot]}
        artistNameById={{ "artist-1": "Mary Fedden" }}
      />,
    );
    expect(screen.getAllByText("Mary Fedden").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Open artist Mary Fedden")[0]?.closest("a")).toHaveAttribute(
      "href",
      "/admin/artists/artist-1",
    );
  });

  it("offers the setup page and attaching an existing lot while the sale is a draft", () => {
    render(<SaleLotsTabBoard saleId="sale-1" sale={SALE} lots={LOTS} canManageAuction />);

    const add = screen.getByText("Add lot").closest("a");
    expect(add).toHaveAttribute("href", expect.stringContaining("/admin/sales/sale-1/setup"));
    expect(screen.getByText("Attach existing lot")).toBeInTheDocument();
  });

  it("says how to add the first lot when the sale has none", () => {
    render(<SaleLotsTabBoard saleId="sale-1" sale={SALE} lots={[]} canManageAuction />);

    expect(screen.getByText("No lots in this sale yet")).toBeInTheDocument();
    expect(screen.queryByLabelText("Search lots")).toBeNull();
  });

  it("removes a lot from a draft sale only after it is confirmed", async () => {
    render(<SaleLotsTabBoard saleId="sale-1" sale={SALE} lots={LOTS} canManageAuction />);

    fireEvent.click(screen.getAllByText("Remove from sale…")[0] as HTMLElement);
    expect(screen.getByText("Remove First lot from this sale?")).toBeInTheDocument();
    expect(detachAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Remove from sale"));
    await vi.waitFor(() => expect(detachAction).toHaveBeenCalledWith("sale-1", "lot-1"));
  });

  it("leaves the sale-changing actions out for someone who cannot manage the auction", () => {
    render(<SaleLotsTabBoard saleId="sale-1" sale={SALE} lots={LOTS} />);

    expect(screen.queryByText("Remove from sale…")).toBeNull();
    expect(screen.queryByText("Print QR labels")).toBeNull();
    expect(screen.getAllByText("Open lot page").length).toBeGreaterThan(0);
  });

  it("offers a live sale's clerk a way to add a lot without leaving the page", () => {
    render(
      <SaleLotsTabBoard
        saleId="sale-1"
        sale={{ ...SALE, status: "active" }}
        lots={[lot({ id: "lot-3", title: "Live lot", lotNumber: 3, status: "active" })]}
        canManageAuction
      />,
    );

    expect(screen.queryByText("Attach existing lot")).toBeNull();
    fireEvent.click(screen.getByText("Add lot"));
    expect(screen.getByText("Add a lot to the live sale")).toBeInTheDocument();
    expect(screen.getAllByText("End lot…").length).toBeGreaterThan(0);
  });

  it("keeps one action in the header and the others beside the search when there are lots", () => {
    render(<SaleLotsTabBoard saleId="sale-1" sale={SALE} lots={LOTS} canManageAuction />);

    const header = screen.getByRole("heading", { name: "Lots" }).closest("header") as HTMLElement;
    expect(within(header).queryAllByRole("button")).toHaveLength(0);
    expect(within(header).getByRole("link", { name: "Add lot" })).toBeInTheDocument();
    expect(within(header).queryByRole("button", { name: "Export" })).not.toBeInTheDocument();
    const actions = screen.getByRole("button", { name: "Export" }).parentElement as HTMLElement;
    expect(
      within(actions).getByRole("button", { name: "Attach existing lot" }),
    ).toBeInTheDocument();
    expect(within(actions).getByRole("button", { name: "Print QR labels" })).toBeInTheDocument();
  });

  it("offers attaching and adding in the header when the sale has no lots", () => {
    render(<SaleLotsTabBoard saleId="sale-1" sale={SALE} lots={[]} canManageAuction />);

    const header = screen.getByRole("heading", { name: "Lots" }).closest("header") as HTMLElement;
    expect(within(header).getByRole("button", { name: "Attach existing lot" })).toBeInTheDocument();
    expect(within(header).getByRole("link", { name: "Add lot" })).toBeInTheDocument();
    expect(within(header).queryByRole("button", { name: "Export" })).not.toBeInTheDocument();
  });
});
