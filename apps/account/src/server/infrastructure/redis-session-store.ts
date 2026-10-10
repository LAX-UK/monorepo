import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import Redis from "ioredis";
import type { SessionStore, StaffSessionRecord } from "../ports/session-store";

function deriveKey(raw: string): Buffer {
  return createHash("sha256").update(raw).digest();
}

function encryptJson(key: Buffer, value: StaffSessionRecord): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const payload = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, payload]).toString("base64url");
}

function decryptJson(key: Buffer, raw: string): StaffSessionRecord {
  const buf = Buffer.from(raw, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const json = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  return JSON.parse(json) as StaffSessionRecord;
}

export function createRedisSessionStore(input: {
  redisUrl: string;
  encryptionKey: string;
  keyPrefix?: string;
}): SessionStore {
  const redis = new Redis(input.redisUrl, {
    maxRetriesPerRequest: 1,
    connectTimeout: 3_000,
    lazyConnect: true,
  });
  const keyPrefix = input.keyPrefix ?? "lax-account:session:";
  const idxSidPrefix = "lax-account:idx:sid:";
  const idxSubPrefix = "lax-account:idx:sub:";
  const jtiPrefix = "lax-account:logout-jti:";
  const cryptoKey = deriveKey(input.encryptionKey);
  const locks = new Map<string, Promise<unknown>>();

  function readRecord(raw: string | null): StaffSessionRecord | null {
    if (!raw) return null;
    try {
      return decryptJson(cryptoKey, raw);
    } catch {
      return null;
    }
  }

  async function unindex(sessionId: string, record: StaffSessionRecord): Promise<void> {
    if (record.sid) {
      const sidKey = `${idxSidPrefix}${record.sid}`;
      if ((await redis.get(sidKey)) === sessionId) await redis.del(sidKey);
    }
    if (record.subject) await redis.srem(`${idxSubPrefix}${record.subject}`, sessionId);
  }

  async function deleteSession(sessionId: string): Promise<void> {
    const sessionKey = `${keyPrefix}${sessionId}`;
    const record = readRecord(await redis.get(sessionKey));
    await redis.del(sessionKey);
    if (record) await unindex(sessionId, record);
  }

  return {
    async get(sessionId) {
      return readRecord(await redis.get(`${keyPrefix}${sessionId}`));
    },
    async save(sessionId, record, ttlSeconds) {
      const previous = readRecord(await redis.get(`${keyPrefix}${sessionId}`));
      if (previous) await unindex(sessionId, previous);
      const subjectKey = `${idxSubPrefix}${record.subject}`;
      const write = redis
        .multi()
        .set(`${keyPrefix}${sessionId}`, encryptJson(cryptoKey, record), "EX", ttlSeconds)
        .sadd(subjectKey, sessionId)
        .expire(subjectKey, ttlSeconds);
      if (record.sid) write.set(`${idxSidPrefix}${record.sid}`, sessionId, "EX", ttlSeconds);
      await write.exec();
    },
    async delete(sessionId) {
      await deleteSession(sessionId);
    },
    async invalidateBySidOrSubject(input) {
      if (input.sid) {
        const sessionId = await redis.get(`${idxSidPrefix}${input.sid}`);
        if (sessionId) await deleteSession(sessionId);
        return;
      }
      if (!input.sub) return;
      const subjectKey = `${idxSubPrefix}${input.sub}`;
      const sessionIds = await redis.smembers(subjectKey);
      for (const sessionId of sessionIds) await deleteSession(sessionId);
      await redis.del(subjectKey);
    },
    async claimBackchannelLogoutJti(jti, ttlSeconds) {
      const accepted = await redis.set(`${jtiPrefix}${jti}`, "1", "EX", ttlSeconds, "NX");
      return accepted === "OK";
    },
    async releaseBackchannelLogoutJti(jti) {
      await redis.del(`${jtiPrefix}${jti}`);
    },
    async withRefreshLock(sessionId, fn) {
      const prior = locks.get(sessionId) ?? Promise.resolve();
      const next = prior.then(fn, fn);
      locks.set(
        sessionId,
        next.finally(() => {
          if (locks.get(sessionId) === next) locks.delete(sessionId);
        }),
      );
      return next as Promise<Awaited<ReturnType<typeof fn>>>;
    },
    async isReachable() {
      try {
        return (await redis.ping()) === "PONG";
      } catch {
        return false;
      }
    },
  };
}
