import { type JWTPayload, createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";

export const SSF_PUSH_DELIVERY_METHOD = "urn:ietf:rfc:8935" as const;
export const SSF_VERIFICATION_EVENT =
  "https://schemas.openid.net/secevent/ssf/event-type/verification" as const;

export const SSF_EVENT_TYPES = {
  SESSION_REVOKED: "https://schemas.openid.net/secevent/caep/event-type/session-revoked",
  CREDENTIAL_CHANGE: "https://schemas.openid.net/secevent/caep/event-type/credential-change",
  ACCOUNT_DISABLED: "https://schemas.openid.net/secevent/risc/event-type/account-disabled",
  ACCOUNT_ENABLED: "https://schemas.openid.net/secevent/risc/event-type/account-enabled",
  ACCOUNT_PURGED: "https://schemas.openid.net/secevent/risc/event-type/account-purged",
  IDENTIFIER_RECYCLED: "https://schemas.openid.net/secevent/risc/event-type/identifier-recycled",
  /**
   * Private first-party extension. RISC 1.0 has no account-merge event and
   * account-purged would lose the canonical-subject association.
   */
  LAX_IDENTITY_MERGED: "https://schemas.lax.bid/secevent/identity/event-type/account-merged",
} as const;

export type SsfEventType = (typeof SSF_EVENT_TYPES)[keyof typeof SSF_EVENT_TYPES];
export type SupportedSsfEventType = SsfEventType | typeof SSF_VERIFICATION_EVENT;

export const FIRST_PARTY_SSF_EVENT_TYPES = Object.values(
  SSF_EVENT_TYPES,
) as readonly SsfEventType[];

export const SSF_RECEIVER_REGISTRY = {
  "lax-bid-web": {
    clientId: "lax-bid-web",
    audience: "lax-bid-api",
    endpoint: "https://api.lax.bid/ssf/events",
    testEndpoints: ["https://test-api.lax.bid/ssf/events"],
    developmentEndpoints: ["http://localhost:3001/ssf/events"],
  },
  "lax-shop-web": {
    clientId: "lax-shop-web",
    audience: "lax-shop-api",
    endpoint: "https://shop.lax.art/api/ssf/events",
    testEndpoints: ["https://test-shop.lax.art/api/ssf/events"],
    developmentEndpoints: ["http://localhost:3010/api/ssf/events"],
  },
} as const;

export type SsfReceiverClientId = keyof typeof SSF_RECEIVER_REGISTRY;

export function isAllowedSsfEndpoint(
  clientId: string,
  endpoint: string,
  environment: "development" | "test" | "production",
): boolean {
  const receiver = SSF_RECEIVER_REGISTRY[clientId as SsfReceiverClientId];
  if (!receiver) return false;
  if (endpoint === receiver.endpoint) return true;
  if (environment === "test" && receiver.testEndpoints.includes(endpoint as never)) return true;
  return environment === "development" && receiver.developmentEndpoints.includes(endpoint as never);
}

const opaqueSubjectSchema = z
  .object({
    format: z.literal("opaque"),
    id: z.string().min(1).max(512),
  })
  .strict();

const eventSchemas = {
  [SSF_EVENT_TYPES.SESSION_REVOKED]: z
    .object({ event_timestamp: z.number().int().nonnegative().optional() })
    .strict(),
  [SSF_EVENT_TYPES.CREDENTIAL_CHANGE]: z
    .object({
      credential_type: z.string().min(1),
      change_type: z.enum(["create", "update", "revoke", "delete"]),
      event_timestamp: z.number().int().nonnegative().optional(),
    })
    .strict(),
  [SSF_EVENT_TYPES.ACCOUNT_DISABLED]: z.object({ reason: z.string().min(1).optional() }).strict(),
  [SSF_EVENT_TYPES.ACCOUNT_ENABLED]: z.object({}).strict(),
  [SSF_EVENT_TYPES.ACCOUNT_PURGED]: z.object({}).strict(),
  [SSF_EVENT_TYPES.IDENTIFIER_RECYCLED]: z.object({}).strict(),
  [SSF_EVENT_TYPES.LAX_IDENTITY_MERGED]: z
    .object({ canonical_subject_id: z.string().min(1).max(512) })
    .strict(),
  [SSF_VERIFICATION_EVENT]: z.object({ state: z.string().optional() }).strict(),
} satisfies Record<SupportedSsfEventType, z.ZodType<Record<string, unknown>>>;

export type NormalizedSsfSignal = {
  issuer: string;
  audience: string;
  issuedAt: number;
  jti: string;
  txn?: string | undefined;
  subjectId: string;
  eventType: SupportedSsfEventType;
  event: Record<string, unknown>;
};

export interface SsfReplayStore {
  /**
   * Atomically reserves the JTI and applies the signal. Implementations MUST
   * commit both effects in one transaction and return false for a replay.
   */
  consume(signal: NormalizedSsfSignal, expiresAt: Date): Promise<boolean>;
}

export class SsfVerificationError extends Error {
  constructor(
    readonly code:
      | "invalid_set"
      | "unsupported_event"
      | "stale_set"
      | "future_set"
      | "replayed_set",
    cause?: unknown,
  ) {
    super(code, cause === undefined ? undefined : { cause });
  }
}

export type VerifyAndConsumeSetOptions = {
  token: string;
  jwksUrl: string | URL;
  issuer: string;
  audience: string;
  replayStore: SsfReplayStore;
  supportedEventTypes?: readonly SupportedSsfEventType[] | undefined;
  maxAgeSeconds?: number | undefined;
  maxFutureSkewSeconds?: number | undefined;
  now?: Date | undefined;
};

export async function verifyAndConsumeSet(
  options: VerifyAndConsumeSetOptions,
): Promise<NormalizedSsfSignal> {
  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const maxAgeSeconds = options.maxAgeSeconds ?? 300;
  const maxFutureSkewSeconds = options.maxFutureSkewSeconds ?? 30;

  let payload: JWTPayload;
  let typ: string | undefined;
  try {
    const verified = await jwtVerify(options.token, createRemoteJWKSet(new URL(options.jwksUrl)), {
      algorithms: ["RS256"],
      issuer: options.issuer,
      audience: options.audience,
    });
    payload = verified.payload;
    typ = verified.protectedHeader.typ;
  } catch (error) {
    throw new SsfVerificationError("invalid_set", error);
  }

  if (typ !== "secevent+jwt" || !payload.jti || typeof payload.iat !== "number") {
    throw new SsfVerificationError("invalid_set");
  }
  if (payload.iat < nowSeconds - maxAgeSeconds) {
    throw new SsfVerificationError("stale_set");
  }
  if (payload.iat > nowSeconds + maxFutureSkewSeconds) {
    throw new SsfVerificationError("future_set");
  }
  if (payload.txn !== undefined && typeof payload.txn !== "string") {
    throw new SsfVerificationError("invalid_set");
  }

  const subject = opaqueSubjectSchema.safeParse(payload.sub_id);
  if (!subject.success || !isRecord(payload.events)) {
    throw new SsfVerificationError("invalid_set");
  }
  const entries = Object.entries(payload.events);
  if (entries.length !== 1) throw new SsfVerificationError("invalid_set");
  const [rawEventType, rawEvent] = entries[0] as [string, unknown];
  if (!(rawEventType in eventSchemas)) {
    throw new SsfVerificationError("unsupported_event");
  }
  const eventType = rawEventType as SupportedSsfEventType;
  const supported = options.supportedEventTypes ?? [
    ...FIRST_PARTY_SSF_EVENT_TYPES,
    SSF_VERIFICATION_EVENT,
  ];
  if (!supported.includes(eventType)) {
    throw new SsfVerificationError("unsupported_event");
  }
  const parsedEvent = eventSchemas[eventType].safeParse(rawEvent);
  if (!parsedEvent.success) throw new SsfVerificationError("invalid_set");

  const signal: NormalizedSsfSignal = {
    issuer: options.issuer,
    audience: options.audience,
    issuedAt: payload.iat,
    jti: payload.jti,
    ...(typeof payload.txn === "string" ? { txn: payload.txn } : {}),
    subjectId: subject.data.id,
    eventType,
    event: parsedEvent.data,
  };
  const expiresAt = new Date((payload.iat + maxAgeSeconds + maxFutureSkewSeconds) * 1000);
  const consumed = await options.replayStore.consume(signal, expiresAt);
  if (!consumed) throw new SsfVerificationError("replayed_set");
  return signal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
