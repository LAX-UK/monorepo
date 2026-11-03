import { describe, expect, it } from "vitest";
import {
  deriveLegacyEnquiryIntent,
  isPrivateSaleEnquiryIntent,
} from "./marketing-enquiry-vocabulary.js";

describe("deriveLegacyEnquiryIntent", () => {
  it.each([
    ["selling", "Private sale enquiry\n\nA Hockney drawing", "private_sale_sell"],
    ["buying", "Private sale enquiry\n\nLooking for a Riley", "private_sale_buy"],
    ["selling", "I have a work to sell", "selling"],
    ["press", "A question for the press office", "press"],
    ["shipping", "Where is my parcel", "shipping"],
    ["buying", "How do I bid", "buying"],
    ["other", "Something else entirely", "general"],
  ])("reads topic %s and message %j as %s", (topic, message, intent) => {
    expect(deriveLegacyEnquiryIntent({ topic, message })).toBe(intent);
  });

  it("only treats the two private sale paths as private", () => {
    expect(isPrivateSaleEnquiryIntent("private_sale_sell")).toBe(true);
    expect(isPrivateSaleEnquiryIntent("private_sale_buy")).toBe(true);
    expect(isPrivateSaleEnquiryIntent("selling")).toBe(false);
  });
});
