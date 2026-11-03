import {
  onsiteEvent,
  onsiteEventRsvp,
  sale,
  saleRegistration,
  telephoneBidBooking,
} from "@auction/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { type ExportSource, SourcedExportCategory } from "../sourced-export-category.js";
import type { SubjectExportDeps } from "../subject-export-deps.js";
import { iso, isoRequired, saleRef } from "../subject-export-values.js";
import { afterKey, countWhere } from "./keyset.js";

type SaleLike = { id: string; title: string };

/**
 * A refusal shows only that the registration was not approved. The reason text, who decided, the
 * bid limit set and LAX's notes on the registration are never selected.
 */
const REGISTRATION_STATUS: Record<string, string> = {
  pending: "pending",
  approved: "approved",
  rejected: "not_approved",
  withdrawn: "withdrawn",
};

const BOOKING_STATUS: Record<string, string> = {
  requested: "pending",
  confirmed: "approved",
  in_progress: "approved",
  completed: "approved",
  cancelled: "withdrawn",
};

export function mapSaleRegistration(
  row: {
    id: string;
    status: string;
    requestedAt: Date;
    decidedAt: Date | null;
    checkedInAt: Date | null;
    sale: SaleLike;
  },
  webOrigin: string,
) {
  const decided = row.status === "approved" || row.status === "rejected";
  return {
    id: row.id,
    origin: decided ? ("made_by_us" as const) : ("provided" as const),
    kind: "sale_registration",
    sale: saleRef(row.sale, webOrigin),
    status: REGISTRATION_STATUS[row.status] ?? row.status,
    registeredAt: isoRequired(row.requestedAt),
    decidedAt: iso(row.decidedAt),
    checkedInAt: iso(row.checkedInAt),
  };
}

export function mapTelephoneBooking(
  row: {
    id: string;
    status: string;
    createdAt: Date;
    confirmedAt: Date | null;
    sale: SaleLike;
  },
  webOrigin: string,
) {
  return {
    id: row.id,
    origin: row.status === "requested" ? ("provided" as const) : ("made_by_us" as const),
    kind: "telephone_booking",
    sale: saleRef(row.sale, webOrigin),
    status: BOOKING_STATUS[row.status] ?? row.status,
    registeredAt: isoRequired(row.createdAt),
    decidedAt: iso(row.confirmedAt),
    checkedInAt: null,
  };
}

export function mapEventRsvp(row: {
  id: string;
  eventSlug: string;
  eventTitle: string | null;
  createdAt: Date;
  checkedInAt: Date | null;
}) {
  return {
    id: row.id,
    origin: "provided" as const,
    kind: "event_rsvp",
    sale: { id: row.eventSlug, title: row.eventTitle ?? row.eventSlug, url: null },
    status: row.checkedInAt ? "checked_in" : "approved",
    registeredAt: isoRequired(row.createdAt),
    decidedAt: null,
    checkedInAt: iso(row.checkedInAt),
  };
}

export class RegistrationsCategory extends SourcedExportCategory {
  readonly id = "registrations";
  protected readonly sources: readonly ExportSource[];

  constructor(deps: SubjectExportDeps) {
    super();
    const { db, webOrigin } = deps;
    this.sources = [
      {
        count: (s) => countWhere(db, saleRegistration, eq(saleRegistration.userId, s)),
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: saleRegistration.id,
              status: saleRegistration.status,
              requestedAt: saleRegistration.requestedAt,
              decidedAt: saleRegistration.decidedAt,
              checkedInAt: saleRegistration.checkedInAt,
              saleId: sale.id,
              saleTitle: sale.title,
            })
            .from(saleRegistration)
            .innerJoin(sale, eq(sale.id, saleRegistration.saleId))
            .where(and(eq(saleRegistration.userId, s), afterKey(saleRegistration.id, after)))
            .orderBy(asc(saleRegistration.id))
            .limit(limit);
          return rows.map((row) => ({
            key: row.id,
            record: mapSaleRegistration(
              { ...row, sale: { id: row.saleId, title: row.saleTitle } },
              webOrigin,
            ),
          }));
        },
      },
      {
        count: (s) => countWhere(db, telephoneBidBooking, eq(telephoneBidBooking.userId, s)),
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: telephoneBidBooking.id,
              status: telephoneBidBooking.status,
              createdAt: telephoneBidBooking.createdAt,
              confirmedAt: telephoneBidBooking.confirmedAt,
              saleId: sale.id,
              saleTitle: sale.title,
            })
            .from(telephoneBidBooking)
            .innerJoin(sale, eq(sale.id, telephoneBidBooking.saleId))
            .where(and(eq(telephoneBidBooking.userId, s), afterKey(telephoneBidBooking.id, after)))
            .orderBy(asc(telephoneBidBooking.id))
            .limit(limit);
          return rows.map((row) => ({
            key: row.id,
            record: mapTelephoneBooking(
              { ...row, sale: { id: row.saleId, title: row.saleTitle } },
              webOrigin,
            ),
          }));
        },
      },
      {
        count: (s) => countWhere(db, onsiteEventRsvp, eq(onsiteEventRsvp.userId, s)),
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: onsiteEventRsvp.id,
              eventSlug: onsiteEventRsvp.eventSlug,
              eventTitle: onsiteEvent.title,
              createdAt: onsiteEventRsvp.createdAt,
              checkedInAt: onsiteEventRsvp.checkedInAt,
            })
            .from(onsiteEventRsvp)
            .leftJoin(onsiteEvent, eq(onsiteEvent.slug, onsiteEventRsvp.eventSlug))
            .where(and(eq(onsiteEventRsvp.userId, s), afterKey(onsiteEventRsvp.id, after)))
            .orderBy(asc(onsiteEventRsvp.id))
            .limit(limit);
          return rows.map((row) => ({ key: row.id, record: mapEventRsvp(row) }));
        },
      },
    ];
  }
}
