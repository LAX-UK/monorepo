import { describe, expect, it } from "vitest";
import { readPayTransferResponse } from "./pay-transfer-read";

const DETAILS = {
  accountName: "London Auction Xchange LTD",
  sortCode: "231470",
  accountNumber: "41926638",
  reference: "LAXB7KQ2R9",
};

describe("readPayTransferResponse", () => {
  it("reads the details the API sent", () => {
    expect(readPayTransferResponse(200, { data: { instructions: DETAILS } })).toEqual(DETAILS);
  });

  it("has nothing to show when no transfer is waiting", () => {
    expect(readPayTransferResponse(200, { data: { instructions: null } })).toBeNull();
  });

  it.each([
    ["a failed request", 503, { error: "pay_plan_unavailable" }],
    ["a refusal", 403, { error: "insufficient_entity_role" }],
    ["an answer that is not the details", 200, { data: { instructions: { sortCode: "1" } } }],
    ["no answer", 200, null],
    ["an empty reference", 200, { data: { instructions: { ...DETAILS, reference: "" } } }],
  ])("has nothing to show for %s", (_name, status, body) => {
    expect(readPayTransferResponse(status, body)).toBeNull();
  });
});
