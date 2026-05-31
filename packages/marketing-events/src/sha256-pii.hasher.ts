import { createHash } from "node:crypto";
import { phoneDigitsForPiiHash } from "@auction/validators";
import type { IPiiHasher } from "./interfaces/pii-hasher.js";

function normalizeEmail(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.indexOf("@");
  if (at < 0) return e;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (domain === "gmail.com" || domain === "googlemail.com") {
    const plus = local.indexOf("+");
    const base = (plus >= 0 ? local.slice(0, plus) : local).replace(/\./g, "");
    return `${base}@${domain}`;
  }
  return e;
}

function normalizePhone(phone: string): string {
  return phoneDigitsForPiiHash(phone);
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export class Sha256PiiHasher implements IPiiHasher {
  hashEmail(value: string): string {
    return sha256Hex(normalizeEmail(value));
  }

  hashPhone(value: string): string {
    return sha256Hex(normalizePhone(value));
  }

  hashName(value: string): string {
    return sha256Hex(normalizeName(value));
  }

  hashExternalId(value: string): string {
    return sha256Hex(value.trim());
  }
}
