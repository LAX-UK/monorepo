import { sql } from "drizzle-orm";
import type { Database } from "../client.js";
import { qrCodeScan, qrCodeScanDaily } from "../schema/index.js";

/** Mirrors {@link import("@auction/queues").QrCodeScanJobPayload} without a queues dependency. */
export type QrCodeScanInput = {
  qrCodeId: string;
  ip?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
  requestId?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
};

export async function persistQrCodeScan(db: Database, input: QrCodeScanInput): Promise<void> {
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

function normalizeScanInput(input: QrCodeScanInput): typeof qrCodeScan.$inferInsert {
  const ua = parseUserAgent(input.userAgent ?? "");
  return {
    qrCodeId: input.qrCodeId,
    ipPrefix: truncateIp(input.ip ?? ""),
    country: input.country?.trim() || "unknown",
    region: input.region?.trim() || null,
    city: input.city?.trim() || null,
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
