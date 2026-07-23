import { describe, expect, it } from "vitest";
import { LotLifecycleService, TimedLotTransitionRunner } from "./index.js";

describe("@auction/lot-lifecycle-app exports", () => {
  it("exposes lifecycle service entrypoints", () => {
    expect(LotLifecycleService).toBeTypeOf("function");
    expect(TimedLotTransitionRunner).toBeTypeOf("function");
  });
});
