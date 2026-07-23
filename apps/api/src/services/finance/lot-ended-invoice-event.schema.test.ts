import { describe, expect, it } from "vitest";
import { parseLotEndedInvoiceEventPayload } from "./lot-ended-invoice-event.schema.js";

describe("lotEndedInvoiceEventPayloadSchema", () => {
  it("accepts sold lot with winner", () => {
    expect(
      parseLotEndedInvoiceEventPayload({
        outcome: "sold",
        winnerId: "550e8400-e29b-41d4-a716-446655440000",
      }),
    ).toEqual({
      outcome: "sold",
      winnerId: "550e8400-e29b-41d4-a716-446655440000",
    });
  });

  it("defaults empty payload", () => {
    expect(parseLotEndedInvoiceEventPayload(null)).toEqual({});
  });
});
