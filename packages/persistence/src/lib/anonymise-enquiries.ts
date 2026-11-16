import type { Database } from "@auction/db";
import {
  bidUserProfile,
  domainEvent,
  enquiryInboundQuarantine,
  kycVerification,
  kycWatchlistScreening,
  marketingEnquiry,
  marketingEnquiryAttachment,
  marketingEnquiryMessage,
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
  closedDealEndedAt,
  enquiryHoldEnd,
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

  // The enquiries are read under a row lock, before any held mail is touched: staff attaching
  // held mail lock the enquiry first too (then the held row), so the two cannot deadlock, an
  // attach that is under way finishes before this reads the thread, and one that starts after
  // waits and then sees the enquiry erased.
  const matched = await tx
    .select({
      id: marketingEnquiry.id,
      status: marketingEnquiry.status,
      createdAt: marketingEnquiry.createdAt,
    })
    .from(marketingEnquiry)
    .where(condition)
    .for("update");

  // Held mail from the erased address goes before any early return: a person with no erasable
  // enquiry (none matched, or every one is held from erasure) may still have mail waiting in
  // quarantine, and it should not wait out its 30 days. The events staff wrote when reviewing
  // that mail lose the reason they typed (it can name the sender) in the same transaction.
  if (target.kind === "email") {
    const fromAddress = await tx
      .delete(enquiryInboundQuarantine)
      .where(
        sql`lower(${enquiryInboundQuarantine.fromAddress}) = ${target.email.trim().toLowerCase()}`,
      )
      .returning({ id: enquiryInboundQuarantine.id });
    await scrubReviewReasonEvents(tx, {
      enquiryIds: [],
      quarantineIds: fromAddress.map((row) => row.id),
    });
  }

  const deals = await dealRecordsOf(
    tx,
    matched.filter((row) => row.status === "converted"),
  );
  const isHeld = (row: { id: string; status: string }) =>
    isEnquiryHeldFromErasure(row.status, deals.get(row.id) ?? [], now, retentionYears);
  const heldRows = matched.filter(isHeld);
  const held = heldRows.length;
  const hold =
    held > 0
      ? {
          hold: enquiryHoldEnd(
            heldRows.map((row) => deals.get(row.id) ?? []),
            now,
            retentionYears,
          ),
        }
      : {};
  const ids = matched.filter((row) => !isHeld(row)).map((row) => row.id);
  if (ids.length === 0) return { ...NONE, held, ...hold };

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

  // What the sender emailed back is theirs too: the text goes, the metadata of their files goes.
  await tx
    .update(marketingEnquiryMessage)
    // The reason staff gave for attaching held mail can name the sender too: it goes as well.
    .set({
      subject: ERASED_ENQUIRY.note,
      body: ERASED_ENQUIRY.note,
      attachments: [],
      reviewReason: sql`CASE WHEN ${marketingEnquiryMessage.reviewReason} IS NULL THEN NULL ELSE ${ERASED_ENQUIRY.note} END`,
    })
    .where(
      and(
        inArray(marketingEnquiryMessage.enquiryId, ids),
        eq(marketingEnquiryMessage.direction, "inbound"),
      ),
    );
  // Quarantined mail that was suspected to belong to an erased enquiry goes with it.
  const suspected = await tx
    .delete(enquiryInboundQuarantine)
    .where(inArray(enquiryInboundQuarantine.suspectedEnquiryId, ids))
    .returning({ id: enquiryInboundQuarantine.id });
  await scrubReviewReasonEvents(tx, {
    enquiryIds: ids,
    quarantineIds: suspected.map((row) => row.id),
  });

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
    ...hold,
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
      updatedAt: privateSaleDeal.updatedAt,
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
  const [parties, named, closings] = await Promise.all([
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
        toStage: privateSaleDealStageHistory.toStage,
        at: privateSaleDealStageHistory.createdAt,
      })
      .from(privateSaleDealStageHistory)
      .where(
        and(
          inArray(privateSaleDealStageHistory.dealId, dealIds),
          inArray(privateSaleDealStageHistory.toStage, ["settled", "cancelled"]),
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
    const closedInHistoryAt = closings
      .filter((h) => h.dealId === deal.id && h.toStage === deal.stage)
      .map((h) => h.at)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const list = records.get(deal.enquiryId) ?? [];
    list.push({
      stage: deal.stage as PrivateSaleDealStage,
      agreedAt: deal.agreedAt,
      endedAt: closedDealEndedAt({
        stage: deal.stage as PrivateSaleDealStage,
        closedInHistoryAt: closedInHistoryAt ?? null,
        cancelledAt: deal.cancelledAt,
        updatedAt: deal.updatedAt,
      }),
      hasComplianceCase: [...(usersOf.get(deal.id) ?? [])].some((userId) =>
        (checks.get(userId) ?? []).some((at) => isCheckInWindow(at, since)),
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

/** When a check was opened; null when no time was recorded, which counts as inside any window. */
export type CheckTime = Date | null;

/** Whether a check falls in a deal's window. A check with no time fails towards counting. */
export function isCheckInWindow(at: CheckTime, since: Date, endedAt?: Date | null): boolean {
  if (at === null) return true;
  return at >= since && (endedAt == null || at <= endedAt);
}

/**
 * When a compliance check was opened for each person: a watchlist screening, a source-of-funds
 * case, an anti-money-laundering hold (still in place, or since cleared and so read from the
 * screening decisions), or an identity verification that was declined. An expired or abandoned
 * session is not a check. The one definition of a check: the enquiry erasure and the party deal
 * retention reader both read it, so they cannot disagree about when a deal had a compliance case.
 */
export async function checkTimesByUser(
  tx: Database,
  userIds: readonly string[],
): Promise<Map<string, CheckTime[]>> {
  const times = new Map<string, CheckTime[]>();
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
    // A hold with no recorded time comes back as null, which counts as inside any window.
    tx
      .select({
        userId: bidUserProfile.userId,
        at: sql<Date | null>`${bidUserProfile.amlHoldAt}`,
      })
      .from(bidUserProfile)
      .where(and(inArray(bidUserProfile.userId, ids), ne(bidUserProfile.amlHoldStatus, "none"))),
    tx
      .select({
        userId: bidUserProfile.userId,
        // The earliest time the identity check is known by, never the profile's last edit. With no
        // verification row there is no time, so it comes back null and counts as inside any window.
        at: sql<Date | null>`(
          select min(coalesce(${kycVerification.decisionAt}, ${kycVerification.createdAt}))
          from ${kycVerification}
          where ${kycVerification.userId} = ${bidUserProfile.userId}
        )`,
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
    times.set(row.userId, [
      ...(times.get(row.userId) ?? []),
      row.at === null ? null : new Date(row.at),
    ]);
  }
  return times;
}

/** Staff attached held mail to an enquiry; the payload names the enquiry and the held row. */
const INBOUND_ATTACHED_EVENT = "marketing_enquiry.inbound_attached";
/** Staff discarded held mail; the event's aggregate is the held row. */
const INBOUND_DISCARDED_EVENT = "marketing_enquiry.inbound_discarded";

/**
 * Replaces the reason staff typed when attaching or discarding held mail, in the events that
 * recorded it: attaches to the erased enquiries or of the erased held mail, and discards of the
 * erased held mail. Only the `reviewReason` value changes; the event, its ids and codes stay, so
 * the audit trail still shows who reviewed what and when. Rows already scrubbed are left alone.
 *
 * This is the one place the event log is rewritten: the payload holds free text a person typed
 * about the sender, and erasure removes the same text from the message row.
 */
export async function scrubReviewReasonEvents(
  tx: Database,
  erased: { enquiryIds: readonly string[]; quarantineIds: readonly string[] },
): Promise<number> {
  const enquiryIds = [...erased.enquiryIds];
  const quarantineIds = [...erased.quarantineIds];
  if (enquiryIds.length === 0 && quarantineIds.length === 0) return 0;
  const attached = and(
    eq(domainEvent.eventType, INBOUND_ATTACHED_EVENT),
    or(
      enquiryIds.length
        ? and(
            eq(domainEvent.aggregateType, "marketing_enquiry"),
            inArray(domainEvent.aggregateId, enquiryIds),
          )
        : undefined,
      quarantineIds.length
        ? inArray(sql<string>`${domainEvent.payload}->>'quarantineId'`, quarantineIds)
        : undefined,
    ),
  );
  const discarded = quarantineIds.length
    ? and(
        eq(domainEvent.eventType, INBOUND_DISCARDED_EVENT),
        eq(domainEvent.aggregateType, "enquiry_inbound_quarantine"),
        inArray(domainEvent.aggregateId, quarantineIds),
      )
    : undefined;
  const scrubbed = await tx
    .update(domainEvent)
    .set({
      payload: sql`jsonb_set(${domainEvent.payload}, '{reviewReason}', to_jsonb(${ERASED_ENQUIRY.note}::text))`,
    })
    .where(
      and(
        or(attached, discarded),
        sql`jsonb_typeof(${domainEvent.payload}->'reviewReason') = 'string'`,
        sql`${domainEvent.payload}->>'reviewReason' <> ${ERASED_ENQUIRY.note}`,
      ),
    )
    .returning({ id: domainEvent.id });
  return scrubbed.length;
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
