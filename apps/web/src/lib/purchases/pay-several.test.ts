import { describe, expect, it } from "vitest";
import {
  PAY_SEVERAL_BLOCK_COPY,
  PAY_SEVERAL_SKIP_COPY,
  PAY_SEVERAL_START_COPY,
} from "./pay-several";

describe("pay several copy", () => {
  it("says why each left-out invoice is not in the payment", () => {
    expect(PAY_SEVERAL_SKIP_COPY.held_for_review).toBe("Held while we review a payment");
    expect(PAY_SEVERAL_SKIP_COPY.being_paid).toBe("A payment for it is already in progress");
    for (const line of Object.values(PAY_SEVERAL_SKIP_COPY)) expect(line).not.toMatch(/_/);
  });

  it("explains every refusal of the payment in the payer's words, never the code", () => {
    expect(PAY_SEVERAL_START_COPY.pay_several_over_limit).toBe(PAY_SEVERAL_BLOCK_COPY.over_limit);
    for (const line of Object.values(PAY_SEVERAL_START_COPY)) {
      expect(line).not.toMatch(/pay_several|_/);
    }
  });
});
