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

test("keeps a run alias within 64 characters before the @", () => {
  const email = deriveAcceptanceEmail(
    "identity.acceptance@example.com",
    "refresh",
    "19012345678-1-live-contracts",
  );
  const local = email.slice(0, email.lastIndexOf("@"));
  assert.ok(local.length <= 64, `local part is ${local.length} characters`);
  assert.match(email, /^identity\.acceptance\+lax-refresh-[0-9a-f]{12}@example\.com$/);
  assert.notEqual(
    email,
    deriveAcceptanceEmail(
      "identity.acceptance@example.com",
      "refresh",
      "19012345678-2-live-contracts",
    ),
  );
});

test("keeps the readable run alias when it fits", () => {
  assert.equal(
    deriveAcceptanceEmail("qa@example.com", "bid", "123-1-job"),
    "qa+lax-bid-acceptance-123-1-job@example.com",
  );
});

test("refuses a mailbox too long for any run alias", () => {
  assert.throws(
    () => deriveAcceptanceEmail(`${"a".repeat(60)}@example.com`, "bid", "1-1-job"),
    /too long for a run alias/,
  );
});
