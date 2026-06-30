import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import type {
  LegalEntity,
  LegalEntityKind,
  LegalEntityStatus,
  LegalEntitySubkind,
} from "@auction/types";
import { legalEntityKinds, legalEntityStatuses, legalEntitySubkinds } from "@auction/types";

export type AdminStripeConnectRequirementRow = {
  id: string;
  displayName: string;
  status: LegalEntityStatus;
  stripeConnectRequirementsCurrentlyDue: string[];
};

export async function getAdminLegalEntitiesWithStripeConnectRequirements(): Promise<
  AdminStripeConnectRequirementRow[]
> {
  const res = await authedServerFetch("/admin/legal-entities/stripe-connect-requirements");
  if (!res.ok) {
    throw new Error(`Failed to load legal entities with Stripe requirements: ${res.status}`);
  }
  const body = (await res.json()) as { data: Record<string, unknown>[] };
  return body.data.map((row) => ({
    id: String(row.id ?? ""),
    displayName: String(row.displayName ?? ""),
    status: row.status as LegalEntityStatus,
    stripeConnectRequirementsCurrentlyDue: Array.isArray(row.stripeConnectRequirementsCurrentlyDue)
      ? row.stripeConnectRequirementsCurrentlyDue.map(String)
      : [],
  }));
}

/** Narrow row for admin picker UIs (matches GET /admin/legal-entities/browse). */
export type AdminLegalEntityPickerRow = {
  id: string;
  displayName: string;
  status: LegalEntityStatus;
};

/** Directory list row from GET /admin/legal-entities/browse. */
export type AdminLegalEntityListRow = {
  id: string;
  displayName: string;
  status: LegalEntityStatus;
  kind: LegalEntityKind;
  subkind: LegalEntitySubkind;
  updatedAt: string;
  stripeDueCount: number;
};

export type AdminLegalEntityListResult = {
  rows: AdminLegalEntityListRow[];
  total: number;
};

function parseLegalEntityBrowseRow(row: {
  id: string;
  displayName: string;
  status: string;
  kind?: string;
  subkind?: string;
  updatedAt?: string | Date;
  stripeDueCount?: number;
}): AdminLegalEntityListRow {
  const status =
    typeof row.status === "string" && legalEntityStatuses.includes(row.status as LegalEntityStatus)
      ? (row.status as LegalEntityStatus)
      : "lead";
  const kind =
    typeof row.kind === "string" && legalEntityKinds.includes(row.kind as LegalEntityKind)
      ? (row.kind as LegalEntityKind)
      : "organisation";
  const subkind =
    typeof row.subkind === "string" &&
    legalEntitySubkinds.includes(row.subkind as LegalEntitySubkind)
      ? (row.subkind as LegalEntitySubkind)
      : "other";
  const updatedAt =
    row.updatedAt instanceof Date
      ? row.updatedAt.toISOString()
      : typeof row.updatedAt === "string"
        ? row.updatedAt
        : new Date(0).toISOString();

  return {
    id: row.id,
    displayName: row.displayName,
    status,
    kind,
    subkind,
    updatedAt,
    stripeDueCount: Number(row.stripeDueCount ?? 0),
  };
}

function parseAdminLegalEntityBrowsePayload(data: unknown): AdminLegalEntityListResult {
  if (data && typeof data === "object" && "rows" in data) {
    const payload = data as { rows?: unknown; total?: unknown };
    const rawRows = Array.isArray(payload.rows) ? payload.rows : [];
    const rows = rawRows.map((row) => parseLegalEntityBrowseRow(row));
    const total =
      typeof payload.total === "number"
        ? payload.total
        : Number.parseInt(String(payload.total ?? ""), 10) || rows.length;
    return { rows, total };
  }

  return { rows: [], total: 0 };
}

export async function getAdminLegalEntityList(params: {
  q?: string;
  status?: LegalEntityStatus;
  kind?: LegalEntityKind;
  stripeDue?: boolean;
  createdByUserId?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminLegalEntityListResult> {
  const qs = new URLSearchParams();
  if (params.q?.trim()) qs.set("q", params.q.trim());
  if (params.status) qs.set("status", params.status);
  if (params.kind) qs.set("kind", params.kind);
  if (params.stripeDue) qs.set("stripeDue", "1");
  if (params.createdByUserId) qs.set("createdByUserId", params.createdByUserId);
  qs.set("limit", String(params.limit ?? 25));
  qs.set("offset", String(params.offset ?? 0));
  const res = await authedServerFetch(`/admin/legal-entities/browse?${qs.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to load legal entities: ${res.status}`);
  }
  const body = (await res.json()) as { data: unknown };
  return parseAdminLegalEntityBrowsePayload(body.data);
}

export async function searchAdminLegalEntitiesForPicker(params: {
  q?: string;
  createdByUserId?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminLegalEntityPickerRow[]> {
  const result = await getAdminLegalEntityList({
    ...(params.q?.trim() ? { q: params.q.trim() } : {}),
    ...(params.createdByUserId ? { createdByUserId: params.createdByUserId } : {}),
    limit: params.limit ?? 25,
    offset: params.offset ?? 0,
  });
  return result.rows.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    status: row.status,
  }));
}

function parseLegalEntityFromAdminApi(raw: Record<string, unknown>): LegalEntity {
  const status =
    typeof raw.status === "string" && legalEntityStatuses.includes(raw.status as LegalEntityStatus)
      ? (raw.status as LegalEntityStatus)
      : "lead";
  const kind =
    typeof raw.kind === "string" &&
    legalEntityKinds.includes(raw.kind as "individual" | "organisation")
      ? (raw.kind as LegalEntity["kind"])
      : "individual";
  const subkind =
    typeof raw.subkind === "string" &&
    legalEntitySubkinds.includes(raw.subkind as LegalEntity["subkind"])
      ? (raw.subkind as LegalEntity["subkind"])
      : "other";
  const req = raw.stripeConnectRequirementsCurrentlyDue;
  const stripeConnectRequirementsCurrentlyDue = Array.isArray(req)
    ? (req as unknown[]).map((x) => String(x))
    : [];
  return {
    id: String(raw.id ?? ""),
    displayName: String(raw.displayName ?? ""),
    legalName: raw.legalName == null ? null : String(raw.legalName),
    slug: raw.slug == null ? null : String(raw.slug),
    kind,
    subkind,
    createdByUserId: String(raw.createdByUserId ?? ""),
    status,
    statusChangedAt: raw.statusChangedAt ? new Date(String(raw.statusChangedAt)) : null,
    statusChangedByUserId:
      raw.statusChangedByUserId == null ? null : String(raw.statusChangedByUserId),
    statusReason: raw.statusReason == null ? null : String(raw.statusReason),
    stripeConnectAccountId:
      raw.stripeConnectAccountId == null ? null : String(raw.stripeConnectAccountId),
    stripeConnectChargesEnabled: Boolean(raw.stripeConnectChargesEnabled ?? false),
    stripeConnectPayoutsEnabled: Boolean(raw.stripeConnectPayoutsEnabled ?? false),
    stripeConnectRequirementsCurrentlyDue,
    stripeConnectDisabledReason:
      raw.stripeConnectDisabledReason == null ? null : String(raw.stripeConnectDisabledReason),
    xeroContactId: raw.xeroContactId == null ? null : String(raw.xeroContactId),
    stripeCustomerId: raw.stripeCustomerId == null ? null : String(raw.stripeCustomerId),
    vatNumber: raw.vatNumber == null ? null : String(raw.vatNumber),
    marginSchemeEligible: Boolean(raw.marginSchemeEligible ?? false),
    isLaxManaged: Boolean(raw.isLaxManaged ?? false),
    platformFeeBps: raw.platformFeeBps == null ? null : Number(raw.platformFeeBps),
    createdAt: new Date(String(raw.createdAt ?? "")),
    updatedAt: new Date(String(raw.updatedAt ?? "")),
  };
}

export async function getAdminLegalEntityById(id: string): Promise<LegalEntity | null> {
  const res = await authedServerFetch(`/admin/legal-entities/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load legal entity: ${res.status}`);
  const body = (await res.json()) as { data: Record<string, unknown> };
  return parseLegalEntityFromAdminApi(body.data);
}

export type AdminLegalEntityDocument = {
  id: string;
  kind: string;
  label: string | null;
  reviewStatus: string;
  reviewNotes: string | null;
  reviewedAt: Date | null;
  uploadedAt: Date;
  uploadedByUserId: string;
  downloadUrl: string;
  contentType: string | null;
  byteSize: number | null;
};

export async function getAdminLegalEntityDocuments(
  id: string,
): Promise<AdminLegalEntityDocument[]> {
  const res = await authedServerFetch(`/admin/legal-entities/${encodeURIComponent(id)}/documents`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Failed to load legal entity documents: ${res.status}`);
  const body = (await res.json()) as { data: Record<string, unknown>[] };
  return body.data.map((raw) => ({
    id: String(raw.id ?? ""),
    kind: String(raw.kind ?? ""),
    label: raw.label == null ? null : String(raw.label),
    reviewStatus: String(raw.reviewStatus ?? "pending"),
    reviewNotes: raw.reviewNotes == null ? null : String(raw.reviewNotes),
    reviewedAt: raw.reviewedAt ? new Date(String(raw.reviewedAt)) : null,
    uploadedAt: new Date(String(raw.uploadedAt ?? "")),
    uploadedByUserId: String(raw.uploadedByUserId ?? ""),
    downloadUrl: String(raw.downloadUrl ?? ""),
    contentType: raw.contentType == null ? null : String(raw.contentType),
    byteSize: raw.byteSize == null ? null : Number(raw.byteSize),
  }));
}
