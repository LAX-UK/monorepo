import { describe, expect, it } from "vitest";
import { shopTopBarMessage } from "./shop-top-bar-message";

describe("shopTopBarMessage", () => {
  it("states free gallery collection and the insured delivery charge checkout uses", () => {
    expect(shopTopBarMessage()).toBe(
      "Free collection from our Marylebone gallery · Insured UK delivery £15",
    );
  });
});
