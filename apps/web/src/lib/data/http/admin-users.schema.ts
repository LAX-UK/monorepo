import type {
  AdminKycSessionRow,
  AdminUserActivityEntry,
  AdminUserBidRow,
  AdminUserDetailPayload,
  AdminUserLookupRow,
  AdminUserRow,
} from "@/lib/data/http/admin-users.types";
import { toObjectRecord } from "@/lib/data/http/object-guards";
import { zCoerceDate } from "@/lib/data/http/schema-coerce";
import { z } from "zod";

export const adminUserRowSchema = z.preprocess(toObjectRecord, z.record(z.unknown())).transform(
  (row): AdminUserRow => ({
    id: String(row.id ?? ""),
    email: String(row.email ?? ""),
    name: String(row.name ?? ""),
    firstName: row.firstName == null ? null : String(row.firstName),
    lastName: row.lastName == null ? null : String(row.lastName),
    role: String(row.role ?? ""),
    staffRole: row.staffRole == null ? null : String(row.staffRole),
    createdAt: String(row.createdAt ?? ""),
    updatedAt: String(row.updatedAt ?? ""),
    suspendedAt: row.suspendedAt == null ? null : String(row.suspendedAt),
    image: row.image == null ? null : String(row.image),
    mobile: row.mobile == null ? null : String(row.mobile),
    mobileCountry: row.mobileCountry == null ? null : String(row.mobileCountry),
    emailVerified: Boolean(row.emailVerified),
    emailStatus: String(row.emailStatus ?? ""),
    signupPersona: row.signupPersona == null ? null : String(row.signupPersona),
    twoFactorEnabled: Boolean(row.twoFactorEnabled),
    kycStatus: String(row.kycStatus ?? ""),
    kycVerifiedAt: row.kycVerifiedAt == null ? null : String(row.kycVerifiedAt),
    kycRetryCount: Number(row.kycRetryCount ?? 0),
    deletionRequestedAt: row.deletionRequestedAt == null ? null : String(row.deletionRequestedAt),
  }),
);

export const adminUserDetailRowSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): AdminUserDetailPayload => {
    const base = adminUserRowSchema.parse(row);
    return {
      ...base,
      securityStatusAvailable:
        typeof row.securityStatusAvailable === "boolean" ? row.securityStatusAvailable : false,
      suspendedReason: row.suspendedReason == null ? null : String(row.suspendedReason),
      dateOfBirth: row.dateOfBirth == null ? null : String(row.dateOfBirth),
      emailStatusChangedAt:
        row.emailStatusChangedAt == null ? null : String(row.emailStatusChangedAt),
      pendingNewEmail: row.pendingNewEmail == null ? null : String(row.pendingNewEmail),
      emailChangeExpiresAt:
        row.emailChangeExpiresAt == null ? null : String(row.emailChangeExpiresAt),
      currentKycSessionId: row.currentKycSessionId == null ? null : String(row.currentKycSessionId),
      amlHoldStatus: row.amlHoldStatus == null ? null : String(row.amlHoldStatus),
      amlHoldReason: row.amlHoldReason == null ? null : String(row.amlHoldReason),
      amlHoldAt: row.amlHoldAt == null ? null : String(row.amlHoldAt),
    };
  }) as z.ZodType<AdminUserDetailPayload>;

export const adminKycSessionRowSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform(
    (row): AdminKycSessionRow => ({
      id: String(row.id ?? ""),
      provider: String(row.provider ?? ""),
      providerSessionId: String(row.providerSessionId ?? ""),
      providerAttemptId: row.providerAttemptId == null ? null : String(row.providerAttemptId),
      status: String(row.status ?? ""),
      verifiedFirstName: row.verifiedFirstName == null ? null : String(row.verifiedFirstName),
      verifiedLastName: row.verifiedLastName == null ? null : String(row.verifiedLastName),
      verifiedDateOfBirth: row.verifiedDateOfBirth == null ? null : String(row.verifiedDateOfBirth),
      verifiedIdNumberLast4:
        row.verifiedIdNumberLast4 == null ? null : String(row.verifiedIdNumberLast4),
      verifiedIdCountry: row.verifiedIdCountry == null ? null : String(row.verifiedIdCountry),
      verifiedIdType: row.verifiedIdType == null ? null : String(row.verifiedIdType),
      verifiedIdExpiry: row.verifiedIdExpiry == null ? null : String(row.verifiedIdExpiry),
      verifiedGender: row.verifiedGender == null ? null : String(row.verifiedGender),
      verifiedNationality: row.verifiedNationality == null ? null : String(row.verifiedNationality),
      verifiedCitizenship: row.verifiedCitizenship == null ? null : String(row.verifiedCitizenship),
      verifiedPlaceOfBirth:
        row.verifiedPlaceOfBirth == null ? null : String(row.verifiedPlaceOfBirth),
      verifiedYearOfBirth: row.verifiedYearOfBirth == null ? null : String(row.verifiedYearOfBirth),
      verifiedIdNumber: row.verifiedIdNumber == null ? null : String(row.verifiedIdNumber),
      verifiedDocState: row.verifiedDocState == null ? null : String(row.verifiedDocState),
      verifiedIdValidFrom: row.verifiedIdValidFrom == null ? null : String(row.verifiedIdValidFrom),
      decisionRiskScore: row.decisionRiskScore == null ? null : String(row.decisionRiskScore),
      decisionIpCountry: row.decisionIpCountry == null ? null : String(row.decisionIpCountry),
      decisionStatus: row.decisionStatus == null ? null : String(row.decisionStatus),
      decisionReasonCode:
        row.decisionReasonCode == null ? null : Number.parseInt(String(row.decisionReasonCode), 10),
      decisionReasonLabel: row.decisionReasonLabel == null ? null : String(row.decisionReasonLabel),
      createdAt: String(row.createdAt ?? ""),
      decisionAt: row.decisionAt == null ? null : String(row.decisionAt),
    }),
  );

export const adminKycSessionRowsSchema = z.array(adminKycSessionRowSchema) as z.ZodType<
  AdminKycSessionRow[]
>;

export const adminUserLookupRowSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform(
    (row): AdminUserLookupRow => ({
      id: String(row.id ?? ""),
      name: String(row.name ?? ""),
      email: String(row.email ?? ""),
    }),
  );

export const adminUserLookupRowsSchema = z.array(adminUserLookupRowSchema) as z.ZodType<
  AdminUserLookupRow[]
>;

const adminUserBidRowRawSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row) => ({
    id: String(row.id ?? ""),
    lotId: String(row.lotId ?? ""),
    lotTitle: String(row.lotTitle ?? ""),
    saleId: row.saleId == null ? null : String(row.saleId),
    saleTitle: row.saleTitle == null ? null : String(row.saleTitle),
    amount: String(row.amount ?? "0"),
    isWinning: Boolean(row.isWinning),
    isAutoBid: Boolean(row.isAutoBid),
    placedVia: row.placedVia == null ? null : String(row.placedVia),
    createdAt: zCoerceDate.parse(row.createdAt),
  }));

export const adminUserBidRowSchema = adminUserBidRowRawSchema.transform(
  (row): AdminUserBidRow => row,
);

export const adminUserBidsResultSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): { rows: AdminUserBidRow[]; total: number } => {
    const rawRows = Array.isArray(row.rows) ? row.rows : [];
    return {
      total: Number(row.total ?? rawRows.length),
      rows: rawRows.map((entry) => adminUserBidRowSchema.parse(entry)),
    };
  }) as z.ZodType<{ rows: AdminUserBidRow[]; total: number }>;

export const adminUserActivityEntrySchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform(
    (row): AdminUserActivityEntry => ({
      id: String(row.id ?? ""),
      createdAt: String(row.createdAt ?? ""),
      expiresAt: String(row.expiresAt ?? ""),
      ipAddress: row.ipAddress == null ? null : String(row.ipAddress),
    }),
  );

export const adminUserActivityEntriesSchema = z.array(adminUserActivityEntrySchema) as z.ZodType<
  AdminUserActivityEntry[]
>;

type _AdminUserRowInfer = z.infer<typeof adminUserRowSchema>;
const _adminUserRowGuard = null as unknown as _AdminUserRowInfer satisfies AdminUserRow;
void _adminUserRowGuard;
