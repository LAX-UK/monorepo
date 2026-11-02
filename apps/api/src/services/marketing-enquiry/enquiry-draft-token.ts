import crypto from "node:crypto";
import { ENQUIRY_UPLOAD_TTL_MS } from "@auction/domain";

export type IssuedEnquiryDraft = { token: string; draftId: string; expiresAt: Date };

/** Proves that a visitor was given a draft, so they may upload files for it. */
export interface IEnquiryDraftTokens {
  issue(): IssuedEnquiryDraft;
  /** The draft the token was issued for, or `null` when it is forged, malformed or expired. */
  verify(token: string): { draftId: string } | null;
}

type Payload = { d: string; e: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function isPayload(value: unknown): value is Payload {
  if (typeof value !== "object" || value === null) return false;
  const { d, e } = value as Record<string, unknown>;
  return typeof d === "string" && UUID.test(d) && typeof e === "number";
}

export type HmacEnquiryDraftTokensDeps = {
  secret: string;
  now: () => Date;
};

/**
 * A draft token is the draft id and its expiry, signed with HMAC-SHA256. Nothing is stored: a
 * token is good until it expires, which is also when the files uploaded under it are removed if
 * they were never sent.
 */
export class HmacEnquiryDraftTokens implements IEnquiryDraftTokens {
  constructor(private readonly deps: HmacEnquiryDraftTokensDeps) {}

  issue(): IssuedEnquiryDraft {
    const draftId = crypto.randomUUID();
    const expiresAt = new Date(this.deps.now().getTime() + ENQUIRY_UPLOAD_TTL_MS);
    const body = Buffer.from(
      JSON.stringify({ d: draftId, e: expiresAt.getTime() } satisfies Payload),
    ).toString("base64url");
    return { token: `${body}.${this.sign(body)}`, draftId, expiresAt };
  }

  verify(token: string): { draftId: string } | null {
    const parts = token.split(".");
    const [body, signature] = parts;
    if (parts.length !== 2 || !body || !signature) return null;
    const expected = Buffer.from(this.sign(body));
    const given = Buffer.from(signature);
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
    let payload: unknown;
    try {
      payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    } catch {
      return null;
    }
    if (!isPayload(payload) || payload.e <= this.deps.now().getTime()) return null;
    return { draftId: payload.d };
  }

  private sign(body: string): string {
    return crypto.createHmac("sha256", this.deps.secret).update(body).digest("base64url");
  }
}
