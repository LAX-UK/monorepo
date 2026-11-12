import {
  acceptBidderReofferAction,
  declineBidderReofferAction,
} from "@/lib/actions/bidder-reoffer";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReofferOfferAnswer } from "./reoffer-offer-answer";

vi.mock("@/lib/actions/bidder-reoffer", () => ({
  acceptBidderReofferAction: vi.fn(),
  declineBidderReofferAction: vi.fn(),
}));
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/ui/notify", () => ({ notify }));
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const ID = "11111111-1111-4111-8111-111111111111";
const accept = vi.mocked(acceptBidderReofferAction);
const decline = vi.mocked(declineBidderReofferAction);

const TOTAL = 102_500_00;
const open = () =>
  render(
    <ReofferOfferAnswer reofferId={ID} lotTitle="The Winter Study" expectedTotalMinor={TOTAL} />,
  );
const acceptButton = () => screen.getByRole("button", { name: "Accept and continue" });
const tick = () => fireEvent.click(screen.getByRole("checkbox"));

describe("ReofferOfferAnswer", () => {
  beforeEach(() => {
    for (const fn of [accept, decline, router.refresh, router.push, router.replace]) fn.mockReset();
    notify.success.mockReset();
    notify.error.mockReset();
  });

  it("keeps Accept off, and says why, until the terms box is ticked", () => {
    open();
    expect(acceptButton().getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Tick the box to accept.")).toBeTruthy();
    fireEvent.click(acceptButton());
    expect(accept).not.toHaveBeenCalled();
    tick();
    expect(acceptButton().getAttribute("aria-disabled")).not.toBe("true");
    expect(screen.queryByText("Tick the box to accept.")).toBeNull();
  });

  it("accepts with the terms ticked and the total shown, and lands on the new purchase", async () => {
    accept.mockResolvedValue({ ok: true, data: { lotId: "lot-9" } });
    open();
    tick();
    fireEvent.click(acceptButton());
    await waitFor(() => expect(accept).toHaveBeenCalledWith(ID, true, TOTAL));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/purchases/lot-9"));
  });

  it("says in words why an account that cannot accept was refused, and stays on the page", async () => {
    accept.mockResolvedValue({
      ok: false,
      error: "This account can no longer accept this offer. Contact us if you think this is wrong.",
      status: 409,
      errorCode: "bidder_unavailable",
    });
    open();
    tick();
    fireEvent.click(acceptButton());
    expect(await screen.findByText(/can no longer accept this offer/)).toBeTruthy();
    expect(router.refresh).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("shows the ended page with its danger notice when the offer ended while answering", async () => {
    accept.mockResolvedValue({
      ok: false,
      error: "This offer has ended. It can no longer be accepted.",
      status: 409,
      errorCode: "offer_window_ended",
    });
    open();
    tick();
    fireEvent.click(acceptButton());
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/bids/offers/${ID}?late=1`));
  });

  it("says the total changed, unticks the box and reloads with the new total", async () => {
    accept.mockResolvedValue({
      ok: false,
      error:
        "The total for this lot has changed since you opened this page. Nothing has been charged. Check the new total and accept again if you still wish to buy.",
      status: 409,
      errorCode: "price_changed",
    });
    open();
    tick();
    fireEvent.click(acceptButton());
    expect(await screen.findByText("The total has changed")).toBeTruthy();
    expect(screen.getByText(/has changed since you opened this page/)).toBeTruthy();
    expect(router.refresh).toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    // The new total needs its own yes.
    expect(screen.getByRole("checkbox").getAttribute("aria-checked")).toBe("false");
    expect(acceptButton().getAttribute("aria-disabled")).toBe("true");
  });

  it("reloads with the reason when the offer moved on for another cause", async () => {
    accept.mockResolvedValue({
      ok: false,
      error: "This lot is no longer available. Nothing has been charged.",
      status: 409,
      errorCode: "lot_has_buyer",
    });
    open();
    tick();
    fireEvent.click(acceptButton());
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(notify.error).toHaveBeenCalledWith(expect.stringContaining("no longer available"));
  });

  it("asks before declining, and sends the optional reason", async () => {
    decline.mockResolvedValue({ ok: true });
    open();
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(await screen.findByText("Decline this offer?")).toBeTruthy();
    expect(screen.getByText("The Winter Study won't be offered to you again.")).toBeTruthy();
    expect(decline).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Anything you'd like to tell us/), {
      target: { value: "Over budget now" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Yes, decline" }));
    await waitFor(() => expect(decline).toHaveBeenCalledWith(ID, { reason: "Over budget now" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(notify.success).toHaveBeenCalledWith("Your answer was sent");
  });

  it("does not decline when the sheet is closed with Back", async () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    fireEvent.click(await screen.findByRole("button", { name: "Back" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(decline).not.toHaveBeenCalled();
  });
});
