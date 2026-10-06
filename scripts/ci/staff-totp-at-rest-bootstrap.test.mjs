import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import { parseAuthDekKey } from "../../packages/auth/src/crypto/dek.ts";
import { createEnvelopeCrypto } from "../../packages/auth/src/crypto/envelope.ts";

test("staff TOTP bootstrap round-trips Better Auth + DEK layers", async () => {
  const authSecret = "ci-auth-secret-at-least-sixteen-characters";
  const envelope = createEnvelopeCrypto(parseAuthDekKey(randomBytes(32).toString("hex")));
  const totpSecret = randomBytes(20).toString("hex");
  const sealed = envelope.seal(await symmetricEncrypt({ key: authSecret, data: totpSecret }));
  const opened = await symmetricDecrypt({
    key: authSecret,
    data: envelope.open(sealed),
  });
  assert.equal(opened, totpSecret);
});
