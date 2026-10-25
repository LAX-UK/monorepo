/** @vitest-environment jsdom */
import { startCheckout } from "@/app/actions/checkout.actions";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { presentCheckoutDeliveryOptions } from "@/lib/checkout/checkout-delivery";
import type { BasketView } from "@auction/shop-contracts";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/checkout.actions", () => ({ startCheckout: vi.fn() }));
vi.mock("next/image", () => ({ default: () => null }));

const startMock = vi.mocked(startCheckout);

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

  it("explains that delivery outside the UK is not online yet, with no pay button", () => {
    renderForm();
    fireEvent.click(screen.getByRole("radio", { name: /^Delivery outside the UK/ }));
    screen.getByRole("heading", { name: "Delivery outside the UK is not available online yet" });
    expect(
      screen.getByRole("link", { name: "Contact us about delivery" }).getAttribute("href"),
    ).toBe("/help#contact-us");
    expect(screen.queryByRole("button", { name: "Continue to secure payment" })).toBeNull();
  });
});
