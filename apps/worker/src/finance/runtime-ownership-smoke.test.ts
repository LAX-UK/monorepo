import {
  RUNTIME_OWNERSHIP_SMOKE_GATES,
  RUNTIME_OWNERSHIP_SMOKE_GATE_SUITE_MAP,
} from "@auction/background-runtime";
import { describe, expect, it } from "vitest";

describe("RUNTIME_OWNERSHIP_SMOKE_GATES", () => {
  it("documents a suite mapping for every gate", () => {
    for (const gate of RUNTIME_OWNERSHIP_SMOKE_GATES) {
      expect(
        RUNTIME_OWNERSHIP_SMOKE_GATE_SUITE_MAP[gate],
        `missing suite for ${gate}`,
      ).toBeTruthy();
    }
  });

  it("maps settlement.bulk_payout to substantive parity suite", () => {
    expect(RUNTIME_OWNERSHIP_SMOKE_GATE_SUITE_MAP["settlement.bulk_payout"]).toContain(
      "payout-bulk-settlement-parity",
    );
  });
});
