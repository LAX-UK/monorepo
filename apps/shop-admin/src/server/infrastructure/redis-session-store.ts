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
  const redis = new Redis(input.redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
  const keyPrefix = input.keyPrefix ?? "shop-admin:session:";
  const idxSidPrefix = "shop-admin:idx:sid:";
  const idxSubPrefix = "shop-admin:idx:sub:";
  const jtiPrefix = "shop-admin:logout-jti:";
  const cryptoKey = deriveKey(input.encryptionKey);
  const locks = new Map<string, Promise<unknown>>();

  async function deleteSession(sessionId: string): Promise<void> {
    const raw = await redis.get(`${keyPrefix}${sessionId}`);
    await redis.del(`${keyPrefix}${sessionId}`);
    if (!raw) return;
    const record = decryptJson(cryptoKey, raw);
    if (record.sid) await redis.del(`${idxSidPrefix}${record.sid}`);
    if (record.subject) await redis.del(`${idxSubPrefix}${record.subject}`);
  }

  return {
    async get(sessionId) {
      const raw = await redis.get(`${keyPrefix}${sessionId}`);
      if (!raw) return null;
      return decryptJson(cryptoKey, raw);
    },
    async save(sessionId, record, ttlSeconds) {
      const prior = await redis.get(`${keyPrefix}${sessionId}`);
      if (prior) {
        const previous = decryptJson(cryptoKey, prior);
        if (previous.sid && previous.sid !== record.sid) {
          await redis.del(`${idxSidPrefix}${previous.sid}`);
        }
        if (previous.subject && previous.subject !== record.subject) {
          await redis.del(`${idxSubPrefix}${previous.subject}`);
        }
      }
      await redis.set(`${keyPrefix}${sessionId}`, encryptJson(cryptoKey, record), "EX", ttlSeconds);
      if (record.sid) {
        await redis.set(`${idxSidPrefix}${record.sid}`, sessionId, "EX", ttlSeconds);
      }
      if (record.subject) {
        await redis.set(`${idxSubPrefix}${record.subject}`, sessionId, "EX", ttlSeconds);
      }
    },
    async delete(sessionId) {
      await deleteSession(sessionId);
    },
    async invalidateBySidOrSubject(input) {
      const indexKey = input.sid
        ? `${idxSidPrefix}${input.sid}`
        : input.sub
          ? `${idxSubPrefix}${input.sub}`
          : null;
      if (!indexKey) return;
      const sessionId = await redis.get(indexKey);
      if (sessionId) await deleteSession(sessionId);
    },
    async claimBackchannelLogoutJti(jti, ttlSeconds) {
      const accepted = await redis.set(`${jtiPrefix}${jti}`, "1", "EX", ttlSeconds, "NX");
      return accepted === "OK";
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
  };
}
