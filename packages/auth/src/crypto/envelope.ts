import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION_PREFIX = "v1:";

export type EnvelopeCrypto = {
  seal(plaintext: string): string;
  open(sealed: string): string;
};

/** AES-256-GCM; ciphertext format `v1:` + base64url(iv(12) || tag(16) || cipher). */
export function createEnvelopeCrypto(dek: Buffer): EnvelopeCrypto {
  if (dek.length !== 32) {
    throw new Error("createEnvelopeCrypto: DEK must be 32 bytes (AES-256)");
  }

  return {
    seal(plaintext: string): string {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", dek, iv);
      const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      const tag = cipher.getAuthTag();
      const packed = Buffer.concat([iv, tag, enc]);
      return `${VERSION_PREFIX}${packed.toString("base64url")}`;
    },
    open(sealed: string): string {
      if (!sealed.startsWith(VERSION_PREFIX)) {
        // Plaintext passthrough — expected during initial rollout before all rows
        // are back-filled.  If you see this frequently AFTER full migration it
        // indicates a field that was never encrypted and warrants investigation.
        return sealed;
      }
      const raw = Buffer.from(sealed.slice(VERSION_PREFIX.length), "base64url");
      if (raw.length < 12 + 16 + 1) {
        throw new Error("envelope: truncated payload");
      }
      const iv = raw.subarray(0, 12);
      const tag = raw.subarray(12, 28);
      const enc = raw.subarray(28);
      const decipher = createDecipheriv("aes-256-gcm", dek, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
    },
  };
}
