// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createOriginalSale = vi.fn();
const issueOriginalSaleInvoice = vi.fn();
const recordThirdPartySale = vi.fn();
const approveSaleFee = vi.fn();
const createStockHold = vi.fn();
const releaseStockHold = vi.fn();
const searchPartyOptions = vi.fn();
const searchArtworkOptions = vi.fn();
const searchEditionOptions = vi.fn();

vi.mock("@/server/application/admin-sales-actions.server", () => ({
  createOriginalSale,
  issueOriginalSaleInvoice,
  recordThirdPartySale,
  approveSaleFee,
  createStockHold,
  releaseStockHold,
}));
vi.mock("@/server/application/admin-lookup-actions.server", () => ({
  searchPartyOptions,
  searchArtworkOptions,
  searchEditionOptions,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/original-sales",
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
vi.mock("@auction/ui/components/popover", async () =>
  (await import("@/test/radix-stubs")).popoverStub(),
);
vi.mock("@auction/ui/components/dropdown-menu", async () =>
  (await import("@/test/radix-stubs")).dropdownMenuStub(),
);

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { NewOriginalSaleDialog } = await import("./new-original-sale-dialog.client");
const { RecordThirdPartySaleDialog } = await import("./record-third-party-sale-dialog.client");
const { NewHoldDialog } = await import("./new-hold-dialog.client");
const { IssueInvoiceDialog } = await import("./issue-invoice-dialog.client");
const { OriginalSalesList } = await import("./original-sales-list.client");
const { ThirdPartySalesList } = await import("./third-party-sales-list.client");
const { HoldsList } = await import("./holds-list.client");
const { holdsList, originalSalesList, thirdPartySalesList } = await import(
  "@/server/domain/sales-lists.vm"
);

const ok = { ok: true, data: { id: "x", status: "ok" } };

async function choose(trigger: HTMLElement, option: RegExp) {
  fireEvent.click(trigger);
  fireEvent.click(await screen.findByRole("option", { name: option }));
}

beforeEach(() => {
  for (const action of [
    createOriginalSale,
    issueOriginalSaleInvoice,
    recordThirdPartySale,
    approveSaleFee,
    createStockHold,
    releaseStockHold,
  ]) {
    action.mockReset();
    action.mockResolvedValue(ok);
  }
  searchPartyOptions.mockResolvedValue([
    { id: "p-1", label: "Ada Lovelace", description: "ada@example.com", meta: "Person" },
    { id: "p-2", label: "Grace Hopper", description: "grace@example.com", meta: "Person" },
  ]);
  searchArtworkOptions.mockResolvedValue([
    { id: "a-1", label: "Vessel Study", description: "Theo Marsh" },
  ]);
  searchEditionOptions.mockResolvedValue([
    { id: "e-1", label: "Vessel Study, edition 2", description: "Theo Marsh", meta: "Available" },
  ]);
});

describe("reserving an original", () => {
  function renderDialog() {
    render(<NewOriginalSaleDialog open onOpenChange={vi.fn()} />);
    return screen.getByRole("dialog", { name: "Reserve an original" });
  }

  it("takes the price in pounds with a money field, not pence", () => {
    const dialog = renderDialog();
    const price = within(dialog).getByLabelText("Sale price");
    expect(price).toHaveAttribute("inputmode", "decimal");
    expect(within(dialog).getByText("£")).toBeInTheDocument();
    expect(within(dialog).queryByText(/pence/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/id$/i)).not.toBeInTheDocument();
  });

  it("names every missing field and sends nothing", () => {
    const dialog = renderDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Reserve original" }));

    expect(within(dialog).getByText("Choose the artwork being sold.")).toBeInTheDocument();
    expect(within(dialog).getByText("Choose the buyer.")).toBeInTheDocument();
    expect(within(dialog).getByText("Enter the sale price in pounds.")).toBeInTheDocument();
    expect(createOriginalSale).not.toHaveBeenCalled();
  });

  it("explains text that is not an amount", () => {
    const dialog = renderDialog();
    fireEvent.input(within(dialog).getByLabelText("Sale price"), { target: { value: "1,20" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reserve original" }));
    // "1,20" is not read as £120.00: thousands commas only come in groups of three.
    expect(
      within(dialog).getByText("Enter an amount in pounds, like 1200 or 1200.50."),
    ).toBeInTheDocument();
  });

  it("sends the chosen records and the price as whole pence", async () => {
    const dialog = renderDialog();
    await choose(within(dialog).getByRole("combobox", { name: "Artwork" }), /Vessel Study/);
    await choose(within(dialog).getByRole("combobox", { name: "Buyer" }), /Ada Lovelace/);
    fireEvent.change(within(dialog).getByLabelText("Sale price"), {
      target: { value: "£12,500.50" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reserve original" }));

    await waitFor(() => expect(createOriginalSale).toHaveBeenCalledTimes(1));
    expect(createOriginalSale).toHaveBeenCalledWith({
      artworkId: "a-1",
      buyerPartyId: "p-1",
      salePricePence: 1250050,
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });
});

describe("recording a third-party sale", () => {
  function renderDialog() {
    render(<RecordThirdPartySaleDialog open onOpenChange={vi.fn()} />);
    return screen.getByRole("dialog", { name: "Record a third-party sale" });
  }

  it("chooses the edition, seller and buyer by name and takes pounds", async () => {
    const dialog = renderDialog();
    await choose(
      within(dialog).getByRole("combobox", { name: "Edition" }),
      /Vessel Study, edition 2/,
    );
    await choose(within(dialog).getByRole("combobox", { name: "Seller" }), /Ada Lovelace/);
    await choose(within(dialog).getByRole("combobox", { name: "Buyer" }), /Grace Hopper/);
    fireEvent.change(within(dialog).getByLabelText("Amount the buyer paid"), {
      target: { value: "999" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Record sale" }));

    await waitFor(() => expect(recordThirdPartySale).toHaveBeenCalledTimes(1));
    expect(recordThirdPartySale).toHaveBeenCalledWith({
      editionId: "e-1",
      sellerPartyId: "p-1",
      buyerPartyId: "p-2",
      grossPence: 99900,
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });

  it("will not record a sale from someone to themselves", async () => {
    const dialog = renderDialog();
    await choose(within(dialog).getByRole("combobox", { name: "Edition" }), /Vessel Study/);
    await choose(within(dialog).getByRole("combobox", { name: "Seller" }), /Ada Lovelace/);
    await choose(within(dialog).getByRole("combobox", { name: "Buyer" }), /Ada Lovelace/);
    fireEvent.change(within(dialog).getByLabelText("Amount the buyer paid"), {
      target: { value: "10" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Record sale" }));

    expect(
      within(dialog).getByText("The buyer and the seller must be different people."),
    ).toBeInTheDocument();
    expect(recordThirdPartySale).not.toHaveBeenCalled();
  });
});

describe("holding an edition", () => {
  it("chooses the edition and client by name and asks when the hold ends in London time", async () => {
    render(<NewHoldDialog open onOpenChange={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "Hold an edition" });
    expect(within(dialog).queryByLabelText(/id$/i)).not.toBeInTheDocument();
    expect(within(dialog).getByText(/Europe\/London \((BST|GMT)\)/)).toBeInTheDocument();

    await choose(within(dialog).getByRole("combobox", { name: "Edition" }), /Vessel Study/);
    await choose(within(dialog).getByRole("combobox", { name: "Client" }), /Grace Hopper/);
    fireEvent.click(within(dialog).getByRole("button", { name: "Create hold" }));

    expect(within(dialog).getByText("Enter when the hold ends.")).toBeInTheDocument();
    expect(createStockHold).not.toHaveBeenCalled();
  });
});

describe("issuing an invoice", () => {
  const sale = {
    saleId: "s-1",
    artworkId: "a-1",
    artworkTitle: "Vessel Study",
    status: "reserved",
    salePricePence: 250000,
    createdAt: "2026-10-01T09:00:00.000Z",
    buyerName: "Ada Lovelace",
    buyerEmail: "ada@example.com",
  };

  it("starts from the buyer on record, repeats the amount on the button, and sends the sale's id for them", async () => {
    render(<IssueInvoiceDialog sale={sale} open onOpenChange={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "Invoice £2,500.00 for Vessel Study?" });
    expect(within(dialog).getByLabelText("Send the invoice to")).toHaveValue("ada@example.com");
    expect(within(dialog).getByLabelText(/Name on the invoice/)).toHaveValue("Ada Lovelace");

    fireEvent.click(within(dialog).getByRole("button", { name: "Issue £2,500.00 invoice" }));
    await waitFor(() => expect(issueOriginalSaleInvoice).toHaveBeenCalledTimes(1));
    expect(issueOriginalSaleInvoice).toHaveBeenCalledWith({
      originalSaleId: "s-1",
      buyerEmail: "ada@example.com",
      buyerName: "Ada Lovelace",
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });

  it("asks for a usable email", () => {
    render(<IssueInvoiceDialog sale={{ ...sale, buyerEmail: null }} open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Issue £2,500.00 invoice" }));
    expect(screen.getByText("Enter the email address the invoice is sent to.")).toBeInTheDocument();
    expect(issueOriginalSaleInvoice).not.toHaveBeenCalled();
  });
});

describe("the lists offer each action only where the record and the role allow it", () => {
  const rowOf = (text: string) =>
    within(screen.getByRole("grid")).getByText(text).closest("tr") as HTMLElement;
  const item = (text: string, name: RegExp) =>
    within(rowOf(text)).queryByRole("menuitem", { name });

  const sale = (status: string, id: string, title: string) => ({
    saleId: id,
    artworkId: `a-${id}`,
    artworkTitle: title,
    status,
    salePricePence: 100000,
    createdAt: "2026-10-01T09:00:00.000Z",
    buyerName: "Ada Lovelace",
    buyerEmail: "ada@example.com",
    reservationExpiresAt: null,
  });
  const originals = {
    items: [
      sale("reserved", "s1", "Reserved Work"),
      sale("invoiced", "s2", "Invoiced Work"),
      sale("paid", "s3", "Paid Work"),
    ],
    nextCursor: null,
    counts: { reserved: 1, invoiced: 1, paid: 1 },
  };
  const originalsState = originalSalesList.parse({});

  it("invoices a reservation, says so for an invoiced sale, and offers nothing once paid", () => {
    render(<OriginalSalesList state={originalsState} page={originals} canSell />);
    expect(item("Reserved Work", /Issue £1,000.00 invoice/)).not.toHaveAttribute("aria-disabled");
    expect(item("Invoiced Work", /Issue £1,000.00 invoice/)).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(item("Paid Work", /Issue/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reserve original" })).toBeInTheDocument();
  });

  it("hides every sales action from a role that cannot sell originals", () => {
    render(<OriginalSalesList state={originalsState} page={originals} canSell={false} />);
    expect(screen.queryByRole("menuitem", { name: /Issue/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reserve original" })).not.toBeInTheDocument();
  });

  const thirdParty = {
    items: [
      {
        saleId: "t1",
        editionId: "e1",
        artworkTitle: "Vessel Study",
        editionNumber: 1,
        status: "recorded",
        grossPence: 120000,
        recordedAt: "2026-10-02T09:00:00.000Z",
        fees: [{ feeId: "f1", label: "Commission", amountPence: 12000, status: "pending" }],
        sellerName: "Grace Hopper",
        buyerName: "Ada Lovelace",
        createdAt: "2026-10-02T09:00:00.000Z",
      },
      {
        saleId: "t2",
        editionId: "e2",
        artworkTitle: "Night Garden",
        editionNumber: 4,
        status: "recorded",
        grossPence: 90000,
        recordedAt: "2026-10-03T09:00:00.000Z",
        fees: [{ feeId: "f2", label: "Commission", amountPence: 9000, status: "approved" }],
        sellerName: "Grace Hopper",
        buyerName: "Ada Lovelace",
        createdAt: "2026-10-03T09:00:00.000Z",
      },
    ],
    nextCursor: null,
    counts: { recorded: 2 },
  };
  const thirdPartyState = thirdPartySalesList.parse({});

  it("lets finance approve a pending fee from its sale, repeating the amount, and not an approved one", async () => {
    render(
      <ThirdPartySalesList
        state={thirdPartyState}
        page={thirdParty}
        canRecord={false}
        canApproveFees
      />,
    );
    expect(screen.queryByRole("button", { name: "Record sale" })).not.toBeInTheDocument();
    expect(item("Night Garden, edition 4", /Approve/)).not.toBeInTheDocument();

    const approve = item("Vessel Study, edition 1", /Approve £120.00 fee/);
    if (!approve) throw new Error("no approve item");
    fireEvent.click(approve);
    const dialog = await screen.findByRole("dialog", {
      name: "Approve the £120.00 commission fee on Vessel Study, edition 1?",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve £120.00 fee" }));

    await waitFor(() => expect(approveSaleFee).toHaveBeenCalledTimes(1));
    expect(approveSaleFee).toHaveBeenCalledWith({
      feeId: "f1",
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });

  it("lets operations record a sale but not approve its fee", () => {
    render(
      <ThirdPartySalesList
        state={thirdPartyState}
        page={thirdParty}
        canRecord
        canApproveFees={false}
      />,
    );
    expect(screen.getByRole("button", { name: "Record sale" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Approve/ })).not.toBeInTheDocument();
  });

  const holds = {
    items: [
      {
        holdId: "h1",
        editionId: "e1",
        artworkTitle: "Vessel Study",
        editionNumber: 2,
        status: "active",
        expiresAt: "2026-11-01T09:00:00.000Z",
        brokerPartyId: null,
        clientPartyId: "p1",
        clientName: "Ada Lovelace",
        brokerName: null,
        note: null,
        createdAt: "2026-10-01T09:00:00.000Z",
      },
      {
        holdId: "h2",
        editionId: "e2",
        artworkTitle: "Night Garden",
        editionNumber: 4,
        status: "expired",
        expiresAt: "2026-09-01T09:00:00.000Z",
        brokerPartyId: null,
        clientPartyId: "p1",
        clientName: "Ada Lovelace",
        brokerName: null,
        note: null,
        createdAt: "2026-08-01T09:00:00.000Z",
      },
    ],
    nextCursor: null,
    counts: { active: 1, expired: 1 },
  };

  it("releases an active hold after confirming, and not an ended one", async () => {
    render(<HoldsList state={holdsList.parse({})} page={holds} canHold />);
    expect(item("Night Garden, edition 4", /Release/)).not.toBeInTheDocument();

    const release = item("Vessel Study, edition 2", /Release hold/);
    if (!release) throw new Error("no release item");
    fireEvent.click(release);
    const dialog = await screen.findByRole("dialog", {
      name: "Release the hold on Vessel Study, edition 2?",
    });
    expect(dialog).toHaveTextContent("Ada Lovelace loses their hold on it");
    fireEvent.click(within(dialog).getByRole("button", { name: "Release hold" }));

    await waitFor(() => expect(releaseStockHold).toHaveBeenCalledTimes(1));
    expect(releaseStockHold).toHaveBeenCalledWith({
      holdId: "h1",
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });
});
