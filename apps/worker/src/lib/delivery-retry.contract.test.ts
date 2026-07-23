import { DomainEventContractError } from "@auction/types";
import { describe, expect, it } from "vitest";
import { classifyDeliveryError } from "./delivery-retry.js";

describe("classifyDeliveryError", () => {
  it("treats domain event contract violations as fatal", () => {
    expect(classifyDeliveryError(new DomainEventContractError("payment.captured", "invalid"))).toBe(
      "fatal",
    );
  });
});
