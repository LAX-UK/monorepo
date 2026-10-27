import type {
  IdTokenContinuityRecord,
  IdTokenContinuityStore,
} from "../services/refreshed-id-token.service.js";

const KEY_PREFIX = "auth:id-token-continuity:";

export type ContinuityRedis = {
  set(key: string, value: string, mode: "EX", ttlSec: number): Promise<unknown>;
  getdel(key: string): Promise<string | null>;
};

/** Seals records at rest when an envelope is configured: they carry email and name claims. */
export type ContinuitySealer = { seal(value: string): string; open(value: string): string };

function isRecord(value: unknown): value is IdTokenContinuityRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.issuer === "string" &&
    typeof candidate.sid === "string" &&
    typeof candidate.subject === "string" &&
    typeof candidate.clientId === "string" &&
    typeof candidate.claims === "object" &&
    candidate.claims !== null
  );
}

export class RedisIdTokenContinuityStore implements IdTokenContinuityStore {
  constructor(
    private readonly redis: ContinuityRedis,
    private readonly sealer?: ContinuitySealer,
  ) {}

  async put(refreshTokenHash: string, record: IdTokenContinuityRecord, ttlSec: number) {
    const json = JSON.stringify(record);
    await this.redis.set(
      `${KEY_PREFIX}${refreshTokenHash}`,
      this.sealer ? this.sealer.seal(json) : json,
      "EX",
      ttlSec,
    );
  }

  async take(refreshTokenHash: string): Promise<IdTokenContinuityRecord | null> {
    const stored = await this.redis.getdel(`${KEY_PREFIX}${refreshTokenHash}`);
    if (!stored) return null;
    try {
      const parsed: unknown = JSON.parse(this.sealer ? this.sealer.open(stored) : stored);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}
