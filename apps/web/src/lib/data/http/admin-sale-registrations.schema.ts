import type {
  AdminCheckInCandidate,
  AdminCheckInCandidateEntity,
  AdminSaleDetailRow,
  AdminSaleListRow,
  AdminSaleRegistrationRow,
  SaleDeleteEligibility,
} from "@/lib/data/http/admin-sale-registrations.types";
import { lotSchema } from "@/lib/data/http/lot.schema";
import { isIndexableObject, toObjectRecord } from "@/lib/data/http/object-guards";
import { saleSchema } from "@/lib/data/http/sale.schema";
import { zNullableStringFromEmpty } from "@/lib/data/http/schema-coerce";
import { z } from "zod";

const adminSaleRegistrationStatuses = ["pending", "approved", "rejected", "withdrawn"] as const;

export const saleDeleteEligibilitySchema = z
  .preprocess((raw) => raw, z.unknown())
  .transform((raw): SaleDeleteEligibility | null => {
    if (!isIndexableObject(raw)) return null;
    const guardsRaw = raw.guards;
    const guards = isIndexableObject(guardsRaw)
      ? {
          bidCount: Number(guardsRaw.bidCount ?? 0),
          paymentCount: Number(guardsRaw.paymentCount ?? 0),
          approvedRegistrationCount: Number(guardsRaw.approvedRegistrationCount ?? 0),
        }
      : { bidCount: 0, paymentCount: 0, approvedRegistrationCount: 0 };
    const blockers = Array.isArray(raw.blockers) ? raw.blockers.map(String) : [];
    return {
      canDelete: raw.canDelete === true,
      confirmationPhrase: zNullableStringFromEmpty.parse(raw.confirmationPhrase),
      guards,
      blockers,
    };
  });

const adminSaleListRowSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): AdminSaleListRow => {
    const deleteEligibility = saleDeleteEligibilitySchema.parse(row.deleteEligibility);
    return {
      sale: saleSchema.parse(row.sale),
      lots: Array.isArray(row.lots) ? row.lots.map((lot) => lotSchema.parse(lot)) : [],
      ...(deleteEligibility != null ? { deleteEligibility } : {}),
    };
  });

export const adminSaleListRowsSchema = z.array(adminSaleListRowSchema) as z.ZodType<
  AdminSaleListRow[]
>;

const adminSaleDetailRowSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): AdminSaleDetailRow => {
    const saleRaw = isIndexableObject(row.sale) ? row.sale : {};
    const coverImagePresentedUrls = Array.isArray(saleRaw.coverImagePresentedUrls)
      ? saleRaw.coverImagePresentedUrls.map(String)
      : undefined;
    const dayImagePresentedUrls = Array.isArray(saleRaw.dayImagePresentedUrls)
      ? saleRaw.dayImagePresentedUrls.map(String)
      : undefined;
    const sale = saleSchema.parse(saleRaw);
    const deleteEligibility = saleDeleteEligibilitySchema.parse(row.deleteEligibility);
    return {
      sale: {
        ...sale,
        ...(coverImagePresentedUrls !== undefined ? { coverImagePresentedUrls } : {}),
        ...(dayImagePresentedUrls !== undefined ? { dayImagePresentedUrls } : {}),
      },
      lots: Array.isArray(row.lots) ? row.lots.map((lot) => lotSchema.parse(lot)) : [],
      ...(deleteEligibility ? { deleteEligibility } : {}),
    };
  });

export const adminSaleDetailRowSchemaExport =
  adminSaleDetailRowSchema as z.ZodType<AdminSaleDetailRow>;

export const adminSaleRegistrationRowSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): AdminSaleRegistrationRow => {
    const st = row.status;
    const status =
      typeof st === "string" && (adminSaleRegistrationStatuses as readonly string[]).includes(st)
        ? (st as AdminSaleRegistrationRow["status"])
        : "pending";
    return {
      id: String(row.id ?? ""),
      saleId: String(row.saleId ?? ""),
      userId: String(row.userId ?? ""),
      buyerLegalEntityId: String(row.buyerLegalEntityId ?? ""),
      status,
      requestedAt: typeof row.requestedAt === "string" ? row.requestedAt : "",
      decidedAt: zNullableStringFromEmpty.parse(row.decidedAt),
      decidedByUserId: row.decidedByUserId == null ? null : String(row.decidedByUserId),
      bidLimit: row.bidLimit == null ? null : String(row.bidLimit),
      paddleNumber:
        row.paddleNumber == null || row.paddleNumber === ""
          ? null
          : Number.parseInt(String(row.paddleNumber), 10),
      checkedInAt: zNullableStringFromEmpty.parse(row.checkedInAt),
      kycStatus: row.kycStatus == null ? null : String(row.kycStatus),
      laxNotes: row.laxNotes == null ? null : String(row.laxNotes),
      rejectionReason: row.rejectionReason == null ? null : String(row.rejectionReason),
      userEmail: row.userEmail == null ? null : String(row.userEmail),
      userName: row.userName == null ? null : String(row.userName),
      buyerLegalEntityDisplayName:
        row.buyerLegalEntityDisplayName == null ? null : String(row.buyerLegalEntityDisplayName),
      memberRole: zNullableStringFromEmpty.parse(row.memberRole),
    };
  });

const adminSaleRegistrationItemsSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): AdminSaleRegistrationRow[] => {
    const items = Array.isArray(row.items) ? row.items : [];
    return items.map((item) => adminSaleRegistrationRowSchema.parse(item));
  });

export const adminSaleRegistrationItemsEnvelopeSchema =
  adminSaleRegistrationItemsSchema as z.ZodType<AdminSaleRegistrationRow[]>;

const adminCheckInCandidateEntitySchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((ent): AdminCheckInCandidateEntity => {
    const reg = isIndexableObject(ent.existingRegistration) ? ent.existingRegistration : null;
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
              checkedInAt: zNullableStringFromEmpty.parse(reg.checkedInAt),
            },
    };
  });

export const adminCheckInCandidateSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): AdminCheckInCandidate => {
    const entitiesRaw = Array.isArray(row.eligibleEntities) ? row.eligibleEntities : [];
    return {
      userId: String(row.userId ?? ""),
      name: row.name == null ? null : String(row.name),
      email: String(row.email ?? ""),
      emailVerified: Boolean(row.emailVerified),
      kycStatus: String(row.kycStatus ?? ""),
      suspended: Boolean(row.suspended),
      eligibleEntities: entitiesRaw.map((entity) =>
        adminCheckInCandidateEntitySchema.parse(entity),
      ),
    };
  });

const adminCheckInCandidateItemsSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): AdminCheckInCandidate[] => {
    const items = Array.isArray(row.items) ? row.items : [];
    return items.map((item) => adminCheckInCandidateSchema.parse(item));
  });

export const adminCheckInCandidateItemsEnvelopeSchema =
  adminCheckInCandidateItemsSchema as z.ZodType<AdminCheckInCandidate[]>;

export function parseSaleDeleteEligibility(raw: unknown): SaleDeleteEligibility | null {
  return saleDeleteEligibilitySchema.parse(raw);
}

export function parseAdminSaleRegistrationRow(raw: unknown): AdminSaleRegistrationRow {
  return adminSaleRegistrationRowSchema.parse(raw);
}

export function parseAdminCheckInCandidate(raw: unknown): AdminCheckInCandidate {
  return adminCheckInCandidateSchema.parse(raw);
}

type _AdminSaleListRowInfer = z.infer<typeof adminSaleListRowSchema>;
const _adminSaleListRowGuard = null as unknown as _AdminSaleListRowInfer satisfies AdminSaleListRow;
void _adminSaleListRowGuard;
