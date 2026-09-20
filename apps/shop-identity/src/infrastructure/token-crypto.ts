import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type TokenCipher = {
  seal(plaintext: string): string;
  open(sealed: string): string | null;
};

function parseEncryptionKey(raw: string): Buffer {
  const key = /^[a-f\d]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64url");
  if (key.length !== 32) {
    throw new Error("SHOP_IDENTITY_TOKEN_ENCRYPTION_KEY must encode exactly 32 bytes");
  }
  return key;
}

export function createTokenCipher(rawKey: string): TokenCipher {
  const key = parseEncryptionKey(rawKey);
  return {
    seal(plaintext: string): string {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
    },
    open(sealed: string): string | null {
      try {
        const [version, iv, tag, ciphertext] = sealed.split(".");
        if (version !== "v1" || !iv || !tag || !ciphertext) return null;
        const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
        decipher.setAuthTag(Buffer.from(tag, "base64url"));
        const plaintext = Buffer.concat([
          decipher.update(Buffer.from(ciphertext, "base64url")),
          decipher.final(),
        ]).toString("utf8");
        return plaintext;
      } catch {
        return null;
      }
    },
  };
}
