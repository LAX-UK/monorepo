import type {
  AdminLegalEntityDocument,
  AdminLegalEntityListResult,
  AdminLegalEntityListRow,
  AdminStripeConnectRequirementRow,
} from "@/lib/data/http/admin-legal-entities.types";
import { isIndexableObject, toObjectRecord } from "@/lib/data/http/object-guards";
import type {
  LegalEntity,
  LegalEntityKind,
  LegalEntityStatus,
  LegalEntitySubkind,
} from "@auction/types";
import { legalEntityKinds, legalEntityStatuses, legalEntitySubkinds } from "@auction/types";
import { z } from "zod";

export const adminStripeConnectRequirementRowSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): AdminStripeConnectRequirementRow => {
    const statusRaw = row.status;
    const status =
      typeof statusRaw === "string" && legalEntityStatuses.includes(statusRaw as LegalEntityStatus)
        ? (statusRaw as LegalEntityStatus)
        : "lead";
    return {
      id: String(row.id ?? ""),
      displayName: String(row.displayName ?? ""),
      status,
      stripeConnectRequirementsCurrentlyDue: Array.isArray(
        row.stripeConnectRequirementsCurrentlyDue,
      )
        ? row.stripeConnectRequirementsCurrentlyDue.map(String)
        : [],
    };
  });

export const adminStripeConnectRequirementRowsSchema = z.array(
  adminStripeConnectRequirementRowSchema,
) as z.ZodType<AdminStripeConnectRequirementRow[]>;

export const adminLegalEntityListRowSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): AdminLegalEntityListRow => {
    const statusRaw = row.status;
    const status =
      typeof statusRaw === "string" && legalEntityStatuses.includes(statusRaw as LegalEntityStatus)
        ? (statusRaw as LegalEntityStatus)
        : "lead";
    const kindRaw = row.kind;
    const kind =
      typeof kindRaw === "string" && legalEntityKinds.includes(kindRaw as LegalEntityKind)
        ? (kindRaw as LegalEntityKind)
        : "organisation";
    const subkindRaw = row.subkind;
    const subkind =
      typeof subkindRaw === "string" &&
      legalEntitySubkinds.includes(subkindRaw as LegalEntitySubkind)
        ? (subkindRaw as LegalEntitySubkind)
        : "other";
    const updatedAtRaw = row.updatedAt;
    const updatedAt =
      updatedAtRaw instanceof Date
        ? updatedAtRaw.toISOString()
        : typeof updatedAtRaw === "string"
          ? updatedAtRaw
          : new Date(0).toISOString();
    return {
      id: String(row.id ?? ""),
      displayName: String(row.displayName ?? ""),
      status,
      kind,
      subkind,
      updatedAt,
      stripeDueCount: Number(row.stripeDueCount ?? 0),
    };
  });

export const adminLegalEntityBrowsePayloadSchema = z
  .preprocess((raw) => raw, z.unknown())
  .transform((raw): AdminLegalEntityListResult => {
    if (isIndexableObject(raw) && "rows" in raw) {
      const rawRows = Array.isArray(raw.rows) ? raw.rows : [];
      const rows = rawRows.map((row) => adminLegalEntityListRowSchema.parse(row));
      const total =
        typeof raw.total === "number"
          ? raw.total
          : Number.parseInt(String(raw.total ?? ""), 10) || rows.length;
      return { rows, total };
    }
    return { rows: [], total: 0 };
  }) as z.ZodType<AdminLegalEntityListResult>;

export const adminLegalEntitySchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((raw): LegalEntity => {
    const statusRaw = raw.status;
    const status =
      typeof statusRaw === "string" && legalEntityStatuses.includes(statusRaw as LegalEntityStatus)
        ? (statusRaw as LegalEntityStatus)
        : "lead";
    const kindRaw = raw.kind;
    const kind =
      typeof kindRaw === "string" &&
      legalEntityKinds.includes(kindRaw as "individual" | "organisation")
        ? (kindRaw as LegalEntity["kind"])
        : "individual";
    const subkindRaw = raw.subkind;
    const subkind =
      typeof subkindRaw === "string" &&
      legalEntitySubkinds.includes(subkindRaw as LegalEntity["subkind"])
        ? (subkindRaw as LegalEntity["subkind"])
        : "other";
    const req = raw.stripeConnectRequirementsCurrentlyDue;
    const stripeConnectRequirementsCurrentlyDue = Array.isArray(req)
      ? req.map((entry) => String(entry))
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
  }) as z.ZodType<LegalEntity>;

export const adminLegalEntityDocumentSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform(
    (raw): AdminLegalEntityDocument => ({
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
    }),
  );

export const adminLegalEntityDocumentsSchema = z.array(adminLegalEntityDocumentSchema) as z.ZodType<
  AdminLegalEntityDocument[]
>;

export function parseLegalEntityFromAdminApi(raw: unknown): LegalEntity {
  return adminLegalEntitySchema.parse(raw);
}

export function parseAdminLegalEntityBrowsePayload(raw: unknown): AdminLegalEntityListResult {
  return adminLegalEntityBrowsePayloadSchema.parse(raw);
}

type _AdminLegalEntityInfer = z.infer<typeof adminLegalEntitySchema>;
const _adminLegalEntityGuard = null as unknown as _AdminLegalEntityInfer satisfies LegalEntity;
void _adminLegalEntityGuard;
