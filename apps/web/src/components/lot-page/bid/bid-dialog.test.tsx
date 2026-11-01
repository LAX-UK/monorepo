import { LotBidDialog, type LotBidDialogProps } from "@/components/lot-page/bid/bid-dialog";
import type { BidSubmission, BidSubmitOutcome } from "@/lib/lot-page/bid-dialog/bid-submitter";
import type { BidFailure } from "@auction/domain";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const money = (amount: string) => {
  const n = Number(amount);
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2 })}`;
};

/** A press, as a person would make it. */
function click(element: HTMLElement) {
  fireEvent.click(element);
}

type Submit = (submission: BidSubmission) => Promise<BidSubmitOutcome>;

function setup(
  submit: Submit = async () => ({ ok: true, bid: null }),
  over: Partial<LotBidDialogProps> = {},
) {
  const submitter = { submit: vi.fn(submit) };
  const onPlaced = vi.fn();
  const onOpenChange = vi.fn();
  const props: LotBidDialogProps = {
    open: true,
    session: 1,
    start: "next",
    modes: ["next", "maximum"],
    lot: {
      id: "lot-1",
      auctionType: "english",
      currentPrice: "7000.00",
      startingPrice: "4200.00",
      minBidIncrement: "250.00",
    },
    display: { lotNumber: 4, title: "Estuary, evening", artistName: "Anna Whitcombe" },
    terms: { kind: "flat", rate: "0.25" },
    agentLimitLeft: null,
    accountName: null,
    scheduled: false,
    legalEntityId: "entity-1",
    submitter,
    format: { money },
    onOpenChange,
    onPlaced,
    registerHref: "/sales/modern",
    ...over,
  };
  const view = render(<LotBidDialog {...props} />);
  return { submitter, onPlaced, onOpenChange, props, ...view };
}

const refused = (code: string, details: Record<string, string> = {}): BidFailure => ({
  kind: "refused",
  refusal: { code: code as never, details },
});

describe("LotBidDialog", () => {
  it("idle: opens on the next bid with the premium and the total, focus on the chosen option", async () => {
    setup();
    const dialog = screen.getByRole("dialog", { name: "Place a bid" });
    expect(
      within(dialog).getByText("Lot 4 · Estuary, evening · Anna Whitcombe"),
    ).toBeInTheDocument();
    const next = within(dialog).getByRole("radio", { name: "Bid £7,250" });
    expect(next).toBeChecked();
    await waitFor(() => expect(next).toHaveFocus());
    expect(within(dialog).getByText("Buyer's premium (25%)")).toBeInTheDocument();
    expect(within(dialog).getByText("£1,812.50")).toBeInTheDocument();
    expect(within(dialog).getByText("Total if you win")).toBeInTheDocument();
    expect(within(dialog).getByText("£9,062.50")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Confirm bid of £7,250" })).toBeEnabled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("choosing a maximum: offers the valid amounts and works the most the bidder would pay", async () => {
    setup();
    click(screen.getByRole("radio", { name: /set a maximum bid/i }));
    expect(screen.getByRole("dialog", { name: "Set a maximum bid" })).toBeInTheDocument();
    const select = screen.getByLabelText("Your maximum");
    fireEvent.change(select, { target: { value: "9000.00" } });
    expect(screen.getByText("Most you would pay")).toBeInTheDocument();
    expect(screen.getByText("Most you would pay").nextElementSibling).toHaveTextContent("£11,250");
    expect(screen.getByRole("button", { name: "Confirm maximum of £9,000" })).toBeEnabled();
  });

  it("confirming sends the next bid seen with a key, then reports it placed", async () => {
    const { submitter, onPlaced } = setup(async () => ({ ok: true, bid: null }));
    click(screen.getByRole("button", { name: "Confirm bid of £7,250" }));
    expect(submitter.submit).toHaveBeenCalledTimes(1);
    expect(submitter.submit.mock.calls[0]?.[0]).toMatchObject({
      lotId: "lot-1",
      mode: "next",
      amount: "7250.00",
      seenNextBid: "7250.00",
      scheduled: false,
    });
    expect(submitter.submit.mock.calls[0]?.[0].idempotencyKey).toBeTruthy();
    await waitFor(() =>
      expect(onPlaced).toHaveBeenCalledWith({ mode: "next", amount: "7250.00", bid: null }),
    );
  });

  it("submitting: says the bid is on its way and cannot be sent twice", async () => {
    let release: (outcome: BidSubmitOutcome) => void = () => undefined;
    const { submitter } = setup(
      () =>
        new Promise<BidSubmitOutcome>((resolve) => {
          release = resolve;
        }),
    );
    click(screen.getByRole("button", { name: "Confirm bid of £7,250" }));
    const busy = await screen.findByRole("button", { name: "Placing your bid…" });
    expect(busy).toHaveAttribute("aria-busy", "true");
    click(busy);
    expect(submitter.submit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    release({ ok: true, bid: null });
  });

  it("outbid while confirming: shows the new next bid, never raises it, asks again", async () => {
    const { submitter } = setup(async () => ({
      ok: false,
      failure: refused("outbid_during_confirm", { nextBidAmount: "7500.00" }),
    }));
    click(screen.getByRole("button", { name: "Confirm bid of £7,250" }));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Someone bid £7,250 first")).toBeInTheDocument();
    expect(
      within(alert).getByText("The next bid is now £7,500. Confirm if you'd like to bid it."),
    ).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "Confirm bid of £7,500" });
    expect(confirm).toHaveAttribute("aria-describedby", alert.parentElement?.id);
    expect(submitter.submit).toHaveBeenCalledTimes(1);
    click(confirm);
    expect(submitter.submit.mock.calls[1]?.[0]).toMatchObject({
      amount: "7500.00",
      seenNextBid: "7500.00",
    });
  });

  it("over the limit: says what is left and offers to ask an admin", async () => {
    setup(async () => ({
      ok: false,
      failure: refused("over_limit", { remaining: "5000.00" }),
    }));
    click(screen.getByRole("button", { name: "Confirm bid of £7,250" }));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("This bid is over your limit")).toBeInTheDocument();
    expect(within(alert).getByText(/£5,000 left of your limit for this sale/)).toBeInTheDocument();
    expect(within(alert).getByRole("link", { name: "Ask an admin" })).toHaveAttribute(
      "href",
      "/organisations",
    );
    expect(screen.getByRole("button", { name: "Confirm bid of £7,250" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("amount not valid: offers the nearest valid amount and uses it on request", async () => {
    setup(async () => ({
      ok: false,
      failure: refused("amount_invalid", { nearestValidAmount: "7250.00" }),
    }));
    click(screen.getByRole("button", { name: "Confirm bid of £7,250" }));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("The nearest valid amount is £7,250.")).toBeInTheDocument();
    click(within(alert).getByRole("button", { name: "Use £7,250" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("registration required: sends the bidder to register", async () => {
    setup(async () => ({ ok: false, failure: refused("registration_required") }));
    click(screen.getByRole("button", { name: "Confirm bid of £7,250" }));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("link", { name: "Register" })).toHaveAttribute(
      "href",
      "/sales/modern",
    );
  });

  it("registration pending: explains and leaves only Close", async () => {
    setup(async () => ({ ok: false, failure: refused("registration_pending") }));
    click(screen.getByRole("button", { name: "Confirm bid of £7,250" }));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Registration pending")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /confirm/i })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(2);
  });

  it("lot closed: says the bid wasn't placed and moves focus to Close", async () => {
    setup(async () => ({ ok: false, failure: refused("lot_closed") }));
    click(screen.getByRole("button", { name: "Confirm bid of £7,250" }));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Bidding has closed on this lot")).toBeInTheDocument();
    expect(within(alert).getByText(/Your bid wasn't placed/)).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    await waitFor(() =>
      expect(within(dialog).getAllByRole("button", { name: "Close" }).at(-1)).toHaveFocus(),
    );
  });

  it("connection dropped: offers Try again with the same key", async () => {
    const { submitter } = setup(async () => ({ ok: false, failure: { kind: "unreachable" } }));
    click(screen.getByRole("button", { name: "Confirm bid of £7,250" }));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("We couldn't confirm your bid")).toBeInTheDocument();
    click(screen.getByRole("button", { name: "Try again" }));
    const [first, second] = submitter.submit.mock.calls.map((call) => call[0].idempotencyKey);
    expect(first).toBe(second);
  });

  it("an agent: names the organisation and what is left of its limit", () => {
    setup(undefined, { accountName: "Northbank Gallery", agentLimitLeft: "18500.00" });
    expect(screen.getByText("Bidding for Northbank Gallery")).toBeInTheDocument();
    expect(screen.getByText("£18,500 left of your limit for this sale.")).toBeInTheDocument();
  });

  it("an agent over their limit is told before pressing", () => {
    setup(undefined, { agentLimitLeft: "5000.00" });
    expect(screen.getByText("This bid is over your limit")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm bid of £7,250" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("before the lot opens: only a maximum, left through the same dialog", async () => {
    const { submitter } = setup(undefined, {
      start: "maximum",
      modes: ["maximum"],
      scheduled: true,
    });
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByLabelText("Your maximum")).toBeInTheDocument();
    click(screen.getByRole("button", { name: "Confirm maximum of £7,250" }));
    expect(submitter.submit.mock.calls[0]?.[0]).toMatchObject({
      mode: "maximum",
      scheduled: true,
      maximum: "7250.00",
      legalEntityId: "entity-1",
    });
  });

  it("closes from Cancel", async () => {
    const { onOpenChange } = setup();
    click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("tells the bidder when someone bids while the dialog is open", async () => {
    const { rerender, props } = setup();
    expect(screen.queryByRole("alert")).toBeNull();
    rerender(<LotBidDialog {...props} lot={{ ...props.lot, currentPrice: "7250.00" }} />);
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Someone bid £7,250 first")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm bid of £7,500" })).toBeEnabled();
  });
});
