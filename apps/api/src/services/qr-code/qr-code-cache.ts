import type { Redis } from "ioredis";
import type { QrCodeCachedResolve } from "./qr-code-types.js";

const CACHE_TTL_SECONDS = 60;
const IN_MEMORY_TTL_MS = CACHE_TTL_SECONDS * 1000;
const IN_MEMORY_MAX_ENTRIES = 500;

type InMemoryEntry = { value: QrCodeCachedResolve; expiresAtEpoch: number };

const inMemoryCache = new Map<string, InMemoryEntry>();

export class QrCodeCache {
  constructor(private readonly redis: Redis) {}

  async get(shortCode: string): Promise<QrCodeCachedResolve | null> {
    const local = inMemoryCache.get(shortCode);
    if (local) {
      if (local.expiresAtEpoch > Date.now()) return local.value;
      inMemoryCache.delete(shortCode);
    }
    const raw = await this.redis.get(this.cacheKey(shortCode));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QrCodeCachedResolve;
    this.setLocal(shortCode, parsed);
    return parsed;
  }

  async set(shortCode: string, value: QrCodeCachedResolve): Promise<void> {
    this.setLocal(shortCode, value);
    await this.redis.set(this.cacheKey(shortCode), JSON.stringify(value), "EX", CACHE_TTL_SECONDS);
  }

  async invalidate(shortCode: string): Promise<void> {
    inMemoryCache.delete(shortCode);
    await this.redis.del(this.cacheKey(shortCode));
  }

  private setLocal(shortCode: string, value: QrCodeCachedResolve): void {
    inMemoryCache.set(shortCode, { value, expiresAtEpoch: Date.now() + IN_MEMORY_TTL_MS });
    if (inMemoryCache.size > IN_MEMORY_MAX_ENTRIES) {
      const first = inMemoryCache.keys().next().value;
      if (first) inMemoryCache.delete(first);
    }
  }

  private cacheKey(shortCode: string): string {
    return `qr:resolve:${shortCode}`;
  }
}

export function resolveFromCached(
  cached: QrCodeCachedResolve,
): import("./qr-code-types.js").QrCodeResolveResult {
  if (cached.status !== "active") return { ok: false, status: 410, reason: "inactive" };
  if (cached.expiresAt && new Date(cached.expiresAt).getTime() <= Date.now()) {
    return { ok: false, status: 410, reason: "expired" };
  }
  return { ok: true, qrCodeId: cached.qrCodeId, destinationUrl: cached.destinationUrl };
}
