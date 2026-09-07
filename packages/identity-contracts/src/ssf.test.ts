import { type Server, createServer } from "node:http";
import { type KeyLike, SignJWT, exportJWK, generateKeyPair } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  SSF_EVENT_TYPES,
  type SsfReplayStore,
  SsfVerificationError,
  isAllowedSsfEndpoint,
  verifyAndConsumeSet,
} from "./ssf.js";

const issuer = "https://auth.lax.bid";
const audience = "lax-bid-api";
const now = new Date("2026-08-13T06:00:00.000Z");
let privateKey: KeyLike;
let server: Server;
let jwksUrl: string;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const publicJwk = await exportJWK(pair.publicKey);
  server = createServer((_request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ keys: [{ ...publicJwk, kid: "test-key", alg: "RS256" }] }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing test server address");
  jwksUrl = `http://127.0.0.1:${address.port}/jwks`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

function replayStore(): SsfReplayStore {
  const consumed = new Set<string>();
  return {
    consume: async (signal) => {
      if (consumed.has(signal.jti)) return false;
      consumed.add(signal.jti);
      return true;
    },
  };
}

async function sign(
  overrides: {
    issuer?: string;
    audience?: string;
    typ?: string;
    iat?: number;
    jti?: string;
    subId?: unknown;
    events?: unknown;
  } = {},
): Promise<string> {
  return new SignJWT({
    sub_id: overrides.subId ?? { format: "opaque", id: "subject-1" },
    events:
      overrides.events ??
      ({ [SSF_EVENT_TYPES.ACCOUNT_DISABLED]: {} } satisfies Record<string, unknown>),
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key", typ: overrides.typ ?? "secevent+jwt" })
    .setIssuer(overrides.issuer ?? issuer)
    .setAudience(overrides.audience ?? audience)
    .setIssuedAt(overrides.iat ?? Math.floor(now.getTime() / 1000))
    .setJti(overrides.jti ?? crypto.randomUUID())
    .sign(privateKey);
}

async function verify(token: string, store = replayStore()) {
  return verifyAndConsumeSet({
    token,
    jwksUrl,
    issuer,
    audience,
    replayStore: store,
    now,
  });
}

describe("SSF SET verifier", () => {
  it("verifies and normalizes one supported signed event", async () => {
    const result = await verify(await sign());
    expect(result).toMatchObject({
      issuer,
      audience,
      subjectId: "subject-1",
      eventType: SSF_EVENT_TYPES.ACCOUNT_DISABLED,
      event: {},
    });
  });

  it.each([
    ["wrong audience", { audience: "wrong" }],
    ["wrong issuer", { issuer: "https://wrong.example" }],
    ["wrong typ", { typ: "JWT" }],
  ])("rejects %s", async (_name, overrides) => {
    await expect(verify(await sign(overrides))).rejects.toBeInstanceOf(SsfVerificationError);
  });

  it("rejects stale and future iat values", async () => {
    const seconds = Math.floor(now.getTime() / 1000);
    await expect(verify(await sign({ iat: seconds - 301 }))).rejects.toMatchObject({
      code: "stale_set",
    });
    await expect(verify(await sign({ iat: seconds + 31 }))).rejects.toMatchObject({
      code: "future_set",
    });
  });

  it("atomically rejects replayed jti values", async () => {
    const store = replayStore();
    const token = await sign({ jti: "same-jti" });
    await expect(verify(token, store)).resolves.toMatchObject({ jti: "same-jti" });
    await expect(verify(token, store)).rejects.toMatchObject({ code: "replayed_set" });
  });

  it.each([
    ["malformed sub_id", { subId: { format: "email", email: "pii@example.test" } }],
    [
      "multiple events",
      {
        events: {
          [SSF_EVENT_TYPES.ACCOUNT_DISABLED]: {},
          [SSF_EVENT_TYPES.ACCOUNT_ENABLED]: {},
        },
      },
    ],
    ["malformed event", { events: { [SSF_EVENT_TYPES.CREDENTIAL_CHANGE]: {} } }],
  ])("rejects %s", async (_name, overrides) => {
    await expect(verify(await sign(overrides))).rejects.toMatchObject({ code: "invalid_set" });
  });

  it("rejects unsupported events", async () => {
    await expect(
      verify(await sign({ events: { "https://example.test/event": {} } })),
    ).rejects.toMatchObject({ code: "unsupported_event" });
  });
});

describe("first-party SSF endpoint registry", () => {
  it("allows only exact registered endpoints", () => {
    expect(
      isAllowedSsfEndpoint("lax-bid-web", "https://api.lax.bid/ssf/events", "production"),
    ).toBe(true);
    expect(
      isAllowedSsfEndpoint(
        "lax-bid-web",
        "https://api.lax.bid/ssf/events?redirect=http://169.254.169.254",
        "production",
      ),
    ).toBe(false);
    expect(
      isAllowedSsfEndpoint("lax-bid-web", "http://localhost:3001/ssf/events", "production"),
    ).toBe(false);
    expect(isAllowedSsfEndpoint("lax-bid-web", "http://localhost:3001/ssf/events", "test")).toBe(
      false,
    );
    expect(isAllowedSsfEndpoint("lax-bid-web", "https://test-api.lax.bid/ssf/events", "test")).toBe(
      true,
    );
    expect(
      isAllowedSsfEndpoint("lax-bid-web", "https://test-api.lax.bid/ssf/events", "production"),
    ).toBe(false);
    expect(
      isAllowedSsfEndpoint("lax-bid-web", "http://localhost:3001/ssf/events", "development"),
    ).toBe(true);
  });
});
