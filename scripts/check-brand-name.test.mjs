import assert from "node:assert/strict";
import { test } from "node:test";
import { findWrongBrandName } from "./check-brand-name.mjs";

test("flags the upper-case dotted name with its line", () => {
  const hits = findWrongBrandName("fine\nSelling with LAX.BID\n");
  assert.deepEqual(hits, [{ line: 2, text: "Selling with LAX.BID" }]);
});

test("accepts the product name and the lower-case domain", () => {
  assert.deepEqual(findWrongBrandName("Selling with LAX Bid at https://lax.bid/sell"), []);
});
