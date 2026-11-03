import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ALERT_PRODUCTS, ALERT_TOPICS, type AlertProduct } from "../domain/products.js";
import type { AlertTopic } from "../domain/products.js";

export type LinkKind = "confirm" | "stop";

/** What a signed link says. It carries no personal data and cannot be forged. */
export type LinkPayload = {
  kind: LinkKind;
  product: AlertProduct;
  subscriberId: string;
  /** Must equal the subscriber's current `linkVersion`, so bumping it revokes every old link. */
  linkVersion: number;
  /** Confirm links name the request they belong to. */
  requestedAtMs?: number;
  /** A stop link may name the one topic of the email it came from. */
  topic?: AlertTopic;
};

export type LinkKey = { id: string; secret: string };

/** The key new links are signed with, and every key still accepted (the current one included). */
export type LinkKeyring = { signing: LinkKey; accepted: readonly LinkKey[] };

/** Links sent by the first sale-alerts list, accepted for a limited time after the engine ships. */
export type LegacyLinkPolicy = { secret: string; acceptUntil: Date };

const wireSchema = z.object({
  kid: z.string().min(1).max(32),
  k: z.enum(["confirm", "stop"]),
  p: z.enum(ALERT_PRODUCTS),
  s: z.string().min(1).max(64),
  v: z.number().int().min(1),
  r: z.number().int().optional(),
  t: z.enum(ALERT_TOPICS).optional(),
});

const legacySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("confirm"), subscriberId: z.string(), requestedAtMs: z.number() }),
  z.object({ kind: z.literal("unsubscribe"), subscriberId: z.string() }),
]);

const DOMAIN = "lax-alerts.v1.";
const LEGACY_DOMAIN = "visitor-sale-alerts.v1.";

export type VerifiedLink = { payload: LinkPayload; legacy: boolean };

function sign(domainBody: string, secret: string): string {
  return createHmac("sha256", secret).update(domainBody).digest("base64url");
}

function matches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function decodeJson(body: string): unknown {
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/**
 * Stateless HMAC-SHA256 links. The product is part of what is signed, so a link made for one
 * product never verifies for another. Stop links never expire; confirm links expire through the
 * request time they name, which the confirm service checks.
 */
export class AlertLinkCodec {
  constructor(
    private readonly keys: LinkKeyring,
    private readonly legacy?: LegacyLinkPolicy,
  ) {}

  create(payload: LinkPayload): string {
    const body = Buffer.from(
      JSON.stringify({
        kid: this.keys.signing.id,
        k: payload.kind,
        p: payload.product,
        s: payload.subscriberId,
        v: payload.linkVersion,
        ...(payload.requestedAtMs !== undefined ? { r: payload.requestedAtMs } : {}),
        ...(payload.topic ? { t: payload.topic } : {}),
      }),
    ).toString("base64url");
    return `${body}.${sign(`${DOMAIN}${payload.product}.${body}`, this.keys.signing.secret)}`;
  }

  /** The payload when the signature is genuine, otherwise null. */
  verify(token: string, now: Date): VerifiedLink | null {
    const [body, signature, extra] = token.split(".");
    if (!body || !signature || extra !== undefined) return null;
    return this.verifyCurrent(body, signature) ?? this.verifyLegacy(body, signature, now);
  }

  private verifyCurrent(body: string, signature: string): VerifiedLink | null {
    const parsed = wireSchema.safeParse(decodeJson(body));
    if (!parsed.success) return null;
    const wire = parsed.data;
    const key = this.keys.accepted.find((candidate) => candidate.id === wire.kid);
    if (!key || !matches(signature, sign(`${DOMAIN}${wire.p}.${body}`, key.secret))) return null;
    return {
      legacy: false,
      payload: {
        kind: wire.k,
        product: wire.p,
        subscriberId: wire.s,
        linkVersion: wire.v,
        ...(wire.r !== undefined ? { requestedAtMs: wire.r } : {}),
        ...(wire.t ? { topic: wire.t } : {}),
      },
    };
  }

  private verifyLegacy(body: string, signature: string, now: Date): VerifiedLink | null {
    if (!this.legacy || now.getTime() > this.legacy.acceptUntil.getTime()) return null;
    if (!matches(signature, sign(`${LEGACY_DOMAIN}${body}`, this.legacy.secret))) return null;
    const parsed = legacySchema.safeParse(decodeJson(body));
    if (!parsed.success) return null;
    const old = parsed.data;
    return {
      legacy: true,
      payload: {
        kind: old.kind === "confirm" ? "confirm" : "stop",
        product: "bid",
        subscriberId: old.subscriberId,
        linkVersion: 1,
        ...(old.kind === "confirm" ? { requestedAtMs: old.requestedAtMs } : {}),
      },
    };
  }
}
