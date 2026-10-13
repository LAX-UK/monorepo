import { createHmac, timingSafeEqual } from "node:crypto";

export type EditorialPreviewEntity = "venue" | "exhibition" | "story" | "page";

export type EditorialPreviewPayload = {
  entity: EditorialPreviewEntity;
  id: string;
  exp: number;
};

function encodePayload(payload: EditorialPreviewPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(encoded: string): EditorialPreviewPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "entity" in parsed &&
      "id" in parsed &&
      "exp" in parsed &&
      typeof (parsed as EditorialPreviewPayload).entity === "string" &&
      typeof (parsed as EditorialPreviewPayload).id === "string" &&
      typeof (parsed as EditorialPreviewPayload).exp === "number"
    ) {
      return parsed as EditorialPreviewPayload;
    }
    return null;
  } catch {
    return null;
  }
}

export function signEditorialPreviewToken(
  secret: string,
  payload: EditorialPreviewPayload,
): string {
  const body = encodePayload(payload);
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyEditorialPreviewToken(
  secret: string,
  token: string,
): EditorialPreviewPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const payload = decodePayload(body);
  if (!payload || payload.exp * 1000 < Date.now()) return null;
  return payload;
}
