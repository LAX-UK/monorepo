import { describe, expect, it } from "vitest";
import { followSwitch } from "./switch-navigation";

describe("followSwitch", () => {
  it("only refreshes when the person is already on the destination", () => {
    expect(followSwitch("/home", "/home")).toBe("refresh");
  });

  it("goes to the destination from another page", () => {
    expect(followSwitch("/organisation/members", "/home")).toBe("push");
  });

  it("goes to a destination that carries a query", () => {
    expect(followSwitch("/bids", "/bids?tab=won")).toBe("push");
  });
});
