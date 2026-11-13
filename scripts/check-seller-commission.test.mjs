import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import {
  PAYMENT_RAISING_FILES,
  SELLER_PAYING_FILES,
  findFlatFivePercent,
  findHammerTimesRate,
  findOldFeePolicy,
} from "./check-seller-commission.mjs";

test("flags a hammer multiplied by a commission rate, in either order", () => {
  for (const code of [
    "const fee = hammerPence * commissionBps / 10000;",
    "const fee = Math.round(commissionBps * hammerPence);",
    "const c = lot.hammer * agreement.commissionRate;",
    "const c = (hammerMinor * sellerBps) / 10_000;",
  ]) {
    assert.equal(findHammerTimesRate(`ok\n${code}\n`).length, 1, code);
  }
});

test("reports the line number", () => {
  assert.deepEqual(findHammerTimesRate("a\nconst c = hammerPence * commissionBps;\n"), [
    { line: 2, text: "const c = hammerPence * commissionBps;" },
  ]);
});

test("accepts a hammer multiplied by something that is not a commission", () => {
  for (const code of [
    "const premium = hammerPence * premiumRate;",
    "const total = hammerPence * quantity;",
    "const vat = commissionPence * vatBps;",
    "const pence = hammer * 100;",
  ]) {
    assert.deepEqual(findHammerTimesRate(code), [], code);
  }
});

test("ignores comments that describe the rule", () => {
  assert.deepEqual(
    findHammerTimesRate("// commission = hammer * commissionBps\n * hammer * bps"),
    [],
  );
});

test("flags the old platform fee policy", () => {
  assert.equal(
    findOldFeePolicy('import { PlatformFeePolicy } from "@auction/finance-runtime";').length,
    1,
  );
  assert.equal(findOldFeePolicy('import type { X } from "./platform-fee.policy.js";').length, 1);
  assert.deepEqual(findOldFeePolicy("const sellerTerms = policy.snapshotFor(x);"), []);
});

test("flags the old flat 5% fallback on a money figure, in either order", () => {
  for (const code of [
    "const fee = Math.round(amountPence * 0.05);",
    "const fee = Math.round(0.05 * lot.hammerPence);",
    "const fee = totalMinor * .05;",
  ]) {
    assert.equal(findFlatFivePercent(code).length, 1, code);
  }
});

test("accepts 0.05 that is not a share of money", () => {
  for (const code of [
    "tracesSampleRate: 0.05,",
    "return (lighter + 0.05) / (darker + 0.05);",
    "const step = zoom * 0.05;",
    "const fee = amountPence * 0.055;",
  ]) {
    assert.deepEqual(findFlatFivePercent(code), [], code);
  }
});

test("guards files that exist: settlement and refunds never read the old fee policy", () => {
  for (const path of [...PAYMENT_RAISING_FILES, ...SELLER_PAYING_FILES]) {
    assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), path);
  }
});
