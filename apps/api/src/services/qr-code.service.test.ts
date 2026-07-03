import { persistQrCodeScan, truncateIp } from "@auction/db";
import { DrizzleQrCodeRepository } from "@auction/persistence";
import { describe, expect, it, vi } from "vitest";
import { QrCodeService, decodeQrSequence, encodeQrSequence } from "./qr-code.service.js";
import { resolveFromCached } from "./qr-code/qr-code-cache.js";
import type { QrCodeCachedResolve } from "./qr-code/qr-code-types.js";

describe("QR code helpers", () => {
  it("round-trips shuffled Base62 sequences", () => {
    for (const value of [1n, 42n, 10_000n, 9_999_999n]) {
      const code = encodeQrSequence(value);
      expect(code).toMatch(/^[0-9A-Za-z]{8,}$/);
      expect(decodeQrSequence(code)).toBe(value);
    }
  });

  it("truncates IP addresses before storage", () => {
    expect(truncateIp("203.0.113.42")).toBe("203.0.113.0");
    expect(truncateIp("2001:db8:abcd:0012:0000:0000:0000:0001")).toBe("2001:db8:abcd:0012::");
    expect(truncateIp("not-an-ip")).toBeNull();
  });

  it("resolveFromCached returns 410 for inactive codes", () => {
    const cached: QrCodeCachedResolve = {
      qrCodeId: "qr_1",
      destinationUrl: "https://example.test/sale/1",
      status: "disabled",
      expiresAt: null,
    };
    expect(resolveFromCached(cached)).toEqual({
      ok: false,
      status: 410,
      reason: "inactive",
    });
  });

  it("resolveFromCached returns 410 for expired codes", () => {
    const cached: QrCodeCachedResolve = {
      qrCodeId: "qr_1",
      destinationUrl: "https://example.test/sale/1",
      status: "active",
      expiresAt: "2020-01-01T00:00:00.000Z",
    };
    expect(resolveFromCached(cached)).toEqual({
      ok: false,
      status: 410,
      reason: "expired",
    });
  });

  it("enqueues scan payloads without writing inline when a queue is configured", async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const service = new QrCodeService(
      {} as never,
      {} as never,
      "https://www.example.test",
      undefined,
      { add } as never,
      {} as never,
    );

    await service.enqueueScan({
      qrCodeId: "qr_1",
      ip: "203.0.113.42",
      userAgent: "Mozilla/5.0",
      referrer: "https://example.test",
      requestId: "req_1",
    });

    expect(add).toHaveBeenCalledWith(
      "record-scan",
      expect.objectContaining({ qrCodeId: "qr_1", requestId: "req_1" }),
    );
  });

  it("regenerates the default QR code by disabling the old row and inserting a new default", async () => {
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    const insertReturning = vi.fn().mockResolvedValue([
      {
        id: "new-qr",
        shortCode: "0000000A",
        entityType: "lot",
        entityId: "11111111-1111-4111-8111-111111111111",
        campaign: null,
        placement: null,
        status: "active",
        expiresAt: null,
        isDefault: true,
        createdByUserId: "user_1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    const tx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "old-qr",
                shortCode: "OLD12345",
                entityType: "lot",
                entityId: "11111111-1111-4111-8111-111111111111",
                campaign: null,
                placement: null,
                status: "active",
                expiresAt: null,
                isDefault: true,
                createdByUserId: null,
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                updatedAt: new Date("2026-01-01T00:00:00.000Z"),
              },
            ]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({ set: updateSet }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({ returning: insertReturning }),
      }),
    };
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([
                { id: "11111111-1111-4111-8111-111111111111", title: "Lot title" },
              ]),
          }),
        }),
      }),
      transaction: vi.fn(async (fn) => fn(tx)),
    };
    const redis = { incr: vi.fn().mockResolvedValue(103n), del: vi.fn().mockResolvedValue(1) };
    const service = new QrCodeService(
      db as never,
      redis as never,
      "https://www.example.test",
      undefined,
      undefined,
      new DrizzleQrCodeRepository(db as never),
    );

    const result = await service.regenerateDefault({
      entityType: "lot",
      entityId: "11111111-1111-4111-8111-111111111111",
      actorUserId: "user_1",
    });

    expect(result?.id).toBe("new-qr");
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ isDefault: false, status: "disabled" }),
    );
    expect(redis.del).toHaveBeenCalledWith("qr:resolve:OLD12345");
  });

  it("persists provided country on scan rows and daily aggregates", async () => {
    const scanReturning = vi.fn().mockResolvedValue([
      {
        qrCodeId: "qr_1",
        scannedAt: new Date("2026-06-13T12:00:00.000Z"),
        country: "GB",
        deviceType: "mobile",
      },
    ]);
    const scanValues = vi.fn().mockReturnValue({ returning: scanReturning });
    const dailyValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
    });
    const db = {
      insert: vi
        .fn()
        .mockReturnValueOnce({ values: scanValues })
        .mockReturnValueOnce({ values: dailyValues }),
    };

    await persistQrCodeScan(db as never, {
      qrCodeId: "qr_1",
      ip: "203.0.113.42",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      country: "GB",
      region: "England",
      city: "London",
    });

    expect(scanValues).toHaveBeenCalledWith(
      expect.objectContaining({
        qrCodeId: "qr_1",
        country: "GB",
        region: "England",
        city: "London",
        deviceType: "mobile",
      }),
    );
    expect(dailyValues).toHaveBeenCalledWith(
      expect.objectContaining({
        qrCodeId: "qr_1",
        country: "GB",
        deviceType: "mobile",
        scans: 1,
      }),
    );
  });
});
