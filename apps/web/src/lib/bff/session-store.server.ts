import "server-only";

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import type Redis from "ioredis";
import { bffConfig } from "./config.server";
import { ensureBffRedisConnected } from "./redis.server";

export const LOGIN_TTL_SECONDS = 10 * 60;
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const LOCK_TTL_MS = 10_000;
const LOCK_RENEW_INTERVAL_MS = 2_500;
const LOCK_WAIT_TIMEOUT_MS = 30_000;
const SESSION_ID_ATTEMPTS = 3;

const WRITE_SESSION_SCRIPT = `
-- bff:write-session
local exists = redis.call('exists', KEYS[1])
if (ARGV[4] == 'NX' and exists == 1) or (ARGV[4] == 'XX' and exists == 0) then
  return 0
end
local oldIndexes = redis.call('smembers', KEYS[2])
for _, indexKey in ipairs(oldIndexes) do
  redis.call('srem', indexKey, ARGV[3])
  if redis.call('scard', indexKey) == 0 then redis.call('del', indexKey) end
end
redis.call('del', KEYS[2])
redis.call('set', KEYS[1], ARGV[1], 'EX', ARGV[2])
for index = 3, #KEYS do
  redis.call('sadd', KEYS[index], ARGV[3])
  redis.call('expire', KEYS[index], ARGV[2])
  redis.call('sadd', KEYS[2], KEYS[index])
end
redis.call('expire', KEYS[2], ARGV[2])
return 1
`;

const LOCKED_WRITE_SESSION_SCRIPT = `
-- bff:locked-write-session
if redis.call('get', KEYS[5]) ~= ARGV[4] or redis.call('exists', KEYS[1]) == 0 then
  return 0
end
local oldIndexes = redis.call('smembers', KEYS[2])
for _, indexKey in ipairs(oldIndexes) do
  redis.call('srem', indexKey, ARGV[3])
  if redis.call('scard', indexKey) == 0 then redis.call('del', indexKey) end
end
redis.call('del', KEYS[2])
redis.call('set', KEYS[1], ARGV[1], 'EX', ARGV[2])
for index = 3, 4 do
  redis.call('sadd', KEYS[index], ARGV[3])
  redis.call('expire', KEYS[index], ARGV[2])
  redis.call('sadd', KEYS[2], KEYS[index])
end
redis.call('expire', KEYS[2], ARGV[2])
return 1
`;

const ROTATE_SESSION_SCRIPT = `
-- bff:rotate-session
if redis.call('exists', KEYS[1]) == 0 or redis.call('exists', KEYS[3]) == 1 then
  return 0
end
local pendingIndexes = redis.call('smembers', KEYS[2])
for _, indexKey in ipairs(pendingIndexes) do
  redis.call('srem', indexKey, ARGV[2])
  if redis.call('scard', indexKey) == 0 then redis.call('del', indexKey) end
end
redis.call('del', KEYS[1], KEYS[2])
redis.call('set', KEYS[3], ARGV[1], 'EX', ARGV[3])
for index = 5, #KEYS do
  redis.call('sadd', KEYS[index], ARGV[4])
  redis.call('expire', KEYS[index], ARGV[3])
  redis.call('sadd', KEYS[4], KEYS[index])
end
redis.call('expire', KEYS[4], ARGV[3])
return 1
`;

const DELETE_SESSION_SCRIPT = `
-- bff:delete-session
local indexes = redis.call('smembers', KEYS[2])
for _, indexKey in ipairs(indexes) do
  redis.call('srem', indexKey, ARGV[1])
  if redis.call('scard', indexKey) == 0 then redis.call('del', indexKey) end
end
redis.call('del', KEYS[2])
return redis.call('del', KEYS[1])
`;

const INVALIDATE_INDEX_SCRIPT = `
-- bff:invalidate-index
local members = redis.call('smembers', KEYS[1])
local deleted = 0
for _, member in ipairs(members) do
  local sessionKey = ARGV[1] .. member
  local refsKey = sessionKey .. ':indexes'
  local indexes = redis.call('smembers', refsKey)
  for _, indexKey in ipairs(indexes) do
    redis.call('srem', indexKey, member)
    if redis.call('scard', indexKey) == 0 then redis.call('del', indexKey) end
  end
  redis.call('del', refsKey)
  deleted = deleted + redis.call('del', sessionKey)
end
redis.call('del', KEYS[1])
return deleted
`;

const RENEW_LOCK_SCRIPT =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end";
const RELEASE_LOCK_SCRIPT =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

export type PendingBidSession = {
  kind: "pending";
  state: string;
  nonce: string;
  codeVerifier: string;
  nextPath: string;
};

export type AuthenticatedBidSession = {
  kind: "authenticated";
  subject: string;
  sid: string;
  idToken: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  resourceTokens: Partial<
    Record<"lax-bid-api" | "lax-ws", { token: string; expiresAt: number; scopes: string }>
  >;
};

export type BidSession = PendingBidSession | AuthenticatedBidSession;

function sessionFingerprint(id: string): string {
  return createHash("sha256").update(id).digest("base64url");
}

function sessionKey(id: string): string {
  return `bid:bff:session:${sessionFingerprint(id)}`;
}

function sessionIndexRefsKey(id: string): string {
  return `${sessionKey(id)}:indexes`;
}

function identityIndexKey(kind: "sid" | "sub", value: string): string {
  const fingerprint = createHmac("sha256", encryptionKey())
    .update(`${kind}\0${value}`)
    .digest("base64url");
  return `bid:bff:index:${kind}:${fingerprint}`;
}

function authenticatedIndexKeys(session: AuthenticatedBidSession): [string, string] {
  return [identityIndexKey("sid", session.sid), identityIndexKey("sub", session.subject)];
}

function encryptionKey(): Buffer {
  const raw = bffConfig().encryptionKey;
  const key = /^[a-f\d]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64url");
  if (key.length !== 32) {
    throw new Error("BID_BFF_SESSION_ENCRYPTION_KEY must encode exactly 32 bytes");
  }
  return key;
}

export function encryptSession(session: BidSession): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(session), "utf8"),
    cipher.final(),
  ]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptSession(value: string): BidSession | null {
  try {
    const [version, iv, tag, ciphertext] = value.split(".");
    if (version !== "v1" || !iv || !tag || !ciphertext) return null;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(plaintext) as BidSession;
  } catch {
    return null;
  }
}

export function generateSessionId(): string {
  return randomBytes(32).toString("base64url");
}

export class BidBffSessionStore {
  constructor(private readonly redis: Redis) {}

  async createPending(session: PendingBidSession): Promise<string> {
    const redis = await ensureBffRedisConnected(this.redis);
    for (let attempt = 0; attempt < SESSION_ID_ATTEMPTS; attempt += 1) {
      const id = generateSessionId();
      const stored = await redis.set(
        sessionKey(id),
        encryptSession(session),
        "EX",
        LOGIN_TTL_SECONDS,
        "NX",
      );
      if (stored === "OK") return id;
    }
    throw new Error("Unable to allocate a unique BFF session");
  }

  async read(id: string): Promise<BidSession | null> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(id)) return null;
    const value = await (await ensureBffRedisConnected(this.redis)).get(sessionKey(id));
    return value ? decryptSession(value) : null;
  }

  async authenticate(id: string, session: AuthenticatedBidSession): Promise<boolean> {
    const redis = await ensureBffRedisConnected(this.redis);
    const result = await redis.eval(
      WRITE_SESSION_SCRIPT,
      4,
      sessionKey(id),
      sessionIndexRefsKey(id),
      ...authenticatedIndexKeys(session),
      encryptSession(session),
      SESSION_TTL_SECONDS,
      sessionFingerprint(id),
      "XX",
    );
    return result === 1;
  }

  async rotateAuthenticated(
    pendingId: string,
    session: AuthenticatedBidSession,
  ): Promise<string | null> {
    const redis = await ensureBffRedisConnected(this.redis);
    const authenticatedId = generateSessionId();
    const stored = await redis.eval(
      ROTATE_SESSION_SCRIPT,
      6,
      sessionKey(pendingId),
      sessionIndexRefsKey(pendingId),
      sessionKey(authenticatedId),
      sessionIndexRefsKey(authenticatedId),
      ...authenticatedIndexKeys(session),
      encryptSession(session),
      sessionFingerprint(pendingId),
      SESSION_TTL_SECONDS,
      sessionFingerprint(authenticatedId),
    );
    if (stored !== 1) return null;
    return authenticatedId;
  }

  async updateAuthenticated(id: string, session: AuthenticatedBidSession): Promise<boolean> {
    return this.authenticate(id, session);
  }

  async invalidate(id: string | null): Promise<void> {
    if (id && /^[A-Za-z0-9_-]{43}$/.test(id)) {
      await (await ensureBffRedisConnected(this.redis)).eval(
        DELETE_SESSION_SCRIPT,
        2,
        sessionKey(id),
        sessionIndexRefsKey(id),
        sessionFingerprint(id),
      );
    }
  }

  async invalidateBySidOrSubject(input: { sid?: string; sub?: string }): Promise<void> {
    const identity = input.sid
      ? (["sid", input.sid] as const)
      : input.sub
        ? (["sub", input.sub] as const)
        : null;
    if (!identity) return;
    const redis = await ensureBffRedisConnected(this.redis);
    await redis.eval(
      INVALIDATE_INDEX_SCRIPT,
      1,
      identityIndexKey(identity[0], identity[1]),
      "bid:bff:session:",
    );
  }

  async withRefreshLock<T>(
    id: string,
    operation: (lock: {
      assertOwned(): Promise<void>;
      updateAuthenticated(session: AuthenticatedBidSession): Promise<boolean>;
    }) => Promise<T>,
  ): Promise<T> {
    const redis = await ensureBffRedisConnected(this.redis);
    const lockKey = `${sessionKey(id)}:refresh`;
    const lockValue = randomBytes(24).toString("base64url");
    const deadline = Date.now() + LOCK_WAIT_TIMEOUT_MS;
    while ((await redis.set(lockKey, lockValue, "PX", LOCK_TTL_MS, "NX")) !== "OK") {
      if (Date.now() >= deadline) throw new Error("Timed out waiting for BFF token refresh");
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    let stopped = false;
    let ownershipLost = false;
    let renewalTimer: ReturnType<typeof setTimeout> | undefined;
    const renew = async (): Promise<void> => {
      try {
        const renewed = await redis.eval(RENEW_LOCK_SCRIPT, 1, lockKey, lockValue, LOCK_TTL_MS);
        ownershipLost = renewed !== 1;
      } catch {
        ownershipLost = true;
      }
      if (!stopped && !ownershipLost) {
        renewalTimer = setTimeout(renew, LOCK_RENEW_INTERVAL_MS);
      }
    };
    renewalTimer = setTimeout(renew, LOCK_RENEW_INTERVAL_MS);
    const assertOwned = async (): Promise<void> => {
      if (ownershipLost) throw new Error("Lost ownership of BFF token refresh lock");
      const renewed = await redis.eval(RENEW_LOCK_SCRIPT, 1, lockKey, lockValue, LOCK_TTL_MS);
      if (renewed !== 1) {
        ownershipLost = true;
        throw new Error("Lost ownership of BFF token refresh lock");
      }
    };
    const updateAuthenticated = async (session: AuthenticatedBidSession): Promise<boolean> => {
      const updated = await redis.eval(
        LOCKED_WRITE_SESSION_SCRIPT,
        5,
        sessionKey(id),
        sessionIndexRefsKey(id),
        ...authenticatedIndexKeys(session),
        lockKey,
        encryptSession(session),
        SESSION_TTL_SECONDS,
        sessionFingerprint(id),
        lockValue,
      );
      if (updated !== 1) ownershipLost = true;
      return updated === 1;
    };

    try {
      const result = await operation({ assertOwned, updateAuthenticated });
      await assertOwned();
      return result;
    } finally {
      stopped = true;
      if (renewalTimer) clearTimeout(renewalTimer);
      await redis.eval(RELEASE_LOCK_SCRIPT, 1, lockKey, lockValue);
    }
  }
}
