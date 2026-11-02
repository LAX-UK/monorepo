import {
  consignmentAgreement,
  itemSubmission,
  legalEntity,
  lot,
  payout,
  unsoldLotChoice,
} from "@auction/db/schema";
import type { SubjectExportFileRef } from "@auction/identity-contracts";
import { and, asc, count, eq, inArray, isNotNull } from "drizzle-orm";
import { type ExportSource, SourcedExportCategory } from "../sourced-export-category.js";
import type { SubjectExportDeps } from "../subject-export-deps.js";
import { iso, isoRequired, money } from "../subject-export-values.js";
import { afterKey, countWhere } from "./keyset.js";

export type ConsignmentInput = {
  id: string;
  title: string;
  description: string | null;
  createdAt: Date;
  photos: SubjectExportFileRef[];
  agreements: {
    termsVersion: string;
    acceptedAt: Date;
    estimateLow: string | null;
    estimateHigh: string | null;
    reservePrice: string | null;
    currency: string;
  }[];
  lot: { status: string; winnerId: string | null; hammer: string; endTime: Date } | null;
  unsoldChoices: {
    status: string;
    choice: string | null;
    reserve: string | null;
    currency: string;
    decidedAt: Date | null;
  }[];
};

/**
 * What LAX agreed with the person and the result, never LAX's side of the negotiation: the review
 * notes, rejection reason, reviewer and assignee, the relist reserve floor, the commission
 * rate and the staff note on an unsold choice are not selected. The buyer of a sold work is not
 * identified.
 */
export function mapConsignment(input: ConsignmentInput) {
  const latest = input.agreements.at(-1) ?? null;
  const sold = input.lot !== null && input.lot.status === "ended" && input.lot.winnerId !== null;
  return {
    id: input.id,
    origin: "provided" as const,
    kind: "submission",
    title: input.title,
    description: input.description,
    photos: input.photos,
    submittedAt: isoRequired(input.createdAt),
    agreements: input.agreements.map((agreement) => ({
      termsVersion: agreement.termsVersion,
      signedAt: isoRequired(agreement.acceptedAt),
    })),
    estimate: latest
      ? {
          low: money(latest.estimateLow, latest.currency),
          high: money(latest.estimateHigh, latest.currency),
        }
      : null,
    reserve: latest ? money(latest.reservePrice, latest.currency) : null,
    result: input.lot
      ? {
          status: sold ? "sold" : input.lot.status === "ended" ? "unsold" : input.lot.status,
          hammer: sold ? money(input.lot.hammer) : null,
          at: sold ? isoRequired(input.lot.endTime) : null,
        }
      : null,
    unsoldChoice: input.unsoldChoices.map((choice) => ({
      status: choice.status,
      choice: choice.choice,
      reserve: money(choice.reserve, choice.currency),
      decidedAt: iso(choice.decidedAt),
    })),
    payouts: null,
  };
}

export function mapPayout(row: {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  grossAmount: string;
  platformFee: string;
  stripeFee: string;
  netAmount: string;
  currency: string;
  status: string;
  processedAt: Date | null;
  statement: SubjectExportFileRef | null;
}) {
  return {
    id: row.id,
    origin: "observed" as const,
    kind: "payout",
    payouts: [
      {
        periodStart: isoRequired(row.periodStart),
        periodEnd: isoRequired(row.periodEnd),
        gross: money(row.grossAmount, row.currency),
        commission: money(row.platformFee, row.currency),
        processingFee: money(row.stripeFee, row.currency),
        net: money(row.netAmount, row.currency),
        status: row.status,
        processedAt: iso(row.processedAt),
        statement: row.statement,
      },
    ],
  };
}

/** The person's own selling account: the individual legal entity they created. */
const personalEntity = (subjectId: string) =>
  and(eq(legalEntity.createdByUserId, subjectId), eq(legalEntity.kind, "individual"));

export class ConsignmentsCategory extends SourcedExportCategory {
  readonly id = "consignments";
  protected readonly sources: readonly ExportSource[];

  constructor({ db, files }: SubjectExportDeps) {
    super();
    this.sources = [
      {
        count: (s) => countWhere(db, itemSubmission, eq(itemSubmission.submittedByUserId, s)),
        page: async (s, after, limit) => {
          const submissions = await db
            .select({
              id: itemSubmission.id,
              title: itemSubmission.title,
              description: itemSubmission.description,
              images: itemSubmission.images,
              createdAt: itemSubmission.createdAt,
              convertedLotId: itemSubmission.convertedLotId,
            })
            .from(itemSubmission)
            .where(and(eq(itemSubmission.submittedByUserId, s), afterKey(itemSubmission.id, after)))
            .orderBy(asc(itemSubmission.id))
            .limit(limit);
          if (submissions.length === 0) return [];
          const ids = submissions.map((row) => row.id);
          const lotIds = submissions.flatMap((row) =>
            row.convertedLotId ? [row.convertedLotId] : [],
          );

          const agreements = await db
            .select({
              submissionId: consignmentAgreement.submissionId,
              termsVersion: consignmentAgreement.termsVersion,
              acceptedAt: consignmentAgreement.acceptedAt,
              estimateLow: consignmentAgreement.estimateLow,
              estimateHigh: consignmentAgreement.estimateHigh,
              reservePrice: consignmentAgreement.reservePrice,
              currency: consignmentAgreement.currency,
            })
            .from(consignmentAgreement)
            .where(
              and(
                inArray(consignmentAgreement.submissionId, ids),
                isNotNull(consignmentAgreement.acceptedAt),
              ),
            )
            .orderBy(asc(consignmentAgreement.acceptedAt));
          const lots =
            lotIds.length === 0
              ? []
              : await db
                  .select({
                    id: lot.id,
                    status: lot.status,
                    winnerId: lot.winnerId,
                    hammer: lot.currentPrice,
                    endTime: lot.endTime,
                  })
                  .from(lot)
                  .where(inArray(lot.id, lotIds));
          const choices = await db
            .select({
              submissionId: unsoldLotChoice.submissionId,
              status: unsoldLotChoice.status,
              requested: unsoldLotChoice.requestedChoice,
              decided: unsoldLotChoice.decidedChoice,
              requestedReserve: unsoldLotChoice.requestedReserve,
              decidedReserve: unsoldLotChoice.decidedReserve,
              currency: unsoldLotChoice.currency,
              decidedAt: unsoldLotChoice.decidedAt,
            })
            .from(unsoldLotChoice)
            .where(inArray(unsoldLotChoice.submissionId, ids));

          return Promise.all(
            submissions.map(async (row) => ({
              key: row.id,
              record: mapConsignment({
                id: row.id,
                title: row.title,
                description: row.description,
                createdAt: row.createdAt,
                photos: await files.signAll(
                  row.images.map((image, index) => ({
                    keyOrUrl: image,
                    fileName: `${row.id}-${index + 1}${image.match(/\.[a-z0-9]+$/i)?.[0] ?? ""}`,
                  })),
                ),
                agreements: agreements.flatMap((a) =>
                  a.submissionId === row.id && a.acceptedAt
                    ? [{ ...a, acceptedAt: a.acceptedAt }]
                    : [],
                ),
                lot: lots.find((l) => l.id === row.convertedLotId) ?? null,
                unsoldChoices: choices
                  .filter((c) => c.submissionId === row.id)
                  .map((c) => ({
                    status: c.status,
                    choice: c.decided ?? c.requested,
                    reserve: c.decidedReserve ?? c.requestedReserve,
                    currency: c.currency,
                    decidedAt: c.decidedAt,
                  })),
              }),
            })),
          );
        },
      },
      {
        count: async (s) => {
          const [row] = await db
            .select({ n: count() })
            .from(payout)
            .innerJoin(legalEntity, eq(legalEntity.id, payout.legalEntityId))
            .where(personalEntity(s));
          return Number(row?.n ?? 0);
        },
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: payout.id,
              periodStart: payout.periodStart,
              periodEnd: payout.periodEnd,
              grossAmount: payout.grossAmount,
              platformFee: payout.platformFee,
              stripeFee: payout.stripeFee,
              netAmount: payout.netAmount,
              currency: payout.currency,
              status: payout.status,
              processedAt: payout.processedAt,
              statementUrl: payout.statementUrl,
            })
            .from(payout)
            .innerJoin(legalEntity, eq(legalEntity.id, payout.legalEntityId))
            .where(and(personalEntity(s), afterKey(payout.id, after)))
            .orderBy(asc(payout.id))
            .limit(limit);
          return Promise.all(
            rows.map(async (row) => ({
              key: row.id,
              record: mapPayout({
                ...row,
                statement: row.statementUrl
                  ? await files.sign({
                      keyOrUrl: row.statementUrl,
                      fileName: `statement-${row.id}.pdf`,
                      contentType: "application/pdf",
                    })
                  : null,
              }),
            })),
          );
        },
      },
    ];
  }
}
