import type { Database } from "@auction/db";
import {
  kycWatchlistScreening,
  marketingEnquiry,
  marketingEnquiryAttachment,
  marketingEnquiryNote,
  privateSaleDeal,
  privateSaleDealParty,
  privateSaleDealStageHistory,
  privateSaleEnquiryDetail,
  sourceOfFunds,
  uploadObject,
} from "@auction/db/schema";
import {
  DEFAULT_PRIVATE_SALE_RECORD_RETENTION_YEARS,
  ERASED_ENQUIRY,
  type EnquiryDealRecord,
  isEnquiryHeldFromErasure,
} from "@auction/domain";
import type { PrivateSaleDealStage } from "@auction/types";
import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import type {
  EnquiryErasureCounts,
  EnquiryErasureTarget,
} from "../interfaces/enquiry-erasure.repository.js";

const NONE: EnquiryErasureCounts = { enquiries: 0, notes: 0, attachments: 0, held: 0 };

/** Which enquiries the target covers. An empty list of accounts covers nothing. */
function targetCondition(target: EnquiryErasureTarget) {
  if (target.kind === "email") {
    return sql`lower(${marketingEnquiry.email}) = ${target.email.trim().toLowerCase()}`;
  }
  if (target.userIds.length === 0) return null;
  return inArray(marketingEnquiry.userId, [...target.userIds]);
}

/**
 * Replaces the sender's details on their enquiries and removes what they sent in. The enquiry row
 * itself stays, with its reference, intent, department, status, routing and dates, so staff
 * records and counts are unchanged. Files are detached and their upload records expire now, so
 * the existing clean-up of unclaimed enquiry files deletes the stored object and the record.
 */
export async function anonymiseEnquiries(
  tx: Database,
  target: EnquiryErasureTarget,
  options: { now?: Date; retentionYears?: number } = {},
): Promise<EnquiryErasureCounts> {
  const now = options.now ?? new Date();
  const retentionYears = options.retentionYears ?? DEFAULT_PRIVATE_SALE_RECORD_RETENTION_YEARS;
  const condition = targetCondition(target);
  if (!condition) return { ...NONE };

  const matched = await tx
    .select({ id: marketingEnquiry.id, status: marketingEnquiry.status })
    .from(marketingEnquiry)
    .where(condition);
  const deals = await dealRecordsOf(
    tx,
    matched.filter((row) => row.status === "converted").map((row) => row.id),
  );
  const isHeld = (row: { id: string; status: string }) =>
    isEnquiryHeldFromErasure(row.status, deals.get(row.id) ?? [], now, retentionYears);
  const held = matched.filter(isHeld).length;
  const ids = matched.filter((row) => !isHeld(row)).map((row) => row.id);
  if (ids.length === 0) return { ...NONE, held };

  const attachments = await detachFiles(tx, ids);

  const notes = await tx
    .update(marketingEnquiryNote)
    .set({ body: ERASED_ENQUIRY.note })
    .where(
      and(
        inArray(marketingEnquiryNote.enquiryId, ids),
        ne(marketingEnquiryNote.body, ERASED_ENQUIRY.note),
      ),
    )
    .returning({ id: marketingEnquiryNote.id });

  await tx
    .update(privateSaleEnquiryDetail)
    .set({ locationTown: null, locationCountry: null, lookingFor: null })
    .where(inArray(privateSaleEnquiryDetail.enquiryId, ids));

  const enquiries = await tx
    .update(marketingEnquiry)
    .set({
      name: ERASED_ENQUIRY.name,
      email: ERASED_ENQUIRY.email,
      phone: null,
      message: ERASED_ENQUIRY.message,
      version: sql`${marketingEnquiry.version} + 1`,
    })
    .where(
      and(
        inArray(marketingEnquiry.id, ids),
        or(
          ne(marketingEnquiry.name, ERASED_ENQUIRY.name),
          ne(marketingEnquiry.email, ERASED_ENQUIRY.email),
          ne(marketingEnquiry.message, ERASED_ENQUIRY.message),
          sql`${marketingEnquiry.phone} IS NOT NULL`,
        ),
      ),
    )
    .returning({ id: marketingEnquiry.id });

  return {
    enquiries: enquiries.length,
    notes: notes.length,
    attachments,
    held,
  };
}

/**
 * What the erasure rule needs about every deal made from each of the enquiries: its stage, whether
 * it reached agreement, when it ended and whether a check was opened for a party while it ran.
 */
async function dealRecordsOf(
  tx: Database,
  enquiryIds: readonly string[],
): Promise<Map<string, EnquiryDealRecord[]>> {
  const records = new Map<string, EnquiryDealRecord[]>();
  if (enquiryIds.length === 0) return records;
  const deals = await tx
    .select({
      id: privateSaleDeal.id,
      enquiryId: privateSaleDeal.sourceEnquiryId,
      stage: privateSaleDeal.stage,
      agreedAt: privateSaleDeal.agreedAt,
      cancelledAt: privateSaleDeal.cancelledAt,
      createdAt: privateSaleDeal.createdAt,
    })
    .from(privateSaleDeal)
    .where(inArray(privateSaleDeal.sourceEnquiryId, [...enquiryIds]));
  if (deals.length === 0) return records;

  const dealIds = deals.map((deal) => deal.id);
  const [parties, settled] = await Promise.all([
    tx
      .select({ dealId: privateSaleDealParty.dealId, userId: privateSaleDealParty.actingUserId })
      .from(privateSaleDealParty)
      .where(inArray(privateSaleDealParty.dealId, dealIds)),
    tx
      .select({
        dealId: privateSaleDealStageHistory.dealId,
        at: privateSaleDealStageHistory.createdAt,
      })
      .from(privateSaleDealStageHistory)
      .where(
        and(
          inArray(privateSaleDealStageHistory.dealId, dealIds),
          eq(privateSaleDealStageHistory.toStage, "settled"),
        ),
      ),
  ]);
  const userIds = [...new Set(parties.flatMap((p) => (p.userId ? [p.userId] : [])))];
  const checks = new Map<string, Date[]>();
  if (userIds.length > 0) {
    const [screenings, funds] = await Promise.all([
      tx
        .select({ userId: kycWatchlistScreening.userId, at: kycWatchlistScreening.createdAt })
        .from(kycWatchlistScreening)
        .where(inArray(kycWatchlistScreening.userId, userIds)),
      tx
        .select({ userId: sourceOfFunds.userId, at: sourceOfFunds.createdAt })
        .from(sourceOfFunds)
        .where(inArray(sourceOfFunds.userId, userIds)),
    ]);
    for (const row of [...screenings, ...funds]) {
      checks.set(row.userId, [...(checks.get(row.userId) ?? []), row.at]);
    }
  }

  for (const deal of deals) {
    if (!deal.enquiryId) continue;
    const dealUsers = parties.filter((p) => p.dealId === deal.id).map((p) => p.userId);
    const settledAt = settled
      .filter((h) => h.dealId === deal.id)
      .map((h) => h.at)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const list = records.get(deal.enquiryId) ?? [];
    list.push({
      stage: deal.stage as PrivateSaleDealStage,
      agreedAt: deal.agreedAt,
      endedAt: deal.stage === "cancelled" ? deal.cancelledAt : (settledAt ?? null),
      // A check opened for either side while the deal ran, not one from before it began.
      hasComplianceCase: dealUsers.some((userId) =>
        (userId ? (checks.get(userId) ?? []) : []).some((at) => at >= deal.createdAt),
      ),
    });
    records.set(deal.enquiryId, list);
  }
  return records;
}

/** Detaches the files from the enquiries and lets the unclaimed-file clean-up remove them. */
async function detachFiles(tx: Database, enquiryIds: readonly string[]): Promise<number> {
  const removed = await tx
    .delete(marketingEnquiryAttachment)
    .where(inArray(marketingEnquiryAttachment.enquiryId, [...enquiryIds]))
    .returning({ uploadObjectId: marketingEnquiryAttachment.uploadObjectId });
  if (removed.length === 0) return 0;
  await tx
    .update(uploadObject)
    .set({ expiresAt: sql`least(${uploadObject.expiresAt}, now())` })
    .where(
      inArray(
        uploadObject.id,
        removed.map((row) => row.uploadObjectId),
      ),
    );
  return removed.length;
}
