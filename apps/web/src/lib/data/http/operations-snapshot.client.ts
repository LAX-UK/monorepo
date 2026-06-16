import type { AdminPaddleRosterEntry } from "@/lib/data/http/admin.server";
import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import {
  type AdminSaleOperationsSnapshot,
  parseAdminSaleOperationsSnapshot,
} from "@/lib/telephone/telephone-booking-types";

function parsePaddleRosterEntry(raw: unknown): AdminPaddleRosterEntry | null {
  if (typeof raw !== "object" || raw === null) return null;
  const row = raw as Record<string, unknown>;
  return {
    paddleNumber: Number.parseInt(String(row.paddleNumber ?? "0"), 10),
    userId: String(row.userId ?? ""),
    displayName: String(row.displayName ?? ""),
    bidLimit: row.bidLimit == null ? null : String(row.bidLimit),
    hasActiveSelfServiceSession: Boolean(row.hasActiveSelfServiceSession),
  };
}

export async function fetchAdminSaleOperationsSnapshot(
  saleId: string,
): Promise<AdminSaleOperationsSnapshot | null> {
  const res = await browserFetch(
    `${browserApiBase()}/admin/sales/${encodeURIComponent(saleId)}/operations-snapshot`,
    { cache: "no-store" },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load operations snapshot (${res.status})`);
  const body = (await res.json()) as { data?: unknown };
  return parseAdminSaleOperationsSnapshot(body.data ?? null);
}

export async function fetchAdminSalePaddleRoster(
  saleId: string,
): Promise<AdminPaddleRosterEntry[]> {
  const res = await browserFetch(
    `${browserApiBase()}/admin/sales/${encodeURIComponent(saleId)}/paddles`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Failed to load paddle roster (${res.status})`);
  const body = (await res.json()) as { data?: { items?: unknown[] } };
  return (body.data?.items ?? [])
    .map(parsePaddleRosterEntry)
    .filter((row): row is AdminPaddleRosterEntry => row != null);
}
