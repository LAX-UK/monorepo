import { describe, expect, it } from "vitest";
import type { ExpressRate } from "./express-checkout-api";
import {
  WALLET_MESSAGES,
  type WalletConfirmEvent,
  readWalletConfirm,
  walletAddressChange,
  walletRateId,
} from "./express-checkout-wallet";

const rates: ExpressRate[] = [
  { id: "uk_insured_delivery", displayName: "Insured UK delivery", amountPence: 1_500 },
  { id: "collect_new_cavendish", displayName: "Collect from our London gallery", amountPence: 0 },
];

const delivery: WalletConfirmEvent = {
  billingDetails: { name: "Grace Hopper", email: "grace@example.com", phone: "+447700900123" },
  shippingAddress: {
    name: "Grace Hopper",
    address: {
      line1: "1 New Cavendish Street",
      line2: "",
      city: "London",
      postal_code: "w1g8ur",
      country: "GB",
    },
  },
  shippingRate: { id: "shr_1", displayName: "Insured UK delivery", amount: 1_500 },
};

describe("wallet events", () => {
  it("sends only the country, postcode and town of an address change", () => {
    expect(
      walletAddressChange({ address: { country: "gb", postal_code: " W1G ", city: "London" } }),
    ).toEqual({ country: "GB", postcode: "W1G", city: "London" });
    expect(walletAddressChange({ address: { country: "FR" } })).toEqual({ country: "FR" });
    expect(walletAddressChange({})).toEqual({ country: "" });
  });

  it("matches the chosen rate by the Shop's name, then by a unique price", () => {
    expect(walletRateId({ id: "shr_x", displayName: "Insured UK delivery" }, rates)).toBe(
      "uk_insured_delivery",
    );
    expect(walletRateId({ id: "shr_y", displayName: "Renamed", amount: 0 }, rates)).toBe(
      "collect_new_cavendish",
    );
    expect(walletRateId({ id: "shr_z", displayName: "Other", amount: 999 }, rates)).toBeNull();
    expect(walletRateId(null, rates)).toBeNull();
  });

  it("reads a delivery confirm into the Shop's request, with a normalised postcode", () => {
    expect(readWalletConfirm(delivery, rates, { requireEmail: true })).toEqual({
      kind: "ok",
      payload: {
        shippingRateId: "uk_insured_delivery",
        name: "Grace Hopper",
        phone: "+447700900123",
        email: "grace@example.com",
        shippingAddress: {
          recipientName: "Grace Hopper",
          line1: "1 New Cavendish Street",
          city: "London",
          postcode: "W1G 8UR",
          country: "GB",
        },
      },
    });
  });

  it("sends no email for a signed-in shopper", () => {
    const reading = readWalletConfirm(delivery, rates, { requireEmail: false });
    expect(reading.kind === "ok" && "email" in reading.payload).toBe(false);
  });

  it("needs a phone for insured delivery but not for collection", () => {
    const noPhone = { ...delivery, billingDetails: { ...delivery.billingDetails, phone: null } };
    expect(readWalletConfirm(noPhone, rates, { requireEmail: false })).toEqual({
      kind: "invalid",
      message: WALLET_MESSAGES.phone,
    });
    const collection = {
      ...noPhone,
      shippingRate: { id: "shr_2", displayName: "Collect from our London gallery", amount: 0 },
    };
    const reading = readWalletConfirm(collection, rates, { requireEmail: false });
    expect(reading.kind).toBe("ok");
    expect(reading.kind === "ok" && reading.payload.shippingRateId).toBe("collect_new_cavendish");
  });

  it("refuses a guest without an email, a missing name and a non-UK address", () => {
    const noEmail = { ...delivery, billingDetails: { ...delivery.billingDetails, email: "" } };
    expect(readWalletConfirm(noEmail, rates, { requireEmail: true })).toEqual({
      kind: "invalid",
      message: WALLET_MESSAGES.email,
    });
    const noName = {
      ...delivery,
      billingDetails: { ...delivery.billingDetails, name: " " },
      shippingAddress: { ...delivery.shippingAddress, name: null },
    };
    expect(readWalletConfirm(noName, rates, { requireEmail: false })).toEqual({
      kind: "invalid",
      message: WALLET_MESSAGES.name,
    });
    const abroad = {
      ...delivery,
      shippingAddress: {
        name: "Anna",
        address: {
          line1: "Friedrichstrasse 12",
          city: "Berlin",
          postal_code: "10117",
          country: "DE",
        },
      },
    };
    expect(readWalletConfirm(abroad, rates, { requireEmail: false })).toEqual({
      kind: "invalid",
      message: WALLET_MESSAGES.address,
    });
  });

  it("refuses a rate the Shop did not offer", () => {
    const unknown = {
      ...delivery,
      shippingRate: { id: "shr_9", displayName: "Courier", amount: 7 },
    };
    expect(readWalletConfirm(unknown, rates, { requireEmail: false })).toEqual({
      kind: "invalid",
      message: WALLET_MESSAGES.rate,
    });
  });
});
