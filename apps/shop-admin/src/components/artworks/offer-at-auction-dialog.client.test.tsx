// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const assess = vi.fn();
const sales = vi.fn();
const offer = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/server/application/admin-inventory-actions.server", () => ({
  getAuctionOfferAssessment: (...args: unknown[]) => assess(...args),
  listAuctionSales: (...args: unknown[]) => sales(...args),
  offerAtAuction: (...args: unknown[]) => offer(...args),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));
vi.mock("@auction/ui/components/select", async () =>
  (await import("@/test/radix-stubs")).selectStub(),
);

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { OfferAtAuctionDialog } = await import("./offer-at-auction-dialog.client");

const ARTWORK_ID = "11111111-1111-4111-8111-111111111111";
const SALE_ID = "33333333-3333-4333-8333-333333333333";

const eligible = {
  ok: true,
  data: {
    artworkId: ARTWORK_ID,
    title: "Blue room",
    stockCode: "LAX-ORI-PH-GAC-26-0001",
    onLaxArt: true,
    eligible: true,
    reasons: [],
  },
};
const oneSale = {
  ok: true,
  data: { sales: [{ id: SALE_ID, title: "Winter sale", startsAt: "2026-12-01T10:00:00.000Z" }] },
};

function open() {
  render(
    <OfferAtAuctionDialog open onOpenChange={vi.fn()} artworkId={ARTWORK_ID} title="Blue room" />,
  );
}

describe("OfferAtAuctionDialog", () => {
  beforeEach(() => {
    for (const fn of [assess, sales, offer, refresh]) fn.mockReset();
  });

  it("says why an artwork cannot move, and offers nothing to submit", async () => {
    assess.mockResolvedValue({
      ok: true,
      data: { ...eligible.data, eligible: false, reasons: ["A buyer has reserved this artwork."] },
    });
    sales.mockResolvedValue(oneSale);
    open();
    expect(await screen.findByText("A buyer has reserved this artwork.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Offer at auction" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Close" }).length).toBeGreaterThan(0);
  });

  it("explains when no sale is open for new lots", async () => {
    assess.mockResolvedValue(eligible);
    sales.mockResolvedValue({ ok: true, data: { sales: [] } });
    open();
    expect(await screen.findByText("No LAX Bid sale is open for new lots")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Offer at auction" })).not.toBeInTheDocument();
  });

  it("offers a retry when LAX Bid cannot be read", async () => {
    assess.mockResolvedValue(eligible);
    sales.mockResolvedValue({
      ok: false,
      kind: "failed",
      message: "Could not load LAX Bid sales.",
    });
    open();
    expect(await screen.findByText("Could not load LAX Bid sales.")).toBeInTheDocument();
    sales.mockResolvedValue(oneSale);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByLabelText("Starting price")).toBeInTheDocument();
  });

  it("needs a sale, a price and the consignor's agreement before it sends anything", async () => {
    assess.mockResolvedValue(eligible);
    sales.mockResolvedValue(oneSale);
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Offer at auction" }));
    // The placeholder and the error both read "Choose a sale".
    await waitFor(() => expect(screen.getAllByText("Choose a sale")).toHaveLength(2));
    expect(screen.getByText("Enter a starting price")).toBeInTheDocument();
    expect(screen.getByText("Confirm the consignor agreed")).toBeInTheDocument();
    expect(offer).not.toHaveBeenCalled();
  });

  it("tells staff the artwork comes off lax.art", async () => {
    assess.mockResolvedValue(eligible);
    sales.mockResolvedValue(oneSale);
    open();
    expect(await screen.findByText("This takes the artwork off lax.art")).toBeInTheDocument();
  });

  it("keeps what was typed when the move fails, and says what to do", async () => {
    assess.mockResolvedValue(eligible);
    sales.mockResolvedValue(oneSale);
    offer.mockResolvedValue({
      ok: false,
      kind: "failed",
      message: "The other product could not be reached (network). Try again in a moment.",
    });
    open();
    const price = await screen.findByLabelText("Starting price");
    fireEvent.change(price, { target: { value: "250" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /consignor agreed/ }));
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: /Winter sale/ }));
    fireEvent.click(screen.getByRole("button", { name: "Offer at auction" }));
    expect(await screen.findByText(/Try again in a moment/)).toBeInTheDocument();
    expect(screen.getByLabelText("Starting price")).toHaveValue("250");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("creates the draft lot and shows where it is", async () => {
    assess.mockResolvedValue(eligible);
    sales.mockResolvedValue(oneSale);
    offer.mockResolvedValue({
      ok: true,
      data: {
        lotId: "lot-1",
        saleId: SALE_ID,
        saleTitle: "Winter sale",
        withdrawnFromLaxArt: true,
      },
    });
    open();
    fireEvent.change(await screen.findByLabelText("Starting price"), { target: { value: "250" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /consignor agreed/ }));
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: /Winter sale/ }));
    fireEvent.click(screen.getByRole("button", { name: "Offer at auction" }));
    await waitFor(() =>
      expect(offer).toHaveBeenCalledWith({
        artworkId: ARTWORK_ID,
        body: { saleId: SALE_ID, startingPrice: "250.00", consignorAgreed: true },
        idempotencyKey: expect.any(String),
      }),
    );
    expect(await screen.findByText("Draft lot created in Winter sale")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });
});
