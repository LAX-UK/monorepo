import {
  DOMAIN_EVENT_SMOKE_GATES,
  DOMAIN_EVENT_SMOKE_GATE_SUITE_MAP,
} from "@auction/background-runtime";
import { describe, expect, it } from "vitest";

describe("DOMAIN_EVENT_SMOKE_GATES", () => {
  it("documents a suite mapping for every gate", () => {
    for (const gate of DOMAIN_EVENT_SMOKE_GATES) {
      expect(DOMAIN_EVENT_SMOKE_GATE_SUITE_MAP[gate], `missing suite for ${gate}`).toBeTruthy();
    }
  });
});
