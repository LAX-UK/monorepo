import { describe, expect, it } from "vitest";
import { lotConnectRequired } from "./connect-readiness-shared";

describe("lotConnectRequired", () => {
  it("reads from record with false default", () => {
    expect(lotConnectRequired({ "lot-1": true }, "lot-1")).toBe(true);
    expect(lotConnectRequired({ "lot-1": true }, "lot-2")).toBe(false);
    expect(lotConnectRequired(undefined, "lot-1")).toBe(false);
  });
});
