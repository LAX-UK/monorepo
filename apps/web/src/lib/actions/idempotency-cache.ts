import "server-only";

type CachedCreate = {
  id: string;
  expiresAt: number;
};

type CachedAck = {
  expiresAt: number;
};

const lotCreateCache = new Map<string, CachedCreate>();
const saleCreateCache = new Map<string, CachedCreate>();
const categoryCreateCache = new Map<string, CachedCreate>();
const lotPublishCache = new Map<string, CachedAck>();

const TTL_MS = 5 * 60 * 1000;

function readId(cache: Map<string, CachedCreate>, key: string): string | null {
  const row = cache.get(key);
  if (!row) return null;
  if (row.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return row.id;
}

function writeId(cache: Map<string, CachedCreate>, key: string, id: string): void {
  cache.set(key, { id, expiresAt: Date.now() + TTL_MS });
}

function readAck(cache: Map<string, CachedAck>, key: string): boolean {
  const row = cache.get(key);
  if (!row) return false;
  if (row.expiresAt <= Date.now()) {
    cache.delete(key);
    return false;
  }
  return true;
}

function writeAck(cache: Map<string, CachedAck>, key: string): void {
  cache.set(key, { expiresAt: Date.now() + TTL_MS });
}

export function getIdempotentLotCreate(key: string | undefined): string | null {
  if (!key?.trim()) return null;
  return readId(lotCreateCache, key.trim());
}

export function setIdempotentLotCreate(key: string | undefined, id: string): void {
  if (!key?.trim()) return;
  writeId(lotCreateCache, key.trim(), id);
}

export function getIdempotentSaleCreate(key: string | undefined): string | null {
  if (!key?.trim()) return null;
  return readId(saleCreateCache, key.trim());
}

export function setIdempotentSaleCreate(key: string | undefined, id: string): void {
  if (!key?.trim()) return;
  writeId(saleCreateCache, key.trim(), id);
}

export function getIdempotentCategoryCreate(key: string | undefined): string | null {
  if (!key?.trim()) return null;
  return readId(categoryCreateCache, key.trim());
}

export function setIdempotentCategoryCreate(key: string | undefined, id: string): void {
  if (!key?.trim()) return;
  writeId(categoryCreateCache, key.trim(), id);
}

/** Per-lot publish acknowledgement: same `lotId+key` is treated as already-applied. */
export function getIdempotentLotPublish(lotId: string, key: string | undefined): boolean {
  if (!key?.trim()) return false;
  return readAck(lotPublishCache, `${lotId}::${key.trim()}`);
}

export function setIdempotentLotPublish(lotId: string, key: string | undefined): void {
  if (!key?.trim()) return;
  writeAck(lotPublishCache, `${lotId}::${key.trim()}`);
}

/** Clears idempotency caches — for tests only. */
export function clearActionIdempotencyCachesForTests(): void {
  lotCreateCache.clear();
  saleCreateCache.clear();
  categoryCreateCache.clear();
  lotPublishCache.clear();
}
