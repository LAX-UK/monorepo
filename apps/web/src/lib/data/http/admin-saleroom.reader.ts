import "server-only";

import type { AdminPaddleRosterEntry } from "@/lib/data/http/admin-paddle.types";
import {
  adminPaddleRosterItemsEnvelopeSchema,
  adminSaleroomSessionSnapshotSchema,
  adminSaleroomSessionsResponseSchema,
} from "@/lib/data/http/admin-saleroom.schema";
import type {
  AdminSaleroomSessionSnapshot,
  AdminSaleroomSessionStatusRow,
} from "@/lib/data/http/admin-saleroom.types";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";

export async function getAdminSalePaddleRoster(saleId: string): Promise<AdminPaddleRosterEntry[]> {
  const res = await authedServerFetch(`/admin/sales/${encodeURIComponent(saleId)}/paddles`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load paddle roster: ${res.status}`);
  const body = await readJsonBody(res);
  return readDataEnvelope(
    body,
    adminPaddleRosterItemsEnvelopeSchema,
    `GET /admin/sales/${saleId}/paddles`,
  );
}

export async function getAdminSaleroomSession(
  saleId: string,
): Promise<AdminSaleroomSessionSnapshot> {
  const res = await authedServerFetch(
    `/admin/sales/${encodeURIComponent(saleId)}/saleroom/session`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Failed to load saleroom session: ${res.status}`);
  const body = await readJsonBody(res);
  return readDataEnvelope(
    body,
    adminSaleroomSessionSnapshotSchema,
    `GET /admin/sales/${saleId}/saleroom/session`,
  );
}

export async function getAdminSaleroomSessions(
  saleIds: string[],
): Promise<AdminSaleroomSessionStatusRow[]> {
  if (saleIds.length === 0) return [];
  const res = await authedServerFetch(
    `/admin/saleroom/sessions?saleIds=${saleIds.map(encodeURIComponent).join(",")}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Failed to load saleroom sessions: ${res.status}`);
  const body = await readJsonBody(res);
  return adminSaleroomSessionsResponseSchema.parse(body);
}
