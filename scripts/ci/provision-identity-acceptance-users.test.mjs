import assert from "node:assert/strict";
import test from "node:test";
import { deriveAcceptanceEmail } from "./provision-identity-acceptance-users.mjs";

test("derives stable isolated acceptance aliases", () => {
  assert.equal(
    deriveAcceptanceEmail("Acceptance+old@example.com", "bid"),
    "acceptance+lax-bid-acceptance@example.com",
  );
});

test("rejects invalid source email", () => {
  assert.throws(
    () => deriveAcceptanceEmail("not-an-email", "bid"),
    /must be a valid email address/,
  );
});
