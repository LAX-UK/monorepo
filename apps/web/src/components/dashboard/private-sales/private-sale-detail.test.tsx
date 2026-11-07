import type { PartyDealDetail } from "@/lib/private-sales/party-deals.schema";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrivateSaleDetail } from "./private-sale-detail";

const refresh = vi.fn();
const accept = vi.fn();
const pay = vi.fn();
const notifySuccess = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/private-sales/PS-0012",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/actions/private-sales", () => ({
  acceptPrivateSaleTermsAction: (...args: unknown[]) => accept(...args),
  startPrivateSalePaymentAction: (...args: unknown[]) => pay(...args),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (...args: unknown[]) => notifySuccess(...args), error: vi.fn() },
}));

function detail(
  overrides: Partial<PartyDealDetail> = {},
  view: Partial<PartyDealDetail["view"]> = {},
): PartyDealDetail {
  return {
    view: {
      audience: "buyer",
      reference: "PS-0012",
      stage: "offer",
      priceState: "under_discussion",
      counterparty: { disclosed: false, label: "LAX" },
      buyerMoney: null,
      sellerMoney: null,
      paymentDueAt: null,
      collectionDueAt: null,
      ...view,
    },
    work: { title: "Harbour at dusk", reference: "C-1042" },
    needs: null,
    termsToAccept: null,
    payable: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  accept.mockResolvedValue({ ok: true });
  pay.mockResolvedValue({ ok: true, data: { checkoutUrl: "https://pay.example/c/1" } });
});

describe("PrivateSaleDetail", () => {
  it("says the price is under discussion and shows no figure", () => {
    render(<PrivateSaleDetail detail={detail()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Harbour at dusk" })).toBeInTheDocument();
    expect(screen.getByText("Private sale · PS-0012 · C-1042")).toBeInTheDocument();
    expect(screen.getByText("Offer under discussion.")).toBeInTheDocument();
    expect(screen.queryByText(/£/)).toBeNull();
  });

  it("shows the other side as LAX", () => {
    render(<PrivateSaleDetail detail={detail()} />);
    expect(screen.getByText("Sold by")).toBeInTheDocument();
    expect(screen.getByText("LAX")).toBeInTheDocument();
  });

  it("makes accepting the terms the one action before agreement, and records it", async () => {
    render(<PrivateSaleDetail detail={detail({ termsToAccept: "v1", needs: "accept_terms" })} />);
    expect(screen.getByRole("link", { name: "private sale terms" })).toHaveAttribute(
      "href",
      "/terms",
    );
    fireEvent.click(screen.getByRole("button", { name: "Accept the terms" }));
    await waitFor(() => expect(accept).toHaveBeenCalledWith("PS-0012"));
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Terms accepted"));
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the buyer the price, the fee and the total, then lets them pay", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { assign }, writable: true });
    render(
      <PrivateSaleDetail
        detail={detail(
          { payable: true, needs: "pay" },
          {
            stage: "invoiced",
            priceState: "agreed",
            paymentDueAt: "2026-11-19T17:00:00.000Z",
            buyerMoney: { priceMinor: 4_800_000, buyerFeeMinor: 120_000, totalDueMinor: 4_920_000 },
          },
        )}
      />,
    );
    expect(screen.getByText("£48,000.00")).toBeInTheDocument();
    expect(screen.getByText("£1,200.00")).toBeInTheDocument();
    expect(screen.getAllByText("£49,200.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Pay by .*19 Nov/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Pay £49,200.00" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://pay.example/c/1"));
  });

  it("shows a seller their own lines only: the commission and what they receive, never a fee", () => {
    render(
      <PrivateSaleDetail
        detail={detail(
          {},
          {
            audience: "seller",
            stage: "paid",
            priceState: "agreed",
            sellerMoney: {
              priceMinor: 4_800_000,
              sellerCommissionMinor: 720_000,
              costsMinor: 25_000,
              netToSellerMinor: 4_055_000,
            },
          },
        )}
      />,
    );
    expect(screen.getByText("Your proceeds")).toBeInTheDocument();
    expect(screen.getByText("−£7,200.00")).toBeInTheDocument();
    expect(screen.getByText("£40,550.00")).toBeInTheDocument();
    expect(screen.getByText("Sold to")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pay/ })).toBeNull();
    expect(screen.queryByText(/Fee/)).toBeNull();
  });

  it("sends a buyer to verify their identity or add proof of funds, in plain words", () => {
    const { rerender } = render(
      <PrivateSaleDetail detail={detail({ needs: "verify_identity" })} />,
    );
    expect(screen.getByRole("link", { name: "Verify your identity" })).toHaveAttribute(
      "href",
      "/verify-identity",
    );
    rerender(<PrivateSaleDetail detail={detail({ needs: "proof_of_funds" })} />);
    expect(screen.getByRole("link", { name: "Add proof of funds" })).toHaveAttribute(
      "href",
      "/compliance/source-of-funds",
    );
    expect(document.body.textContent).not.toMatch(/AML|KYC|screening|Compliance/i);
  });

  it("says why an action failed, in the client's words", async () => {
    accept.mockResolvedValue({ ok: false, error: "The terms can't be accepted at this stage." });
    render(<PrivateSaleDetail detail={detail({ termsToAccept: "v1" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept the terms" }));
    expect(
      await screen.findByText("The terms can't be accepted at this stage."),
    ).toBeInTheDocument();
  });
});
