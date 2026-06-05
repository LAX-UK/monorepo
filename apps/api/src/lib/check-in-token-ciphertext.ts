import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const SALT = "onsite-event-check-in-token-v1";

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, SALT, 32);
}

export function encryptCheckInToken(plainToken: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plainToken, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${enc.toString("base64url")}`;
}

export function decryptCheckInToken(ciphertext: string, secret: string): string | null {
  try {
    const parts = ciphertext.split(":");
    if (parts.length !== 4 || parts[0] !== "v1") return null;
    const ivB64 = parts[1];
    const tagB64 = parts[2];
    const dataB64 = parts[3];
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const key = deriveKey(secret);
    const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    return plain || null;
  } catch {
    return null;
  }
}
