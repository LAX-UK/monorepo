import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import { describe, expect, it } from "vitest";
import { createEnvelopeCrypto } from "./crypto/envelope.js";

/** Documents CI bootstrap shape: Better Auth inner encrypt, then DEK envelope seal. */
describe("two-factor at-rest bootstrap", () => {
  it("opens sealed rows the same way verify-totp reads them", async () => {
    const authSecret = "ci-auth-secret-at-least-sixteen-characters";
    const envelope = createEnvelopeCrypto(Buffer.alloc(32, 9));
    const totpSecret = "0123456789ABCDEFGHIJKLMNOPQRSTUV";
    const backupJson = JSON.stringify(["ABCDE-12345"]);

    const sealedSecret = envelope.seal(
      await symmetricEncrypt({ key: authSecret, data: totpSecret }),
    );
    const sealedBackup = envelope.seal(
      await symmetricEncrypt({ key: authSecret, data: backupJson }),
    );

    expect(sealedSecret.startsWith("v1:")).toBe(true);
    expect(sealedBackup.startsWith("v1:")).toBe(true);

    const openedSecret = await symmetricDecrypt({
      key: authSecret,
      data: envelope.open(sealedSecret),
    });
    const openedBackup = await symmetricDecrypt({
      key: authSecret,
      data: envelope.open(sealedBackup),
    });

    expect(openedSecret).toBe(totpSecret);
    expect(JSON.parse(openedBackup)).toEqual(["ABCDE-12345"]);
  });
});
