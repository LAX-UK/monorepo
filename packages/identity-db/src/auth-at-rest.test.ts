import { createEnvelopeCrypto, hashOpaqueToken } from "@auction/identity-contracts";
import { describe, expect, it } from "vitest";
import { type AuthAtRestQueryable, verifyAuthAtRestStorage } from "./auth-at-rest.js";

function storageWith(input: {
  accountAccessToken?: string;
  oauthAccessToken?: string;
  pendingAccount?: number;
}): AuthAtRestQueryable {
  return {
    query: async <T>(sql: string) => {
      if (sql.includes("count(*)")) {
        const count = sql.includes('from "account"') ? (input.pendingAccount ?? 0) : 0;
        return { rows: [{ count }] as T[] };
      }
      if (sql.includes('from "account"') && input.accountAccessToken !== undefined) {
        return {
          rows: [
            {
              id: "account-1",
              access_token: input.accountAccessToken,
              refresh_token: null,
              id_token: null,
            },
          ] as T[],
        };
      }
      if (sql.includes('from "oauth_access_token"') && input.oauthAccessToken) {
        return {
          rows: [
            {
              id: "oauth-1",
              access_token: input.oauthAccessToken,
              refresh_token: hashOpaqueToken("refresh"),
              refresh_token_hash: null,
            },
          ] as T[],
        };
      }
      return { rows: [] as T[] };
    },
  };
}

describe("verifyAuthAtRestStorage", () => {
  it("accepts values encrypted by the active key", async () => {
    const crypto = createEnvelopeCrypto(Buffer.alloc(32, 1));
    await expect(
      verifyAuthAtRestStorage(storageWith({ accountAccessToken: crypto.seal("access") }), crypto),
    ).resolves.toBeUndefined();
  });

  it("accepts fingerprinted OAuth tokens that have not been refreshed yet", async () => {
    // Better Auth issues oauth_access_token rows with refresh_token_hash null until
    // the rotation repository sees the first refresh. That is the steady state of
    // every freshly issued token and must not fail startup or maintenance.
    const crypto = createEnvelopeCrypto(Buffer.alloc(32, 1));
    await expect(
      verifyAuthAtRestStorage(storageWith({ oauthAccessToken: hashOpaqueToken("access") }), crypto),
    ).resolves.toBeUndefined();
  });

  it("rejects pending plaintext, wrong-key envelopes, and malformed fingerprints", async () => {
    const crypto = createEnvelopeCrypto(Buffer.alloc(32, 1));
    await expect(
      verifyAuthAtRestStorage(storageWith({ pendingAccount: 1 }), crypto),
    ).rejects.toThrow("auth_at_rest_verify_failed");

    const otherCrypto = createEnvelopeCrypto(Buffer.alloc(32, 2));
    await expect(
      verifyAuthAtRestStorage(
        storageWith({ accountAccessToken: crypto.seal("access") }),
        otherCrypto,
      ),
    ).rejects.toThrow("auth_at_rest_malformed_envelope");

    await expect(
      verifyAuthAtRestStorage(storageWith({ oauthAccessToken: "h1:short" }), crypto),
    ).rejects.toThrow("auth_at_rest_malformed_token_fingerprint");
  });
});
