import { symmetricEncrypt } from "better-auth/crypto";

/**
 * Applies the same inner encryption Better Auth's jwt plugin applies before it
 * hands a new key to the JWKS adapter: the private JWK is encrypted with the
 * auth secret and the ciphertext is stored JSON-encoded. The adapter then seals
 * that value with the DEK envelope. Better Auth reads keys back by decrypting
 * with the auth secret, so a key stored without this step cannot be used to sign.
 */
export async function encryptPrivateKeyForBetterAuth(input: {
  privateJwkJson: string;
  authSecret: string;
}): Promise<string> {
  return JSON.stringify(
    await symmetricEncrypt({ key: input.authSecret, data: input.privateJwkJson }),
  );
}
