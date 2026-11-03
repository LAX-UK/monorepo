import { enquiryIntakeSchema } from "@auction/validators";
import { describe, expect, it } from "vitest";
import { toEnquiryPayload } from "./enquiry-payload";
import { type EnquiryFormValues, emptyEnquiryValues } from "./enquiry-values";

const sell: EnquiryFormValues = {
  ...emptyEnquiryValues("sell"),
  departmentSlug: "paintings",
  artist: "  Iris Calder ",
  title: "Low tide at Maldon",
  mediumSize: "Oil on board, 61 × 76 cm",
  location: "London, UK",
  price: "45,000",
  name: "Daniel Price",
  email: "daniel.price@example.com",
  phone: "07700 900123",
  contactPreference: "either",
  notes: "Signed on the back.",
  marketingOptIn: true,
};

const buy: EnquiryFormValues = {
  ...emptyEnquiryValues("buy"),
  lookingFor: "A mid-century British landscape",
  budgetBand: "10000_to_50000",
  timing: "within_3_months",
  notes: "For a boardroom.",
  name: "Charlotte Hale",
  email: "charlotte@marlow.example",
};

describe("toEnquiryPayload, selling", () => {
  it("sends the structured seller payload with the price in pence", () => {
    const payload = toEnquiryPayload(sell, {
      uploadIds: ["a", "b"],
      draftToken: "tok",
      legalEntityId: undefined,
    });
    expect(payload).toEqual({
      intent: "private_sale_sell",
      name: "Daniel Price",
      email: "daniel.price@example.com",
      phone: "07700 900123",
      contactPreference: "either",
      marketingOptIn: true,
      departmentSlug: "paintings",
      artist: "Iris Calder",
      title: "Low tide at Maldon",
      medium: "Oil on board, 61 × 76 cm",
      locationTown: "London",
      locationCountry: "UK",
      priceInMindMinor: 4_500_000,
      message: "Signed on the back.",
      uploadIds: ["a", "b"],
      draftToken: "tok",
    });
  });

  it("leaves out what was not given: no price when the seller is not sure, no empty optional fields", () => {
    const payload = toEnquiryPayload(
      { ...sell, priceNotSure: true, mediumSize: " ", phone: "", notes: "" },
      { uploadIds: [] },
    );
    expect(payload).not.toHaveProperty("priceInMindMinor");
    expect(payload).not.toHaveProperty("medium");
    expect(payload).not.toHaveProperty("phone");
    expect(payload).not.toHaveProperty("message");
    expect(payload).not.toHaveProperty("draftToken");
  });

  it("is accepted by the API's contract", () => {
    const payload = toEnquiryPayload(sell, {
      uploadIds: ["6f1c2f60-6a0a-4a53-9a2a-1c9f8f0e9a11"],
      draftToken: "tok.sig",
    });
    expect(enquiryIntakeSchema.safeParse(payload).success).toBe(true);
  });
});

describe("toEnquiryPayload, buying", () => {
  it("sends the structured buyer payload, for the organisation when one is chosen", () => {
    const entity = "6f1c2f60-6a0a-4a53-9a2a-1c9f8f0e9a11";
    const payload = toEnquiryPayload(buy, { uploadIds: [], legalEntityId: entity });
    expect(payload).toEqual({
      intent: "private_sale_buy",
      name: "Charlotte Hale",
      email: "charlotte@marlow.example",
      contactPreference: "email",
      marketingOptIn: false,
      lookingFor: "A mid-century British landscape",
      budgetBand: "10000_to_50000",
      timing: "within_3_months",
      message: "For a boardroom.",
      legalEntityId: entity,
    });
    expect(enquiryIntakeSchema.safeParse(payload).success).toBe(true);
  });

  it("sends no files and no draft: only a seller attaches them", () => {
    const payload = toEnquiryPayload(buy, { uploadIds: ["a"], draftToken: "tok" });
    expect(payload).not.toHaveProperty("uploadIds");
    expect(payload).not.toHaveProperty("draftToken");
  });
});
