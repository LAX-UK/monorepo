import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { parseLot, parseSale } from "@/lib/data/http/parse";
import type { Lot, Sale } from "@auction/types";

export type AdminSaleListRow = {
  sale: Sale;
  lots: Lot[];
  deleteEligibility?: SaleDeleteEligibility | null;
};

export type SaleDeleteEligibility = {
  canDelete: boolean;
  confirmationPhrase: string | null;
  guards: {
    bidCount: number;
    paymentCount: number;
    approvedRegistrationCount: number;
  };
  blockers: string[];
};

function parseSaleDeleteEligibility(raw: unknown): SaleDeleteEligibility | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const guardsRaw = o.guards;
  const guards =
    guardsRaw && typeof guardsRaw === "object"
      ? {
          bidCount: Number((guardsRaw as Record<string, unknown>).bidCount ?? 0),
          paymentCount: Number((guardsRaw as Record<string, unknown>).paymentCount ?? 0),
          approvedRegistrationCount: Number(
            (guardsRaw as Record<string, unknown>).approvedRegistrationCount ?? 0,
          ),
        }
      : { bidCount: 0, paymentCount: 0, approvedRegistrationCount: 0 };
  const blockers = Array.isArray(o.blockers) ? o.blockers.map(String) : [];
  return {
    canDelete: o.canDelete === true,
    confirmationPhrase:
      o.confirmationPhrase == null || o.confirmationPhrase === ""
        ? null
        : String(o.confirmationPhrase),
    guards,
    blockers,
  };
}

export async function getAdminSalesList(
  params: {
    status?: Sale["status"];
    q?: string;
    deliveryMode?: Sale["deliveryMode"];
    settlementStatus?: "settled" | "unsettled";
    categoryId?: string;
    limit?: number;
    offset?: number;
    sort?: "createdDesc" | "startAsc";
    needsSetup?: boolean;
  } = {},
): Promise<AdminSaleListRow[]> {
  const qs = new URLSearchParams();
  // GET /sales rejects limit > 100 (listSalesQuerySchema.max(100)).
  qs.set("limit", String(Math.min(params.limit ?? 50, 100)));
  qs.set("offset", String(params.offset ?? 0));
  if (params.status) qs.set("status", params.status);
  if (params.q?.trim()) qs.set("q", params.q.trim());
  if (params.deliveryMode) qs.set("deliveryMode", params.deliveryMode);
  if (params.settlementStatus) qs.set("settlementStatus", params.settlementStatus);
  if (params.categoryId) qs.set("categoryId", params.categoryId);
  if (params.sort) qs.set("sort", params.sort);
  if (params.needsSetup) qs.set("needsSetup", "1");
  const res = await authedServerFetch(`/sales?${qs.toString()}`);
  if (!res.ok) throw new Error(`Failed to load sales: ${res.status}`);
  const body = (await res.json()) as {
    data: { sale: unknown; lots: unknown[]; deleteEligibility?: unknown }[];
  };
  return body.data.map((row) => ({
    sale: parseSale(row.sale),
    lots: row.lots.map(parseLot),
    ...(row.deleteEligibility != null
      ? { deleteEligibility: parseSaleDeleteEligibility(row.deleteEligibility) }
      : {}),
  }));
}

export type AdminSaleDetailRow = AdminSaleListRow & {
  sale: AdminSaleListRow["sale"] & {
    coverImagePresentedUrls?: string[];
    dayImagePresentedUrls?: string[];
  };
};

export async function getAdminSaleById(id: string): Promise<AdminSaleDetailRow | null> {
  const res = await authedServerFetch(`/sales/${encodeURIComponent(id)}/catalog-admin`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load sale: ${res.status}`);
  const body = (await res.json()) as {
    data: { sale: unknown; lots: unknown[]; deleteEligibility?: unknown };
  };
  const saleRaw = body.data.sale as Record<string, unknown>;
  const coverImagePresentedUrls = Array.isArray(saleRaw.coverImagePresentedUrls)
    ? (saleRaw.coverImagePresentedUrls as unknown[]).map(String)
    : undefined;
  const dayImagePresentedUrls = Array.isArray(saleRaw.dayImagePresentedUrls)
    ? (saleRaw.dayImagePresentedUrls as unknown[]).map(String)
    : undefined;
  const sale = parseSale(saleRaw);
  const deleteEligibility = parseSaleDeleteEligibility(body.data.deleteEligibility);
  return {
    sale: {
      ...sale,
      ...(coverImagePresentedUrls !== undefined ? { coverImagePresentedUrls } : {}),
      ...(dayImagePresentedUrls !== undefined ? { dayImagePresentedUrls } : {}),
    },
    lots: body.data.lots.map(parseLot),
    ...(deleteEligibility ? { deleteEligibility } : {}),
  };
}

export type AdminSaleRegistrationRow = {
  id: string;
  saleId: string;
  userId: string;
  buyerLegalEntityId: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  requestedAt: string;
  decidedAt: string | null;
  decidedByUserId: string | null;
  bidLimit: string | null;
  paddleNumber: number | null;
  checkedInAt: string | null;
  kycStatus: string | null;
  laxNotes: string | null;
  rejectionReason: string | null;
  userEmail: string | null;
  userName: string | null;
  buyerLegalEntityDisplayName: string | null;
  /** Active membership role for the bidder on the buying entity (if any). */
  memberRole: string | null;
};

const adminSaleRegistrationStatuses = ["pending", "approved", "rejected", "withdrawn"] as const;

function parseAdminSaleRegistrationRow(raw: unknown): AdminSaleRegistrationRow {
  const o = raw as Record<string, unknown>;
  const st = o.status;
  const status =
    typeof st === "string" && (adminSaleRegistrationStatuses as readonly string[]).includes(st)
      ? (st as AdminSaleRegistrationRow["status"])
      : "pending";
  return {
    id: String(o.id ?? ""),
    saleId: String(o.saleId ?? ""),
    userId: String(o.userId ?? ""),
    buyerLegalEntityId: String(o.buyerLegalEntityId ?? ""),
    status,
    requestedAt: typeof o.requestedAt === "string" ? o.requestedAt : "",
    decidedAt: o.decidedAt == null || o.decidedAt === "" ? null : String(o.decidedAt),
    decidedByUserId: o.decidedByUserId == null ? null : String(o.decidedByUserId),
    bidLimit: o.bidLimit == null ? null : String(o.bidLimit),
    paddleNumber:
      o.paddleNumber == null || o.paddleNumber === ""
        ? null
        : Number.parseInt(String(o.paddleNumber), 10),
    checkedInAt: o.checkedInAt == null || o.checkedInAt === "" ? null : String(o.checkedInAt),
    kycStatus: o.kycStatus == null ? null : String(o.kycStatus),
    laxNotes: o.laxNotes == null ? null : String(o.laxNotes),
    rejectionReason: o.rejectionReason == null ? null : String(o.rejectionReason),
    userEmail: o.userEmail == null ? null : String(o.userEmail),
    userName: o.userName == null ? null : String(o.userName),
    buyerLegalEntityDisplayName:
      o.buyerLegalEntityDisplayName == null ? null : String(o.buyerLegalEntityDisplayName),
    memberRole: o.memberRole == null || o.memberRole === "" ? null : String(o.memberRole),
  };
}

export async function getAdminSaleRegistrations(
  saleId: string,
  params?: { status?: AdminSaleRegistrationRow["status"] },
): Promise<AdminSaleRegistrationRow[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  const suffix = qs.size ? `?${qs.toString()}` : "";
  const res = await authedServerFetch(
    `/admin/sales/${encodeURIComponent(saleId)}/registrations${suffix}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Failed to load sale registrations: ${res.status}`);
  const body = (await res.json()) as { data: { items: unknown[] } };
  return body.data.items.map(parseAdminSaleRegistrationRow);
}

export type AdminCheckInCandidateEntity = {
  id: string;
  displayName: string;
  role: string;
  kind: string;
  existingRegistration: {
    status: string;
    paddleNumber: number | null;
    bidLimit: string | null;
    checkedInAt: string | null;
  } | null;
};

export type AdminCheckInCandidate = {
  userId: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  kycStatus: string;
  suspended: boolean;
  eligibleEntities: AdminCheckInCandidateEntity[];
};

export function parseAdminCheckInCandidate(raw: unknown): AdminCheckInCandidate {
  const o = raw as Record<string, unknown>;
  const entitiesRaw = Array.isArray(o.eligibleEntities) ? o.eligibleEntities : [];
  return {
    userId: String(o.userId ?? ""),
    name: o.name == null ? null : String(o.name),
    email: String(o.email ?? ""),
    emailVerified: Boolean(o.emailVerified),
    kycStatus: String(o.kycStatus ?? ""),
    suspended: Boolean(o.suspended),
    eligibleEntities: entitiesRaw.map((e) => {
      const ent = e as Record<string, unknown>;
      const reg = ent.existingRegistration as Record<string, unknown> | null | undefined;
      return {
        id: String(ent.id ?? ""),
        displayName: String(ent.displayName ?? ""),
        role: String(ent.role ?? ""),
        kind: String(ent.kind ?? ""),
        existingRegistration:
          reg == null
            ? null
            : {
                status: String(reg.status ?? ""),
                paddleNumber:
                  reg.paddleNumber == null || reg.paddleNumber === ""
                    ? null
                    : Number.parseInt(String(reg.paddleNumber), 10),
                bidLimit: reg.bidLimit == null ? null : String(reg.bidLimit),
                checkedInAt:
                  reg.checkedInAt == null || reg.checkedInAt === ""
                    ? null
                    : String(reg.checkedInAt),
              },
      };
    }),
  };
}

export async function getAdminSaleroomCheckInCandidates(
  saleId: string,
  q: string,
): Promise<AdminCheckInCandidate[]> {
  const qs = new URLSearchParams({ q });
  const res = await authedServerFetch(
    `/admin/sales/${encodeURIComponent(saleId)}/registrations/check-in-candidates?${qs.toString()}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Failed to load check-in candidates");
  }
  const body = (await res.json()) as { data?: { items?: unknown[] } };
  return (body.data?.items ?? []).map(parseAdminCheckInCandidate);
}
