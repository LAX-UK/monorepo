/** @vitest-environment jsdom */
import { startCheckout } from "@/app/actions/checkout.actions";
import { requestDeliveryQuote } from "@/app/actions/delivery-quote.actions";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { presentCheckoutDeliveryOptions } from "@/lib/checkout/checkout-delivery";
import type { BasketView } from "@auction/shop-contracts";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/checkout.actions", () => ({ startCheckout: vi.fn() }));
vi.mock("@/app/actions/delivery-quote.actions", () => ({
  requestDeliveryQuote: vi.fn(),
  requestGuestDeliveryQuote: vi.fn(),
}));
vi.mock("next/image", () => ({ default: () => null }));

const startMock = vi.mocked(startCheckout);
const quoteMock = vi.mocked(requestDeliveryQuote);

const basket: BasketView = {
  basketId: "00000000-0000-4000-8000-000000000990",
  lines: [
    {
      lineId: "00000000-0000-4000-8000-000000000001",
      artworkSlug: "warm-basket",
      artworkTitle: "Warm Basket",
      productVariantId: null,
      productSlug: null,
      productTitle: null,
      variantSku: null,
      unitPricePence: 12000,
      quantity: 1,
      soldOut: false,
      priceChanged: false,
      outOfStock: false,
      imageUrl: null,
    },
  ],
  merchandiseSubtotalPence: 12000,
  expiresAt: "2026-12-01T00:00:00.000Z",
};

function renderForm() {
  return render(
    <CheckoutForm
      basket={basket}
      deliveryOptions={presentCheckoutDeliveryOptions({
        now: new Date("2026-10-26T10:00:00Z"),
        times: { ukDelivery: null, collection: null },
      })}
      savedAddresses={[]}
      customerEmail="ada@example.test"
      showTermsNotice
      manageAddressesHref={null}
    />,
  );
}

describe("CheckoutForm", () => {
  afterEach(() => {
    cleanup();
    startMock.mockReset();
    quoteMock.mockReset();
  });

  it("checks the form on submit, summarises the problems and keeps the entry", () => {
    renderForm();
    const submit = screen.getByRole("button", { name: "Continue to secure payment" });
    expect(submit.getAttribute("type")).toBe("submit");
    fireEvent.change(screen.getByRole("textbox", { name: /Full name/ }), {
      target: { value: "Ada Lovelace" },
    });
    fireEvent.click(submit);

    const summary = screen.getByRole("alert", { name: "There is a problem" });
    expect(document.activeElement).toBe(summary);
    expect(screen.getByRole("link", { name: "Enter a postcode" }).getAttribute("href")).toBe(
      "#checkout-postcode",
    );
    expect(screen.getByRole("textbox", { name: /Postcode/ }).getAttribute("aria-invalid")).toBe(
      "true",
    );
    expect((screen.getByRole("textbox", { name: /Full name/ }) as HTMLInputElement).value).toBe(
      "Ada Lovelace",
    );
    expect(startMock).not.toHaveBeenCalled();
  });

  it("clears a field's error as soon as it is fixed", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Continue to secure payment" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Town or city/ }), {
      target: { value: "Leeds" },
    });
    expect(screen.queryByRole("link", { name: "Enter a town or city" })).toBeNull();
    expect(screen.getByRole("textbox", { name: /Town or city/ }).hasAttribute("aria-invalid")).toBe(
      false,
    );
  });

  it("shows a server refusal beside the button without losing anything entered", async () => {
    startMock.mockResolvedValue({ kind: "error", message: "Your basket changed." });
    renderForm();
    const values: Record<string, string> = {
      "Full name": "Ada Lovelace",
      "Address line 1": "1 High Street",
      "Town or city": "London",
      Postcode: "SW1A 1AA",
      "Phone number": "07700 900123",
    };
    for (const [label, value] of Object.entries(values)) {
      fireEvent.change(screen.getByRole("textbox", { name: new RegExp(`^${label}`) }), {
        target: { value },
      });
    }
    fireEvent.click(screen.getByRole("button", { name: "Continue to secure payment" }));
    await waitFor(() => screen.getByText("Your basket changed."));
    expect(startMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fulfilment: "uk_insured_delivery",
        deliveryAddress: expect.objectContaining({ recipientName: "Ada Lovelace" }),
        saveAddress: true,
      }),
    );
    expect((screen.getByRole("textbox", { name: /^Postcode/ }) as HTMLInputElement).value).toBe(
      "SW1A 1AA",
    );
  });

  function chooseOutsideUk() {
    renderForm();
    fireEvent.click(screen.getByRole("radio", { name: /^Delivery outside the UK/ }));
  }

  function fillAbroad(country = "DE") {
    const values: Record<string, string> = {
      "Full name": "Anna Weber",
      "Address line 1": "Friedrichstrasse 12",
      "Town or city": "Berlin",
      "Postal code": "10117",
      "Phone number": "+49 30 1234567",
    };
    for (const [label, value] of Object.entries(values)) {
      fireEvent.change(screen.getByRole("textbox", { name: new RegExp(`^${label}`) }), {
        target: { value },
      });
    }
    fireEvent.change(screen.getByRole("combobox", { name: /^Country/ }), {
      target: { value: country },
    });
  }

  it("asks for an address abroad and offers a quote, not payment", () => {
    chooseOutsideUk();
    screen.getByRole("heading", { name: "Delivery address outside the UK" });
    expect(screen.getByRole("button", { name: "Ask for a delivery quote" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Continue to secure payment" })).toBeNull();
    // Said once, plainly: what is quoted, what is held, and who pays duties.
    screen.getByText(/import duties and taxes where you live/);
    expect(screen.queryByText(/not available online/i)).toBeNull();
  });

  it("summarises every missing part, in page order, and sends nothing", () => {
    chooseOutsideUk();
    fireEvent.click(screen.getByRole("button", { name: "Ask for a delivery quote" }));
    const summary = screen.getByRole("alert", { name: "There is a problem" });
    expect(document.activeElement).toBe(summary);
    for (const message of [
      "Enter the full name of the person receiving the delivery",
      "Enter the first line of the address",
      "Enter a town or city",
      "Enter a postal code",
      "Choose the country",
      "Enter a phone number for the courier",
    ]) {
      expect(screen.getByRole("link", { name: message })).toBeTruthy();
    }
    expect(screen.getByRole("combobox", { name: /^Country/ }).getAttribute("aria-invalid")).toBe(
      "true",
    );
    expect(quoteMock).not.toHaveBeenCalled();
  });

  it("sends the request with the address and shows that the print is held", async () => {
    quoteMock.mockResolvedValue({
      kind: "quote_requested",
      orderReference: "LAX-S-10482",
      holdUntil: "2026-11-16T12:00:00.000Z",
      country: "DE",
      regionId: "eu",
    });
    chooseOutsideUk();
    fillAbroad();
    fireEvent.click(screen.getByRole("button", { name: "Ask for a delivery quote" }));
    await waitFor(() =>
      screen.getByRole("heading", { name: "We have your delivery quote request" }),
    );
    expect(quoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        basketId: basket.basketId,
        deliveryAddress: expect.objectContaining({ country: "DE", city: "Berlin" }),
        deliveryPhone: "+49 30 1234567",
      }),
    );
    screen.getByText("LAX-S-10482");
    screen.getByText("Germany");
    // The one date style, from the hold's end.
    expect(screen.getAllByText("16 November 2026").length).toBeGreaterThan(0);
    expect(document.activeElement?.id).toBe("delivery-quote-sent-heading");
  });

  it("refuses an export-restricted country and suggests collection", async () => {
    quoteMock.mockResolvedValue({ kind: "not_delivered", country: "RU" });
    chooseOutsideUk();
    fillAbroad("RU");
    fireEvent.click(screen.getByRole("button", { name: "Ask for a delivery quote" }));
    await waitFor(() => screen.getByRole("heading", { name: "We cannot deliver to Russia" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Collect from our London gallery instead" }),
    );
    // Back on collection, with the pay button and no leftover refusal.
    screen.getByRole("button", { name: "Continue to secure payment" });
    expect(screen.queryByRole("heading", { name: /We cannot deliver/ })).toBeNull();
  });

  it("shows each address problem the server names, against its field", async () => {
    quoteMock.mockResolvedValue({
      kind: "fields",
      errors: { phone: "Enter a phone number with the country code, like +49 30 1234567" },
    });
    chooseOutsideUk();
    fillAbroad();
    fireEvent.click(screen.getByRole("button", { name: "Ask for a delivery quote" }));
    await waitFor(() =>
      screen.getAllByText("Enter a phone number with the country code, like +49 30 1234567"),
    );
    expect(
      screen.getByRole("textbox", { name: /^Phone number/ }).getAttribute("aria-invalid"),
    ).toBe("true");
  });

  it("keeps everything typed when the request fails, with the message beside the button", async () => {
    quoteMock.mockResolvedValue({
      kind: "error",
      message: "You already have delivery quote requests waiting.",
    });
    chooseOutsideUk();
    fillAbroad();
    fireEvent.click(screen.getByRole("button", { name: "Ask for a delivery quote" }));
    await waitFor(() => screen.getByText("You already have delivery quote requests waiting."));
    expect((screen.getByRole("textbox", { name: /^Town or city/ }) as HTMLInputElement).value).toBe(
      "Berlin",
    );
  });

  it("leaves UK checkout exactly as it was: UK delivery is the starting choice", () => {
    renderForm();
    expect(screen.getByRole("button", { name: "Continue to secure payment" })).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: /^Country/ })).toBeNull();
  });
});
