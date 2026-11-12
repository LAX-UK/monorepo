import { LONDON_TIME_ZONE, formatDayMonthOnly } from "@auction/datetime";
import type { Database } from "@auction/db";
import { lotNotDeleted } from "@auction/db";
import { legalEntity, lot, lotReoffer, sellerConsent } from "@auction/db/schema";
import type { ReofferStatus } from "@auction/domain";
import { and, desc, eq, gt, inArray, isNull, lt, ne, notExists, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { AdminWorkItemSourceRow } from "../interfaces/admin-work-items.reader.js";
import { adminWorkItemHref } from "../lib/admin-work-item-href.js";
import { toReofferRecord } from "./lot-reoffer.mappers.js";
import { lotWorkItemTitle } from "./work-item-labels.js";

const DAY_MS = 86_400_000;
/** An accepted offer's item is for information and clears itself after this long. */
const ACCEPTED_ITEM_DAYS = 7;
/** The seller's request is on its last day when it is due within this long. */
const LAST_DAY_MS = DAY_MS;

type ReofferWorkKind =
  | "reoffer_no_reply"
  | "reoffer_ready"
  | "reoffer_decision"
  | "reoffer_accepted";

/** What each kind of re-offer work says. One entry per kind, so the wording lives in one place. */
const WORK_WORDING: Record<ReofferWorkKind, { title: string; subtitle: (row: Row) => string }> = {
  reoffer_no_reply: {
    title: "Re-offer: no reply from the seller",
    subtitle: (row) =>
      row.dueAt
        ? `Answer due ${formatDayMonthOnly(row.dueAt, LONDON_TIME_ZONE)}. Record their answer or return the lot`
        : "Record their answer or return the lot",
  },
  reoffer_ready: {
    title: "Re-offer: ready to send",
    subtitle: (row) => `Seller agreed. Send to ${row.accountName ?? "the next bidder"}`,
  },
  reoffer_decision: {
    title: "Re-offer: declined or ended",
    subtitle: () => "Decide the next step: offer to the next bidder or return the lot",
  },
  reoffer_accepted: {
    title: "Re-offer accepted",
    subtitle: (row) => `${row.accountName ?? "The bidder"} accepted. Invoice raised`,
  },
};

type Row = {
  offerId: string;
  lotId: string;
  lotTitle: string;
  lotNumber: number | null;
  saleId: string | null;
  status: ReofferStatus;
  createdAt: Date;
  updatedAt: Date;
  respondedAt: Date | null;
  dueAt: Date | null;
  accountName: string | null;
};

/** Offers that ended without a sale and wait for staff to decide, but not a seller who never replied. */
const DECISION_STATUSES: ReofferStatus[] = ["declined", "expired", "seller_declined"];

/**
 * The work a re-offer leaves staff: a seller who has not replied, an offer ready to send, an offer
 * that ended and needs a decision, and an accepted offer for information. Every item but the
 * accepted one shows only while the lot still waits for a buyer (ended, no winner), so it clears
 * as soon as the lot leaves the re-offer flow: returned to inventory, relisted, re-awarded or
 * deleted. A decision item shows only for the lot's latest offer. An accepted offer shows for a
 * week, and only while its award stands.
 */
export class DrizzleReofferWorkItemsReader {
  constructor(private readonly db: Database) {}

  async list(limit: number, now: Date): Promise<AdminWorkItemSourceRow[]> {
    const later = alias(lotReoffer, "later");
    const rows = await this.db
      .select({
        offerId: lotReoffer.id,
        lotId: lot.id,
        lotTitle: lot.title,
        lotNumber: lot.lotNumber,
        saleId: lot.saleId,
        winnerId: lot.winnerId,
        status: lotReoffer.status,
        createdAt: lotReoffer.createdAt,
        updatedAt: lotReoffer.updatedAt,
        respondedAt: lotReoffer.respondedAt,
        dueAt: sellerConsent.dueAt,
        accountName: legalEntity.displayName,
      })
      .from(lotReoffer)
      .innerJoin(lot, eq(lot.id, lotReoffer.lotId))
      .leftJoin(sellerConsent, eq(sellerConsent.id, lotReoffer.sellerConsentId))
      .leftJoin(legalEntity, eq(legalEntity.id, lotReoffer.offeredLegalEntityId))
      .where(
        and(
          lotNotDeleted(),
          or(
            // The seller has not answered and the day to do so is today or past.
            and(
              eq(lotReoffer.status, "awaiting_seller"),
              lt(sellerConsent.dueAt, new Date(now.getTime() + LAST_DAY_MS)),
            ),
            eq(lotReoffer.status, "seller_lapsed"),
            eq(lotReoffer.status, "ready"),
            inArray(lotReoffer.status, DECISION_STATUSES),
            and(
              eq(lotReoffer.status, "accepted"),
              gt(lotReoffer.respondedAt, new Date(now.getTime() - ACCEPTED_ITEM_DAYS * DAY_MS)),
            ),
          ),
          // An accepted offer is news only while its award stands: the lot is ended and the bidder
          // is still its winner (a later default or a return to inventory takes that away).
          or(
            ne(lotReoffer.status, "accepted"),
            and(eq(lot.status, "ended"), eq(lot.winnerId, lotReoffer.offeredUserId)),
          ),
          // Every other offer is work only while the lot still waits for a buyer: ended, with no
          // winner. Returning the lot to inventory (a draft with no winner), relisting it or
          // re-awarding it clears the item, whatever the offer's own status says.
          or(eq(lotReoffer.status, "accepted"), and(eq(lot.status, "ended"), isNull(lot.winnerId))),
          // A closed offer is work only while it is the lot's latest.
          or(
            inArray(lotReoffer.status, ["awaiting_seller", "ready", "accepted"]),
            notExists(
              this.db
                .select({ one: sql`1` })
                .from(later)
                .where(
                  and(eq(later.lotId, lotReoffer.lotId), gt(later.createdAt, lotReoffer.createdAt)),
                ),
            ),
          ),
        ),
      )
      .orderBy(desc(lotReoffer.updatedAt))
      .limit(limit);

    return rows.map((row) => {
      // The column is text with a check constraint; the mapper narrows it to a status.
      const status = toReofferRecord({ status: row.status, offerSentAt: null }).status;
      const kind = workKind(status);
      const data: Row = { ...row, status, accountName: row.accountName ?? null };
      return {
        sourceId: row.offerId,
        kind,
        domain: "saleroom" as const,
        title: lotWorkItemTitle(WORK_WORDING[kind].title, row.lotNumber, row.lotTitle),
        subtitle: WORK_WORDING[kind].subtitle(data),
        href: adminWorkItemHref(kind, { subjectId: row.lotId }),
        saleId: row.saleId,
        createdAt: row.createdAt,
        sourceUpdatedAt: row.updatedAt,
        assignedToUserId: null,
      };
    });
  }
}

function workKind(status: ReofferStatus): ReofferWorkKind {
  switch (status) {
    case "ready":
      return "reoffer_ready";
    case "accepted":
      return "reoffer_accepted";
    case "awaiting_seller":
    case "seller_lapsed":
      return "reoffer_no_reply";
    default:
      return "reoffer_decision";
  }
}
