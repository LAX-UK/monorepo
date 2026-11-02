import {
  bid,
  bidIdentityDirectory,
  consignmentMessage,
  consignmentThread,
  itemSubmission,
  legalEntity,
  legalEntityMember,
  lot,
  sale,
  saleRegistration,
  userInvitation,
} from "@auction/db/schema";
import { and, asc, eq, isNotNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  type ExportSource,
  type SourceRow,
  SourcedExportCategory,
} from "../sourced-export-category.js";
import type { SubjectExportDeps } from "../subject-export-deps.js";
import { iso, isoRequired, lotRef, money, saleRef } from "../subject-export-values.js";
import { afterKey, countWhere } from "./keyset.js";

const ROLE_PHRASE: Record<string, string> = {
  owner: "an owner",
  admin: "an admin",
  consignor: "a consignor",
  finance: "a finance member",
  buyer_agent: "a buyer agent",
  viewer: "a viewer",
};

/**
 * Only the person's own part of an organisation: their membership, invitations they sent or
 * received, and what they did themselves on its behalf. The organisation's invoices, payments,
 * payouts, bank details, documents and bidding limit, and everything other members did, are not
 * read. Other members are never named: the person who invited them is described by role.
 */
export function mapMembership(row: {
  id: string;
  organisation: string;
  role: string;
  acceptedAt: Date | null;
  removedAt: Date | null;
  inviterRole: string | null;
}) {
  return {
    id: row.id,
    origin: "provided" as const,
    kind: "membership",
    organisation: row.organisation,
    role: row.role,
    joinedAt: iso(row.acceptedAt),
    leftAt: iso(row.removedAt),
    invitedBy: row.inviterRole ? (ROLE_PHRASE[row.inviterRole] ?? "a member") : null,
  };
}

export function mapInvitation(row: {
  id: string;
  organisation: string;
  sentByPerson: boolean;
  role: string | null;
  status: string;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt: Date | null;
}) {
  return {
    id: row.id,
    origin: "provided" as const,
    kind: "invitation",
    organisation: row.organisation,
    invitation: {
      direction: row.sentByPerson ? "sent" : "received",
      role: row.role,
      status: row.status,
      sentAt: isoRequired(row.createdAt),
      expiresAt: isoRequired(row.expiresAt),
      acceptedAt: iso(row.acceptedAt),
    },
  };
}

export type OrganisationAction = {
  key: string;
  type: "bid" | "sale_registration" | "consignment" | "message";
  organisation: string;
  at: Date;
  reference?: Record<string, unknown> | null;
  amount?: ReturnType<typeof money>;
};

export function mapAction(action: OrganisationAction) {
  return {
    id: `${action.type}:${action.key}`,
    origin: "observed" as const,
    kind: "action",
    organisation: action.organisation,
    action: {
      type: action.type,
      at: isoRequired(action.at),
      onBehalfOf: action.organisation,
      reference: action.reference ?? null,
      amount: action.amount ?? null,
    },
  };
}

export class OrganisationsCategory extends SourcedExportCategory {
  readonly id = "organisations";
  protected readonly sources: readonly ExportSource[];

  constructor({ db, webOrigin }: SubjectExportDeps) {
    super();
    const inviter = alias(legalEntityMember, "inviter");
    const personEmail = async (s: string): Promise<string | null> => {
      const [row] = await db
        .select({ email: bidIdentityDirectory.email })
        .from(bidIdentityDirectory)
        .where(eq(bidIdentityDirectory.subjectId, s))
        .limit(1);
      return row?.email.toLowerCase() ?? null;
    };
    const invitationFilter = async (s: string) => {
      const email = await personEmail(s);
      return and(
        isNotNull(userInvitation.targetLegalEntityId),
        or(
          eq(userInvitation.createdByUserId, s),
          eq(userInvitation.acceptedUserId, s),
          email ? sql`lower(${userInvitation.email}) = ${email}` : undefined,
        ),
      );
    };

    const actions = (
      rows: (
        s: string,
        after: string | null,
        limit: number,
      ) => Promise<(OrganisationAction & { key: string })[]>,
      count: (s: string) => Promise<number>,
    ): ExportSource => ({
      count,
      page: async (s, after, limit): Promise<SourceRow[]> =>
        (await rows(s, after, limit)).map((row) => ({ key: row.key, record: mapAction(row) })),
    });

    this.sources = [
      {
        count: async (s) => {
          // Personal accounts are memberships too, but only organisations are listed here.
          const [row] = await db
            .select({ n: sql<number>`count(*)` })
            .from(legalEntityMember)
            .innerJoin(legalEntity, eq(legalEntity.id, legalEntityMember.legalEntityId))
            .where(and(eq(legalEntityMember.userId, s), eq(legalEntity.kind, "organisation")));
          return Number(row?.n ?? 0);
        },
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: legalEntityMember.id,
              organisation: legalEntity.displayName,
              role: legalEntityMember.role,
              acceptedAt: legalEntityMember.acceptedAt,
              removedAt: legalEntityMember.removedAt,
              inviterRole: inviter.role,
            })
            .from(legalEntityMember)
            .innerJoin(legalEntity, eq(legalEntity.id, legalEntityMember.legalEntityId))
            .leftJoin(
              inviter,
              and(
                eq(inviter.legalEntityId, legalEntityMember.legalEntityId),
                eq(inviter.userId, legalEntityMember.invitedByUserId),
              ),
            )
            .where(
              and(
                eq(legalEntityMember.userId, s),
                eq(legalEntity.kind, "organisation"),
                afterKey(legalEntityMember.id, after),
              ),
            )
            .orderBy(asc(legalEntityMember.id))
            .limit(limit);
          return rows.map((row) => ({ key: row.id, record: mapMembership(row) }));
        },
      },
      {
        count: async (s) => countWhere(db, userInvitation, await invitationFilter(s)),
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: userInvitation.id,
              organisation: legalEntity.displayName,
              createdBy: userInvitation.createdByUserId,
              role: userInvitation.targetLegalEntityMemberRole,
              status: userInvitation.status,
              createdAt: userInvitation.createdAt,
              expiresAt: userInvitation.expiresAt,
              acceptedAt: userInvitation.acceptedAt,
            })
            .from(userInvitation)
            .innerJoin(legalEntity, eq(legalEntity.id, userInvitation.targetLegalEntityId))
            .where(and(await invitationFilter(s), afterKey(userInvitation.id, after)))
            .orderBy(asc(userInvitation.id))
            .limit(limit);
          return rows.map((row) => ({
            key: row.id,
            record: mapInvitation({ ...row, sentByPerson: row.createdBy === s }),
          }));
        },
      },
      actions(
        async (s, after, limit) => {
          const rows = await db
            .select({
              id: bid.id,
              organisation: legalEntity.displayName,
              amount: bid.amount,
              at: bid.createdAt,
              lotId: lot.id,
              lotTitle: lot.title,
              lotNumber: lot.lotNumber,
            })
            .from(bid)
            .innerJoin(legalEntity, eq(legalEntity.id, bid.buyerLegalEntityId))
            .innerJoin(lot, eq(lot.id, bid.lotId))
            .where(
              and(
                eq(bid.bidderId, s),
                eq(legalEntity.kind, "organisation"),
                afterKey(bid.id, after),
              ),
            )
            .orderBy(asc(bid.id))
            .limit(limit);
          return rows.map((row) => ({
            key: row.id,
            type: "bid" as const,
            organisation: row.organisation,
            at: row.at,
            amount: money(row.amount),
            reference: lotRef(
              { id: row.lotId, title: row.lotTitle, lotNumber: row.lotNumber },
              webOrigin,
            ),
          }));
        },
        async (s) => {
          const [row] = await db
            .select({ n: sql<number>`count(*)` })
            .from(bid)
            .innerJoin(legalEntity, eq(legalEntity.id, bid.buyerLegalEntityId))
            .where(and(eq(bid.bidderId, s), eq(legalEntity.kind, "organisation")));
          return Number(row?.n ?? 0);
        },
      ),
      actions(
        async (s, after, limit) => {
          const rows = await db
            .select({
              id: saleRegistration.id,
              organisation: legalEntity.displayName,
              at: saleRegistration.requestedAt,
              saleId: sale.id,
              saleTitle: sale.title,
            })
            .from(saleRegistration)
            .innerJoin(legalEntity, eq(legalEntity.id, saleRegistration.buyerLegalEntityId))
            .innerJoin(sale, eq(sale.id, saleRegistration.saleId))
            .where(
              and(
                eq(saleRegistration.userId, s),
                eq(legalEntity.kind, "organisation"),
                afterKey(saleRegistration.id, after),
              ),
            )
            .orderBy(asc(saleRegistration.id))
            .limit(limit);
          return rows.map((row) => ({
            key: row.id,
            type: "sale_registration" as const,
            organisation: row.organisation,
            at: row.at,
            reference: saleRef({ id: row.saleId, title: row.saleTitle }, webOrigin),
          }));
        },
        async (s) => {
          const [row] = await db
            .select({ n: sql<number>`count(*)` })
            .from(saleRegistration)
            .innerJoin(legalEntity, eq(legalEntity.id, saleRegistration.buyerLegalEntityId))
            .where(and(eq(saleRegistration.userId, s), eq(legalEntity.kind, "organisation")));
          return Number(row?.n ?? 0);
        },
      ),
      actions(
        async (s, after, limit) => {
          const rows = await db
            .select({
              id: itemSubmission.id,
              organisation: legalEntity.displayName,
              at: itemSubmission.createdAt,
              title: itemSubmission.title,
            })
            .from(itemSubmission)
            .innerJoin(legalEntity, eq(legalEntity.id, itemSubmission.legalEntityId))
            .where(
              and(
                eq(itemSubmission.submittedByUserId, s),
                eq(legalEntity.kind, "organisation"),
                afterKey(itemSubmission.id, after),
              ),
            )
            .orderBy(asc(itemSubmission.id))
            .limit(limit);
          return rows.map((row) => ({
            key: row.id,
            type: "consignment" as const,
            organisation: row.organisation,
            at: row.at,
            reference: { id: row.id, title: row.title },
          }));
        },
        async (s) => {
          const [row] = await db
            .select({ n: sql<number>`count(*)` })
            .from(itemSubmission)
            .innerJoin(legalEntity, eq(legalEntity.id, itemSubmission.legalEntityId))
            .where(
              and(eq(itemSubmission.submittedByUserId, s), eq(legalEntity.kind, "organisation")),
            );
          return Number(row?.n ?? 0);
        },
      ),
      actions(
        async (s, after, limit) => {
          // Pointers only: the words themselves are in the Messages category.
          const rows = await db
            .select({
              id: consignmentMessage.id,
              organisation: legalEntity.displayName,
              at: consignmentMessage.createdAt,
              threadId: consignmentMessage.threadId,
            })
            .from(consignmentMessage)
            .innerJoin(consignmentThread, eq(consignmentThread.id, consignmentMessage.threadId))
            .innerJoin(itemSubmission, eq(itemSubmission.id, consignmentThread.submissionId))
            .innerJoin(legalEntity, eq(legalEntity.id, itemSubmission.legalEntityId))
            .where(
              and(
                eq(consignmentMessage.authorUserId, s),
                eq(consignmentMessage.visibility, "thread"),
                eq(legalEntity.kind, "organisation"),
                afterKey(consignmentMessage.id, after),
              ),
            )
            .orderBy(asc(consignmentMessage.id))
            .limit(limit);
          return rows.map((row) => ({
            key: row.id,
            type: "message" as const,
            organisation: row.organisation,
            at: row.at,
            reference: { threadId: row.threadId },
          }));
        },
        async (s) => {
          const [row] = await db
            .select({ n: sql<number>`count(*)` })
            .from(consignmentMessage)
            .innerJoin(consignmentThread, eq(consignmentThread.id, consignmentMessage.threadId))
            .innerJoin(itemSubmission, eq(itemSubmission.id, consignmentThread.submissionId))
            .innerJoin(legalEntity, eq(legalEntity.id, itemSubmission.legalEntityId))
            .where(
              and(
                eq(consignmentMessage.authorUserId, s),
                eq(consignmentMessage.visibility, "thread"),
                eq(legalEntity.kind, "organisation"),
              ),
            );
          return Number(row?.n ?? 0);
        },
      ),
    ];
  }
}
