// @vitest-environment jsdom
import { pinClock } from "@/test/pin-clock";
import { expectBackCloses, expectQueuePanel } from "@/test/queue-panel";
import type {
  AdminFulfilmentList,
  AdminOriginalSaleList,
  AdminStockHoldList,
  AdminThirdPartySaleList,
} from "@auction/shop-contracts";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The LAX Admin work queues that have no test file of their own for the list (fulfilment, stock
 * holds, original sales and third-party sales): each opens its panel with the record in the URL,
 * steps with J and K, closes on Back and Esc with focus back on the row, and keeps its actions
 * behind the role that may take them and a confirmation.
 */

const updateFulfilment = vi.fn();
const recordFulfilmentPossession = vi.fn();
const releaseStockHold = vi.fn();
const issueOriginalSaleInvoice = vi.fn();
const approveSaleFee = vi.fn();

vi.mock("@/server/application/admin-operations-actions.server", () => ({
  updateFulfilment,
  recordFulfilmentPossession,
}));
vi.mock("@/server/application/admin-sales-actions.server", () => ({
  releaseStockHold,
  issueOriginalSaleInvoice,
  approveSaleFee,
  createStockHold: vi.fn(),
  createOriginalSale: vi.fn(),
  recordThirdPartySale: vi.fn(),
}));
vi.mock("@/server/application/admin-lookup-actions.server", () => ({
  searchPartyOptions: vi.fn(),
  searchArtworkOptions: vi.fn(),
  searchEditionOptions: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));
vi.mock("@auction/ui/components/dropdown-menu", async () =>
  (await import("@/test/radix-stubs")).dropdownMenuStub(),
);
vi.mock("@auction/ui/components/select", async () =>
  (await import("@/test/radix-stubs")).selectStub(),
);
vi.mock("@auction/ui/components/popover", async () =>
  (await import("@/test/radix-stubs")).popoverStub(),
);

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { FulfilmentList } = await import("./orders/fulfilment-list.client");
const { HoldsList } = await import("./sales/holds-list.client");
const { OriginalSalesList } = await import("./sales/original-sales-list.client");
const { ThirdPartySalesList } = await import("./sales/third-party-sales-list.client");
const { fulfilmentList, holdsList, originalSalesList, thirdPartySalesList } = await import(
  "@/server/domain/sales-lists.vm"
);

const withTooltips = (node: React.ReactNode) =>
  render(<StaffTooltipProvider>{node}</StaffTooltipProvider>);

const uuid = (digit: string) =>
  `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;

pinClock();

beforeEach(() => {
  vi.clearAllMocks();
});

// Fulfilment -----------------------------------------------------------------------------------

const fulfilment = (
  overrides: Partial<AdminFulfilmentList["items"][number]>,
): AdminFulfilmentList["items"][number] => ({
  fulfilmentId: uuid("1"),
  orderId: uuid("a"),
  orderReference: "LAX-S-10001",
  status: "awaiting_dispatch",
  option: "ship_uk",
  carrier: null,
  trackingNumber: null,
  updatedAt: "2026-10-20T09:00:00.000Z",
  paidAt: "2026-10-18T09:00:00.000Z",
  buyerName: "Ada Lee",
  buyerEmail: "ada@example.com",
  ...overrides,
});

const fulfilments: AdminFulfilmentList = {
  items: [
    fulfilment({}),
    fulfilment({ fulfilmentId: uuid("2"), orderId: uuid("b"), orderReference: "LAX-S-10002" }),
    fulfilment({
      fulfilmentId: uuid("3"),
      orderId: uuid("c"),
      orderReference: "LAX-S-10003",
      status: "in_transit",
      carrier: "Royal Mail",
      trackingNumber: "RM123456789GB",
    }),
  ],
  nextCursor: null,
};

function renderFulfilment(query: Record<string, string> = {}) {
  withTooltips(<FulfilmentList state={fulfilmentList.parse(query)} page={fulfilments} />);
}

describe("the fulfilment queue", () => {
  beforeEach(() => window.history.replaceState(null, "", "/fulfilment"));

  const second = { link: "LAX-S-10002", panel: /Order LAX-S-10002/, id: uuid("2") };
  const third = { link: "LAX-S-10003", panel: /Order LAX-S-10003/, id: uuid("3") };

  it("opens a fulfilment in the URL, steps with J and K, and Esc returns to the row", async () => {
    renderFulfilment();
    await expectQueuePanel({
      grid: "Fulfilment",
      path: "/fulfilment",
      param: "fulfilment",
      first: second,
      second: third,
      total: 3,
    });
  });

  it("closes the panel on Back", async () => {
    renderFulfilment();
    await expectBackCloses({ grid: "Fulfilment", path: "/fulfilment", record: third });
  });

  it('shows its place, "2 of 3", with the next step and the way to the order', async () => {
    renderFulfilment({ fulfilment: second.id });
    const panel = await screen.findByRole("dialog", { name: second.panel });
    expect(panel.querySelector("[data-staff-queue-position]")).toHaveTextContent("2 of 3");
    expect(within(panel).getByRole("heading", { name: "Next step" })).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Open order" })).toHaveAttribute(
      "href",
      `/orders/${uuid("b")}#fulfilment`,
    );
  });

  it("does not step away from a next step that is half filled in", async () => {
    renderFulfilment({ fulfilment: second.id });
    const panel = await screen.findByRole("dialog", { name: second.panel });
    fireEvent.click(
      within(within(panel).getByRole("listbox")).getByRole("option", { name: "In transit" }),
    );
    fireEvent.keyDown(panel, { key: "j" });
    expect(screen.getByRole("dialog", { name: second.panel })).toBeInTheDocument();
    expect(updateFulfilment).not.toHaveBeenCalled();
  });
});

// Stock holds ----------------------------------------------------------------------------------

const hold = (
  overrides: Partial<AdminStockHoldList["items"][number]>,
): AdminStockHoldList["items"][number] => ({
  holdId: uuid("1"),
  editionId: uuid("d"),
  artworkTitle: "Dusk",
  printLabel: "4/25",
  status: "active",
  expiresAt: "2026-11-30T17:00:00.000Z",
  brokerPartyId: null,
  clientPartyId: uuid("e"),
  clientName: "Theo Marsh",
  createdAt: "2026-10-20T09:00:00.000Z",
  ...overrides,
});

const holds: AdminStockHoldList = {
  items: [hold({}), hold({ holdId: uuid("2"), artworkTitle: "Harbour", printLabel: "2/10" })],
  nextCursor: null,
};

function renderHolds(query: Record<string, string> = {}, canHold = true) {
  withTooltips(<HoldsList state={holdsList.parse(query)} page={holds} canHold={canHold} />);
}

describe("the stock holds queue", () => {
  beforeEach(() => window.history.replaceState(null, "", "/holds"));

  const dusk = { link: "Dusk, 4/25", panel: /Dusk, 4\/25/, id: uuid("1") };
  const harbour = { link: "Harbour, 2/10", panel: /Harbour, 2\/10/, id: uuid("2") };

  it("opens a hold in the URL, steps with J and K, and Esc returns to the row", async () => {
    renderHolds();
    await expectQueuePanel({
      grid: "Stock holds",
      path: "/holds",
      param: "hold",
      first: dusk,
      second: harbour,
      total: 2,
    });
  });

  it("closes the panel on Back", async () => {
    renderHolds();
    await expectBackCloses({ grid: "Stock holds", path: "/holds", record: dusk });
  });

  it("asks before releasing from the panel, and sends nothing until confirmed", async () => {
    renderHolds({ hold: dusk.id });
    const panel = await screen.findByRole("dialog", { name: dusk.panel });
    fireEvent.click(within(panel).getByRole("button", { name: "Release hold" }));
    expect(
      await screen.findByRole("dialog", { name: "Release the hold on Dusk, 4/25?" }),
    ).toBeInTheDocument();
    expect(releaseStockHold).not.toHaveBeenCalled();
  });

  it("offers no release in the panel to a role that cannot hold", async () => {
    renderHolds({ hold: dusk.id }, false);
    const panel = await screen.findByRole("dialog", { name: dusk.panel });
    expect(within(panel).queryByRole("button", { name: "Release hold" })).toBeNull();
  });
});

// Original sales -------------------------------------------------------------------------------

const originalSale = (
  overrides: Partial<AdminOriginalSaleList["items"][number]>,
): AdminOriginalSaleList["items"][number] => ({
  saleId: uuid("1"),
  artworkId: uuid("f"),
  artworkTitle: "Vessel Study",
  status: "reserved",
  salePricePence: 450000,
  createdAt: "2026-10-20T09:00:00.000Z",
  buyerName: "Cavendish Gallery",
  buyerEmail: "sales@cavendish.example",
  reservationExpiresAt: null,
  ...overrides,
});

const originalSales: AdminOriginalSaleList = {
  items: [
    originalSale({}),
    originalSale({ saleId: uuid("2"), artworkTitle: "Night Garden", status: "invoiced" }),
  ],
  nextCursor: null,
};

function renderOriginalSales(query: Record<string, string> = {}, canSell = true) {
  withTooltips(
    <OriginalSalesList
      state={originalSalesList.parse(query)}
      page={originalSales}
      canSell={canSell}
    />,
  );
}

describe("the original sales queue", () => {
  beforeEach(() => window.history.replaceState(null, "", "/original-sales"));

  const vessel = { link: "Vessel Study", panel: /Vessel Study/, id: uuid("1") };
  const garden = { link: "Night Garden", panel: /Night Garden/, id: uuid("2") };

  it("opens a sale in the URL, steps with J and K, and Esc returns to the row", async () => {
    renderOriginalSales();
    await expectQueuePanel({
      grid: "Original sales",
      path: "/original-sales",
      param: "sale",
      first: vessel,
      second: garden,
      total: 2,
    });
  });

  it("closes the panel on Back", async () => {
    renderOriginalSales();
    await expectBackCloses({ grid: "Original sales", path: "/original-sales", record: garden });
  });

  it("asks before issuing the invoice from the panel, and sends nothing until confirmed", async () => {
    renderOriginalSales({ sale: vessel.id });
    const panel = await screen.findByRole("dialog", { name: vessel.panel });
    fireEvent.click(within(panel).getByRole("button", { name: "Issue £4,500.00 invoice" }));
    expect(
      await screen.findByRole("dialog", { name: "Invoice £4,500.00 for Vessel Study?" }),
    ).toBeInTheDocument();
    expect(issueOriginalSaleInvoice).not.toHaveBeenCalled();
  });

  it("offers no invoice in the panel to a role that cannot sell", async () => {
    renderOriginalSales({ sale: vessel.id }, false);
    const panel = await screen.findByRole("dialog", { name: vessel.panel });
    expect(within(panel).queryByRole("button", { name: /Issue .* invoice/ })).toBeNull();
  });
});

// Third-party sales ----------------------------------------------------------------------------

const thirdPartySale = (
  overrides: Partial<AdminThirdPartySaleList["items"][number]>,
): AdminThirdPartySaleList["items"][number] => ({
  saleId: uuid("1"),
  editionId: uuid("d"),
  artworkTitle: "Dusk",
  printLabel: "4/25",
  status: "recorded",
  grossPence: 120000,
  recordedAt: "2026-10-20T09:00:00.000Z",
  fees: [{ feeId: uuid("9"), label: "Resale", amountPence: 6000, status: "pending" }],
  sellerName: "Theo Marsh",
  buyerName: "Ada Lee",
  createdAt: "2026-10-20T09:00:00.000Z",
  ...overrides,
});

const thirdPartySales: AdminThirdPartySaleList = {
  items: [
    thirdPartySale({}),
    thirdPartySale({ saleId: uuid("2"), artworkTitle: "Harbour", printLabel: "2/10", fees: [] }),
  ],
  nextCursor: null,
};

function renderThirdPartySales(query: Record<string, string> = {}, canApproveFees = true) {
  withTooltips(
    <ThirdPartySalesList
      state={thirdPartySalesList.parse(query)}
      page={thirdPartySales}
      canRecord
      canApproveFees={canApproveFees}
    />,
  );
}

describe("the third-party sales queue", () => {
  beforeEach(() => window.history.replaceState(null, "", "/third-party-sales"));

  const dusk = { link: "Dusk, 4/25", panel: /Dusk, 4\/25/, id: uuid("1") };
  const harbour = { link: "Harbour, 2/10", panel: /Harbour, 2\/10/, id: uuid("2") };

  it("opens a sale in the URL, steps with J and K, and Esc returns to the row", async () => {
    renderThirdPartySales();
    await expectQueuePanel({
      grid: "Third-party sales",
      path: "/third-party-sales",
      param: "sale",
      first: dusk,
      second: harbour,
      total: 2,
    });
  });

  it("closes the panel on Back", async () => {
    renderThirdPartySales();
    await expectBackCloses({ grid: "Third-party sales", path: "/third-party-sales", record: dusk });
  });

  it("asks before approving the fee from the panel, and sends nothing until confirmed", async () => {
    renderThirdPartySales({ sale: dusk.id });
    const panel = await screen.findByRole("dialog", { name: dusk.panel });
    fireEvent.click(within(panel).getByRole("button", { name: "Approve £60.00 fee" }));
    expect(
      await screen.findByRole("dialog", { name: "Approve the £60.00 resale fee on Dusk, 4/25?" }),
    ).toBeInTheDocument();
    expect(approveSaleFee).not.toHaveBeenCalled();
  });

  it("offers no fee approval in the panel to a role that cannot approve fees", async () => {
    renderThirdPartySales({ sale: dusk.id }, false);
    const panel = await screen.findByRole("dialog", { name: dusk.panel });
    expect(within(panel).queryByRole("button", { name: /Approve/ })).toBeNull();
  });
});
