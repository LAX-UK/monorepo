import {
  type Database,
  lot,
  lotNotDeleted,
  qrCode,
  qrCodeScan,
  qrCodeScanDaily,
  sale,
  saleNotDeleted,
} from "@auction/db";
import type { QrCodeScanJobPayload } from "@auction/queues";
import { lotPath, salePath } from "@auction/types";
import type { Queue } from "bullmq";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { Redis } from "ioredis";
import type { AppLogger } from "../lib/logger.js";

export type QrCodeEntityType = "sale" | "lot";
export type QrCodeStatus = "active" | "disabled";

export type QrCodeDto = {
  id: string;
  shortCode: string;
  shortUrl: string;
  entityType: QrCodeEntityType;
  entityId: string;
  destinationUrl: string;
  campaign: string | null;
  placement: string | null;
  status: QrCodeStatus;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type QrCodeAnalyticsDto = {
  totalScans: number;
  daily: { day: string; scans: number }[];
  byCountry: { country: string; scans: number }[];
  byDevice: { deviceType: string; scans: number }[];
};

type ResolveResult =
  | { ok: true; qrCodeId: string; destinationUrl: string }
  | { ok: false; status: 404 | 410; reason: "not_found" | "inactive" | "expired" };

type CachedResolve = {
  qrCodeId: string;
  destinationUrl: string;
  status: QrCodeStatus;
  expiresAt: string | null;
};

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const SHORT_CODE_LENGTH = 8;
const COUNTER_MASK = 0x5deece66dn;
const CACHE_TTL_SECONDS = 60;
const IN_MEMORY_TTL_MS = CACHE_TTL_SECONDS * 1000;
const IN_MEMORY_MAX_ENTRIES = 500;

type InMemoryEntry = { value: CachedResolve; expiresAtEpoch: number };

const inMemoryCache = new Map<string, InMemoryEntry>();

export function encodeQrSequence(sequence: bigint): string {
  const shuffled = sequence ^ COUNTER_MASK;
  let value = shuffled;
  let out = "";
  do {
    out = BASE62[Number(value % 62n)] + out;
    value /= 62n;
  } while (value > 0n);
  return out.padStart(SHORT_CODE_LENGTH, BASE62[0]);
}

export function decodeQrSequence(code: string): bigint {
  let value = 0n;
  for (const char of code) {
    const idx = BASE62.indexOf(char);
    if (idx < 0) throw new Error("Invalid Base62 character");
    value = value * 62n + BigInt(idx);
  }
  return value ^ COUNTER_MASK;
}

export class QrCodeService {
  constructor(
    private readonly db: Database,
    private readonly redis: Redis,
    private readonly apiPublicUrl: string,
    private readonly webOrigin: string,
    private readonly logger?: AppLogger,
    private readonly scanQueue?: Queue<QrCodeScanJobPayload>,
  ) {}

  /**
   * Ensures a default QR code exists for the entity. This is an idempotent
   * "ensure" operation: it never mutates an existing code's metadata. Callers
   * that need to edit metadata must use {@link update}. The `created` flag lets
   * callers distinguish a fresh code from a pre-existing one.
   */
  async getOrCreateDefault(input: {
    entityType: QrCodeEntityType;
    entityId: string;
    actorUserId?: string | null;
  }): Promise<{ item: QrCodeDto; created: boolean } | null> {
    const existing = await this.getDefault(input.entityType, input.entityId);
    if (existing) return { item: existing, created: false };

    const entity = await this.loadEntity(input.entityType, input.entityId);
    if (!entity) return null;

    const shortCode = await this.nextShortCode();
    try {
      const [created] = await this.db
        .insert(qrCode)
        .values({
          shortCode,
          entityType: input.entityType,
          entityId: input.entityId,
          createdByUserId: input.actorUserId ?? null,
        })
        .returning();
      if (!created) throw new Error("qr_code insert returned no row");
      return { item: this.toDto(created, entity.destinationPath), created: true };
    } catch (error) {
      const raced = await this.getDefault(input.entityType, input.entityId);
      if (raced) return { item: raced, created: false };
      throw error;
    }
  }

  async listForEntity(entityType: QrCodeEntityType, entityId: string): Promise<QrCodeDto[]> {
    const entity = await this.loadEntity(entityType, entityId);
    if (!entity) return [];
    const rows = await this.db
      .select()
      .from(qrCode)
      .where(and(eq(qrCode.entityType, entityType), eq(qrCode.entityId, entityId)))
      .orderBy(desc(qrCode.createdAt));
    return rows.map((row) => this.toDto(row, entity.destinationPath));
  }

  async update(
    id: string,
    patch: {
      campaign?: string | null | undefined;
      placement?: string | null | undefined;
      status?: QrCodeStatus | undefined;
      expiresAt?: string | null | undefined;
    },
  ): Promise<QrCodeDto | null> {
    const values: Partial<typeof qrCode.$inferInsert> = {
      updatedAt: new Date(),
    };
    if ("campaign" in patch) values.campaign = patch.campaign ?? null;
    if ("placement" in patch) values.placement = patch.placement ?? null;
    if (patch.status) values.status = patch.status;
    if ("expiresAt" in patch) values.expiresAt = patch.expiresAt ? new Date(patch.expiresAt) : null;

    const [updated] = await this.db.update(qrCode).set(values).where(eq(qrCode.id, id)).returning();
    if (!updated) return null;
    await this.invalidate(updated.shortCode);
    const entity = await this.loadEntity(updated.entityType, updated.entityId);
    if (!entity) return null;
    return this.toDto(updated, entity.destinationPath);
  }

  async regenerateDefault(input: {
    entityType: QrCodeEntityType;
    entityId: string;
    actorUserId?: string | null;
  }): Promise<QrCodeDto | null> {
    const entity = await this.loadEntity(input.entityType, input.entityId);
    if (!entity) return null;

    const newShortCode = await this.nextShortCode();
    const oldShortCodes: string[] = [];
    const created = await this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(qrCode)
        .where(
          and(
            eq(qrCode.entityType, input.entityType),
            eq(qrCode.entityId, input.entityId),
            eq(qrCode.isDefault, true),
          ),
        )
        .limit(1);

      if (current) {
        oldShortCodes.push(current.shortCode);
        await tx
          .update(qrCode)
          .set({ isDefault: false, status: "disabled", updatedAt: new Date() })
          .where(eq(qrCode.id, current.id));
      }

      const [row] = await tx
        .insert(qrCode)
        .values({
          shortCode: newShortCode,
          entityType: input.entityType,
          entityId: input.entityId,
          isDefault: true,
          createdByUserId: input.actorUserId ?? null,
        })
        .returning();
      if (!row) throw new Error("qr_code regenerate insert returned no row");
      return row;
    });

    await Promise.all(oldShortCodes.map((shortCode) => this.invalidate(shortCode)));
    return this.toDto(created, entity.destinationPath);
  }

  async resolve(shortCode: string): Promise<ResolveResult> {
    const cached = await this.getCached(shortCode);
    if (cached) return this.resolveCached(cached);

    const [row] = await this.db
      .select()
      .from(qrCode)
      .where(eq(qrCode.shortCode, shortCode))
      .limit(1);
    if (!row) return { ok: false, status: 404, reason: "not_found" };

    const entity = await this.loadEntity(row.entityType, row.entityId);
    if (!entity) return { ok: false, status: 404, reason: "not_found" };

    const cachedValue: CachedResolve = {
      qrCodeId: row.id,
      destinationUrl: this.absoluteWebUrl(entity.destinationPath),
      status: row.status,
      expiresAt: row.expiresAt?.toISOString() ?? null,
    };
    await this.setCached(shortCode, cachedValue);
    return this.resolveCached(cachedValue);
  }

  async enqueueScan(input: QrCodeScanJobPayload): Promise<void> {
    try {
      if (this.scanQueue) {
        await this.scanQueue.add("record-scan", input);
        return;
      }
      await persistQrCodeScan(this.db, input);
    } catch (error) {
      this.logger?.error(
        { err: error, qr_code_id: input.qrCodeId, request_id: input.requestId ?? undefined },
        "qr_code scan enqueue failed",
      );
    }
  }

  async analytics(qrCodeId: string, days: number): Promise<QrCodeAnalyticsDto> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);
    since.setUTCHours(0, 0, 0, 0);
    const rows = await this.db
      .select({
        day: qrCodeScanDaily.day,
        country: qrCodeScanDaily.country,
        deviceType: qrCodeScanDaily.deviceType,
        scans: qrCodeScanDaily.scans,
      })
      .from(qrCodeScanDaily)
      .where(and(eq(qrCodeScanDaily.qrCodeId, qrCodeId), gte(qrCodeScanDaily.day, since)));

    const daily = new Map<string, number>();
    const byCountry = new Map<string, number>();
    const byDevice = new Map<string, number>();
    for (const row of rows) {
      const day = row.day.toISOString().slice(0, 10);
      daily.set(day, (daily.get(day) ?? 0) + row.scans);
      byCountry.set(row.country, (byCountry.get(row.country) ?? 0) + row.scans);
      byDevice.set(row.deviceType, (byDevice.get(row.deviceType) ?? 0) + row.scans);
    }
    const totalScans = rows.reduce((sum, row) => sum + row.scans, 0);
    return {
      totalScans,
      daily: toSortedPairs(daily, "day"),
      byCountry: toSortedPairs(byCountry, "country"),
      byDevice: toSortedPairs(byDevice, "deviceType"),
    };
  }

  private async getDefault(
    entityType: QrCodeEntityType,
    entityId: string,
  ): Promise<QrCodeDto | null> {
    const entity = await this.loadEntity(entityType, entityId);
    if (!entity) return null;
    const [row] = await this.db
      .select()
      .from(qrCode)
      .where(
        and(
          eq(qrCode.entityType, entityType),
          eq(qrCode.entityId, entityId),
          eq(qrCode.isDefault, true),
        ),
      )
      .limit(1);
    return row ? this.toDto(row, entity.destinationPath) : null;
  }

  private async loadEntity(
    entityType: QrCodeEntityType,
    entityId: string,
  ): Promise<{ title: string; destinationPath: string } | null> {
    if (entityType === "sale") {
      const [row] = await this.db
        .select({ id: sale.id, title: sale.title })
        .from(sale)
        .where(and(eq(sale.id, entityId), saleNotDeleted()))
        .limit(1);
      return row ? { title: row.title, destinationPath: salePath(row) } : null;
    }
    const [row] = await this.db
      .select({ id: lot.id, title: lot.title })
      .from(lot)
      .where(and(eq(lot.id, entityId), lotNotDeleted()))
      .limit(1);
    return row ? { title: row.title, destinationPath: lotPath(row) } : null;
  }

  private async nextShortCode(): Promise<string> {
    const sequence = BigInt(await this.redis.incr("qr:code:sequence"));
    return encodeQrSequence(sequence);
  }

  private async getCached(shortCode: string): Promise<CachedResolve | null> {
    const local = inMemoryCache.get(shortCode);
    if (local) {
      if (local.expiresAtEpoch > Date.now()) return local.value;
      inMemoryCache.delete(shortCode);
    }
    const raw = await this.redis.get(this.cacheKey(shortCode));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedResolve;
    this.setLocal(shortCode, parsed);
    return parsed;
  }

  private setLocal(shortCode: string, value: CachedResolve): void {
    inMemoryCache.set(shortCode, { value, expiresAtEpoch: Date.now() + IN_MEMORY_TTL_MS });
    if (inMemoryCache.size > IN_MEMORY_MAX_ENTRIES) {
      const first = inMemoryCache.keys().next().value;
      if (first) inMemoryCache.delete(first);
    }
  }

  private async setCached(shortCode: string, value: CachedResolve): Promise<void> {
    this.setLocal(shortCode, value);
    await this.redis.set(this.cacheKey(shortCode), JSON.stringify(value), "EX", CACHE_TTL_SECONDS);
  }

  private async invalidate(shortCode: string): Promise<void> {
    inMemoryCache.delete(shortCode);
    await this.redis.del(this.cacheKey(shortCode));
  }

  private resolveCached(cached: CachedResolve): ResolveResult {
    if (cached.status !== "active") return { ok: false, status: 410, reason: "inactive" };
    if (cached.expiresAt && new Date(cached.expiresAt).getTime() <= Date.now()) {
      return { ok: false, status: 410, reason: "expired" };
    }
    return { ok: true, qrCodeId: cached.qrCodeId, destinationUrl: cached.destinationUrl };
  }

  private toDto(row: typeof qrCode.$inferSelect, destinationPath: string): QrCodeDto {
    return {
      id: row.id,
      shortCode: row.shortCode,
      shortUrl: `${this.apiPublicUrl.replace(/\/$/, "")}/q/${row.shortCode}`,
      entityType: row.entityType,
      entityId: row.entityId,
      destinationUrl: this.absoluteWebUrl(destinationPath),
      campaign: row.campaign,
      placement: row.placement,
      status: row.status,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private absoluteWebUrl(path: string): string {
    return `${this.webOrigin.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  }

  private cacheKey(shortCode: string): string {
    return `qr:resolve:${shortCode}`;
  }
}

export async function persistQrCodeScan(db: Database, input: QrCodeScanJobPayload): Promise<void> {
  const normalized = normalizeScanInput(input);
  const [scan] = await db.insert(qrCodeScan).values(normalized).returning({
    qrCodeId: qrCodeScan.qrCodeId,
    scannedAt: qrCodeScan.scannedAt,
    country: qrCodeScan.country,
    deviceType: qrCodeScan.deviceType,
  });
  if (!scan) return;

  const day = new Date(scan.scannedAt);
  day.setUTCHours(0, 0, 0, 0);
  await db
    .insert(qrCodeScanDaily)
    .values({
      qrCodeId: scan.qrCodeId,
      day,
      country: scan.country ?? "unknown",
      deviceType: scan.deviceType ?? "unknown",
      scans: 1,
    })
    .onConflictDoUpdate({
      target: [
        qrCodeScanDaily.qrCodeId,
        qrCodeScanDaily.day,
        qrCodeScanDaily.country,
        qrCodeScanDaily.deviceType,
      ],
      set: {
        scans: sql`${qrCodeScanDaily.scans} + 1`,
        updatedAt: new Date(),
      },
    });
}

function normalizeScanInput(input: {
  qrCodeId: string;
  ip?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
  requestId?: string | null;
}): typeof qrCodeScan.$inferInsert {
  const ua = parseUserAgent(input.userAgent ?? "");
  return {
    qrCodeId: input.qrCodeId,
    ipPrefix: truncateIp(input.ip ?? ""),
    country: "unknown",
    deviceType: ua.deviceType,
    browser: ua.browser,
    os: ua.os,
    referrerHost: hostOnly(input.referrer ?? ""),
    requestId: input.requestId ?? null,
  };
}

export function truncateIp(ip: string): string | null {
  const trimmed = ip.trim();
  if (!trimmed) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(trimmed)) {
    return `${trimmed.split(".").slice(0, 3).join(".")}.0`;
  }
  if (trimmed.includes(":")) {
    return `${trimmed.split(":").slice(0, 4).join(":")}::`;
  }
  return null;
}

function hostOnly(referrer: string): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).host;
  } catch {
    return null;
  }
}

function parseUserAgent(userAgent: string): { deviceType: string; browser: string; os: string } {
  const ua = userAgent.toLowerCase();
  const deviceType = /mobile|iphone|android/.test(ua)
    ? "mobile"
    : /ipad|tablet/.test(ua)
      ? "tablet"
      : "desktop";
  const browser = ua.includes("edg/")
    ? "edge"
    : ua.includes("chrome/")
      ? "chrome"
      : ua.includes("safari/")
        ? "safari"
        : ua.includes("firefox/")
          ? "firefox"
          : "unknown";
  const os = ua.includes("android")
    ? "android"
    : ua.includes("iphone") || ua.includes("ipad")
      ? "ios"
      : ua.includes("mac os")
        ? "macos"
        : ua.includes("windows")
          ? "windows"
          : "unknown";
  return { deviceType, browser, os };
}

function toSortedPairs<K extends "day" | "country" | "deviceType">(
  map: Map<string, number>,
  key: K,
): Array<Record<K, string> & { scans: number }> {
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, scans]) => ({ [key]: value, scans }) as Record<K, string> & { scans: number });
}
