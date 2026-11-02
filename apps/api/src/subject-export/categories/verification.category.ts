import {
  bidUserProfile,
  kycVerification,
  sourceOfFundsDocument,
  uploadObject,
} from "@auction/db/schema";
import type { SubjectExportFileRef } from "@auction/identity-contracts";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import {
  type ExportSource,
  SourcedExportCategory,
  inMemorySource,
} from "../sourced-export-category.js";
import type { SubjectExportDeps } from "../subject-export-deps.js";
import { iso, isoRequired } from "../subject-export-values.js";
import { afterKey, countWhere } from "./keyset.js";

const KYC_OUTCOME: Record<string, string> = {
  approved: "verified",
  rejected: "not_verified",
  pending: "pending",
  unverified: "pending",
};

/**
 * The plain outcome of identity verification and the date and expiry, nothing about how it was
 * decided. The provider's risk score, IP country, decision payload and extracted document data are
 * not selected, and nothing from source-of-funds review (status, triage and review notes) is read.
 */
export function mapIdentityVerification(input: {
  id: string;
  kycStatus: string;
  verifiedAt: Date | null;
  expiresAt: string | null;
  startedAt: Date;
}) {
  return {
    id: input.id,
    origin: "made_by_us" as const,
    documentType: "identity",
    // The identity document images are held by the verification provider, not by Bid.
    file: null,
    uploadedAt: isoRequired(input.startedAt),
    outcome: KYC_OUTCOME[input.kycStatus] ?? "pending",
    verifiedAt: iso(input.verifiedAt),
    expiresAt: input.expiresAt ? new Date(`${input.expiresAt}T00:00:00Z`).toISOString() : null,
  };
}

export function mapSourceOfFundsDocument(row: {
  id: string;
  requestedType: string;
  uploadedAt: Date;
  file: SubjectExportFileRef | null;
}) {
  return {
    id: row.id,
    origin: "provided" as const,
    documentType: row.requestedType,
    file: row.file,
    uploadedAt: isoRequired(row.uploadedAt),
    // How a source-of-funds document was assessed is a compliance matter and is not part of the copy.
    outcome: null,
    verifiedAt: null,
    expiresAt: null,
  };
}

export class VerificationCategory extends SourcedExportCategory {
  readonly id = "verification";
  protected readonly sources: readonly ExportSource[];

  constructor({ db, files }: SubjectExportDeps) {
    super();
    this.sources = [
      inMemorySource(async (s) => {
        const [profile] = await db
          .select({
            kycStatus: bidUserProfile.kycStatus,
            kycVerifiedAt: bidUserProfile.kycVerifiedAt,
          })
          .from(bidUserProfile)
          .where(eq(bidUserProfile.userId, s))
          .limit(1);
        if (!profile) return [];
        const [latest] = await db
          .select({
            expiry: kycVerification.verifiedIdExpiry,
            createdAt: kycVerification.createdAt,
          })
          .from(kycVerification)
          .where(eq(kycVerification.userId, s))
          .orderBy(desc(kycVerification.createdAt))
          .limit(1);
        if (!latest && profile.kycStatus === "unverified") return [];
        return [
          {
            key: s,
            record: mapIdentityVerification({
              id: s,
              kycStatus: profile.kycStatus,
              verifiedAt: profile.kycVerifiedAt,
              expiresAt: latest?.expiry ?? null,
              startedAt: latest?.createdAt ?? profile.kycVerifiedAt ?? new Date(0),
            }),
          },
        ];
      }),
      {
        count: (s) =>
          countWhere(
            db,
            sourceOfFundsDocument,
            and(
              eq(sourceOfFundsDocument.uploadedByUserId, s),
              isNull(sourceOfFundsDocument.anonymizedAt),
            ),
          ),
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: sourceOfFundsDocument.id,
              requestedType: sourceOfFundsDocument.requestedType,
              label: sourceOfFundsDocument.label,
              uploadedAt: sourceOfFundsDocument.uploadedAt,
              key: uploadObject.key,
              contentType: uploadObject.actualContentType,
              byteSize: uploadObject.actualByteSize,
            })
            .from(sourceOfFundsDocument)
            .innerJoin(uploadObject, eq(uploadObject.id, sourceOfFundsDocument.uploadObjectId))
            .where(
              and(
                eq(sourceOfFundsDocument.uploadedByUserId, s),
                isNull(sourceOfFundsDocument.anonymizedAt),
                afterKey(sourceOfFundsDocument.id, after),
              ),
            )
            .orderBy(asc(sourceOfFundsDocument.id))
            .limit(limit);
          return Promise.all(
            rows.map(async (row) => ({
              key: row.id,
              record: mapSourceOfFundsDocument({
                id: row.id,
                requestedType: row.requestedType,
                uploadedAt: row.uploadedAt,
                file: await files.sign({
                  keyOrUrl: row.key,
                  fileName: row.label ?? `${row.requestedType}-${row.id}`,
                  contentType: row.contentType,
                  byteSize: row.byteSize,
                }),
              }),
            })),
          );
        },
      },
    ];
  }
}
