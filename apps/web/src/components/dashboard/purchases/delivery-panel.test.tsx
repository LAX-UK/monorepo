import type { DeliveryPanelVm } from "@/lib/purchases/purchase-delivery.vm";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const requestQuote = vi.fn();
const saveAddress = vi.fn();
vi.mock("@/lib/purchases/purchase.actions", () => ({
  requestDeliveryQuoteAction: (...args: unknown[]) => requestQuote(...args),
  saveDeliveryAddressAction: (...args: unknown[]) => saveAddress(...args),
  acceptDeliveryQuoteAction: vi.fn(),
  withdrawDeliveryQuoteAction: vi.fn(),
}));

import { DeliveryPanel } from "./delivery-panel";

const STORE = {
  id: "a1",
  label: "Gallery store",
  detail: "14 Riverside Walk, London, SE1 9PP, United Kingdom",
};
const HOME = { id: "a2", label: "Home", detail: "9 Elm Road, Bath, BA1 1AA, United Kingdom" };

function panel(addresses: { id: string; label: string; detail: string }[]): DeliveryPanelVm {
  return { kind: "choose", beforePayment: true, collection: null, addresses };
}

const renderPanel = (addresses: { id: string; label: string; detail: string }[]) =>
  render(<DeliveryPanel lotId="lot-1" panel={panel(addresses)} shipperEmail="hello@lax.bid" />);

beforeEach(() => {
  vi.clearAllMocks();
  requestQuote.mockResolvedValue({ ok: true });
});

describe("delivery address picker", () => {
  it("asks for a first address when none is saved, and holds the quote until there is one", () => {
    renderPanel([]);
    expect(screen.getByText("No saved addresses yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add an address" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask for a quote" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("preselects the only address and asks for the quote to it", async () => {
    renderPanel([STORE]);
    expect(screen.getByRole("radio", { name: /Gallery store/ })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Ask for a quote" }));
    await waitFor(() => expect(requestQuote).toHaveBeenCalledWith("lot-1", STORE.detail));
  });

  it("lets the payer choose between several", async () => {
    renderPanel([STORE, HOME]);
    fireEvent.click(screen.getByRole("radio", { name: /Home/ }));
    fireEvent.click(screen.getByRole("button", { name: "Ask for a quote" }));
    await waitFor(() => expect(requestQuote).toHaveBeenCalledWith("lot-1", HOME.detail));
  });

  it("adds an address in a dialog, checks it, and picks it once saved", async () => {
    saveAddress.mockResolvedValue({
      ok: true,
      address: {
        id: "a3",
        label: "Studio",
        detail: "3 Quay Street, Bristol, BS1 4DJ, United Kingdom",
      },
    });
    renderPanel([STORE]);
    fireEvent.click(screen.getByRole("button", { name: "Add an address" }));
    fireEvent.click(screen.getByRole("button", { name: "Save address" }));
    expect(await screen.findByText("Enter the first line of the address.")).toBeInTheDocument();
    expect(saveAddress).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Studio" } });
    fireEvent.change(screen.getByLabelText("Address line 1"), {
      target: { value: "3 Quay Street" },
    });
    fireEvent.change(screen.getByLabelText("Town or city"), { target: { value: "Bristol" } });
    fireEvent.change(screen.getByLabelText("Postcode"), { target: { value: "BS1 4DJ" } });
    fireEvent.click(screen.getByRole("button", { name: "Save address" }));
    await waitFor(() => expect(screen.getByRole("radio", { name: /Studio/ })).toBeChecked());
    expect(saveAddress).toHaveBeenCalledWith(
      "Studio",
      expect.objectContaining({ line1: "3 Quay Street", city: "Bristol", country: "GB" }),
    );
  });

  it("says why a refused request failed and keeps the choice", async () => {
    requestQuote.mockResolvedValue({
      ok: false,
      message: "Your role doesn't arrange delivery for this account.",
    });
    renderPanel([STORE]);
    fireEvent.click(screen.getByRole("button", { name: "Ask for a quote" }));
    expect(
      await screen.findByText("Your role doesn't arrange delivery for this account."),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Gallery store/ })).toBeChecked();
  });
});
