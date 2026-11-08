import type { Database } from "@auction/db";
import {
  bidUserProfile,
  domainEvent,
  kycVerification,
  kycWatchlistScreening,
  marketingEnquiry,
  marketingEnquiryAttachment,
  marketingEnquiryNote,
  privateSaleDeal,
  privateSaleDealParty,
  privateSaleDealPartyHistory,
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
    .select({
      id: marketingEnquiry.id,
      status: marketingEnquiry.status,
      createdAt: marketingEnquiry.createdAt,
    })
    .from(marketingEnquiry)
    .where(condition);
  const deals = await dealRecordsOf(
    tx,
    matched.filter((row) => row.status === "converted"),
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
 * it reached agreement, when it ended and whether a check was opened for anyone named on it since
 * the enquiry arrived (staff vet the person before converting, so the deal's own start is too late).
 */
async function dealRecordsOf(
  tx: Database,
  enquiries: ReadonlyArray<{ id: string; createdAt: Date }>,
): Promise<Map<string, EnquiryDealRecord[]>> {
  const records = new Map<string, EnquiryDealRecord[]>();
  if (enquiries.length === 0) return records;
  const enquiryStart = new Map(enquiries.map((row) => [row.id, row.createdAt]));
  const deals = await tx
    .select({
      id: privateSaleDeal.id,
      enquiryId: privateSaleDeal.sourceEnquiryId,
      stage: privateSaleDeal.stage,
      agreedAt: privateSaleDeal.agreedAt,
      cancelledAt: privateSaleDeal.cancelledAt,
    })
    .from(privateSaleDeal)
    .where(
      inArray(
        privateSaleDeal.sourceEnquiryId,
        enquiries.map((row) => row.id),
      ),
    );
  if (deals.length === 0) return records;

  const dealIds = deals.map((deal) => deal.id);
  const [parties, named, settled] = await Promise.all([
    tx
      .select({ dealId: privateSaleDealParty.dealId, userId: privateSaleDealParty.actingUserId })
      .from(privateSaleDealParty)
      .where(inArray(privateSaleDealParty.dealId, dealIds)),
    // Everyone ever named, including a buyer later replaced.
    tx
      .select({
        dealId: privateSaleDealPartyHistory.dealId,
        userId: privateSaleDealPartyHistory.actingUserId,
      })
      .from(privateSaleDealPartyHistory)
      .where(inArray(privateSaleDealPartyHistory.dealId, dealIds)),
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
  const usersOf = new Map<string, Set<string>>();
  for (const row of [...parties, ...named]) {
    if (!row.userId) continue;
    usersOf.set(row.dealId, (usersOf.get(row.dealId) ?? new Set()).add(row.userId));
  }
  const checks = await checkTimesByUser(tx, [
    ...new Set([...usersOf.values()].flatMap((users) => [...users])),
  ]);

  for (const deal of deals) {
    const since = deal.enquiryId ? enquiryStart.get(deal.enquiryId) : undefined;
    if (!deal.enquiryId || !since) continue;
    const settledAt = settled
      .filter((h) => h.dealId === deal.id)
      .map((h) => h.at)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const list = records.get(deal.enquiryId) ?? [];
    list.push({
      stage: deal.stage as PrivateSaleDealStage,
      agreedAt: deal.agreedAt,
      endedAt: deal.stage === "cancelled" ? deal.cancelledAt : (settledAt ?? null),
      hasComplianceCase: [...(usersOf.get(deal.id) ?? [])].some((userId) =>
        (checks.get(userId) ?? []).some((at) => at >= since),
      ),
    });
    records.set(deal.enquiryId, list);
  }
  return records;
}

/** Veriff's decision code for a declined identity verification. Expired and abandoned sessions have their own codes. */
const VERIFF_DECLINED_CODE = "9102";

/** The event written each time an anti-money-laundering screening is decided, whether it cleared or blocked. */
const AML_SCREENING_EVALUATED_EVENT = "aml.screening_evaluated";

/**
 * When a compliance check was opened for each person: a watchlist screening, a source-of-funds
 * case, an anti-money-laundering hold (still in place, or since cleared and so read from the
 * screening decisions), or an identity verification that was declined. An expired or abandoned
 * session is not a check.
 */
async function checkTimesByUser(
  tx: Database,
  userIds: readonly string[],
): Promise<Map<string, Date[]>> {
  const times = new Map<string, Date[]>();
  if (userIds.length === 0) return times;
  const ids = [...userIds];
  const [screenings, funds, holds, rejected, declined, decisions] = await Promise.all([
    tx
      .select({ userId: kycWatchlistScreening.userId, at: kycWatchlistScreening.createdAt })
      .from(kycWatchlistScreening)
      .where(inArray(kycWatchlistScreening.userId, ids)),
    tx
      .select({ userId: sourceOfFunds.userId, at: sourceOfFunds.createdAt })
      .from(sourceOfFunds)
      .where(inArray(sourceOfFunds.userId, ids)),
    // A hold with no recorded time counts from now, so it is never missed.
    tx
      .select({
        userId: bidUserProfile.userId,
        at: sql<Date>`coalesce(${bidUserProfile.amlHoldAt}, now())`,
      })
      .from(bidUserProfile)
      .where(and(inArray(bidUserProfile.userId, ids), ne(bidUserProfile.amlHoldStatus, "none"))),
    tx
      .select({
        userId: bidUserProfile.userId,
        // When the identity check was decided, not when the profile was last touched.
        at: sql<Date>`coalesce((
          select max(${kycVerification.decisionAt}) from ${kycVerification}
          where ${kycVerification.userId} = ${bidUserProfile.userId}
        ), ${bidUserProfile.updatedAt})`,
      })
      .from(bidUserProfile)
      .where(and(inArray(bidUserProfile.userId, ids), eq(bidUserProfile.kycStatus, "rejected"))),
    tx
      .select({
        userId: kycVerification.userId,
        at: sql<Date>`coalesce(${kycVerification.decisionAt}, ${kycVerification.createdAt})`,
      })
      .from(kycVerification)
      .where(
        and(
          inArray(kycVerification.userId, ids),
          sql`${kycVerification.decisionPayload}->'verification'->>'code' = ${VERIFF_DECLINED_CODE}`,
        ),
      ),
    // Every decision on a screening, so a hold cleared since still counts.
    tx
      .select({
        userId: sql<string>`${domainEvent.payload}->>'userId'`,
        at: domainEvent.occurredAt,
      })
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.aggregateType, "aml_screening"),
          eq(domainEvent.eventType, AML_SCREENING_EVALUATED_EVENT),
          inArray(sql<string>`${domainEvent.payload}->>'userId'`, ids),
        ),
      ),
  ]);
  for (const row of [...screenings, ...funds, ...holds, ...rejected, ...declined, ...decisions]) {
    times.set(row.userId, [...(times.get(row.userId) ?? []), new Date(row.at)]);
  }
  return times;
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
