import { formatRelativeTime } from "@/lib/auth/relative-time";
import { formatDeviceLabel, parseUserAgent } from "@/lib/auth/ua/parse-user-agent";
import type { UserSessionRow } from "@/lib/data/user-session-row";

function formatAbsolute(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export type SessionView = {
  id: string;
  createdAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  isCurrent: boolean;
  deviceLabel: string;
  relativeSignedIn: string;
  expiresDisplay: string;
  /** Full UA for tooltip */
  rawUserAgent: string | null;
};

export function toSessionView(row: UserSessionRow, now: Date): SessionView {
  const parsed = parseUserAgent(row.userAgent);
  return {
    id: row.id,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    isCurrent: row.isCurrent,
    deviceLabel: formatDeviceLabel(parsed),
    relativeSignedIn: formatRelativeTime(row.createdAt, now),
    expiresDisplay: formatAbsolute(row.expiresAt),
    rawUserAgent: row.userAgent,
  };
}
