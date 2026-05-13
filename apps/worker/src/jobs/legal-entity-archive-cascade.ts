import type { createDb } from "@auction/db";
import { bid, domainEvent, legalEntity, legalEntityMember, lot, user } from "@auction/db/schema";
import type { IEmailService } from "@auction/email";
import { and, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import type pino from "pino";

type Db = ReturnType<typeof createDb>;

const NOTIFY_ROLES = ["owner", "admin", "finance", "consignor", "buyer_agent"] as const;

async function listActiveProxyPairsForBuyerEntity(
  tx: Db,
  buyerLegalEntityId: string,
): Promise<{ lotId: string; bidderId: string }[]> {
  const rows = await tx
    .selectDistinct({ lotId: bid.lotId, bidderId: bid.bidderId })
    .from(bid)
    .innerJoin(lot, eq(lot.id, bid.lotId))
    .where(
      and(
        eq(bid.buyerLegalEntityId, buyerLegalEntityId),
        eq(lot.status, "active"),
        or(isNotNull(bid.maxAutoBidAmount), eq(bid.isAutoBid, true)),
      ),
    );
  return rows.map((r) => ({ lotId: r.lotId, bidderId: r.bidderId }));
}

async function clearProxyAutoBidForBidderOnLot(
  tx: Db,
  lotId: string,
  bidderId: string,
): Promise<number> {
  const updated = await tx
    .update(bid)
    .set({ maxAutoBidAmount: null, isAutoBid: false })
    .where(
      and(
        eq(bid.lotId, lotId),
        eq(bid.bidderId, bidderId),
        or(isNotNull(bid.maxAutoBidAmount), eq(bid.isAutoBid, true)),
      ),
    )
    .returning({ id: bid.id });
  return updated.length;
}

async function markArchivedSellerOnDraftScheduledLots(
  tx: Db,
  sellerLegalEntityId: string,
): Promise<number> {
  const updated = await tx
    .update(lot)
    .set({ archivedSeller: true, updatedAt: new Date() })
    .where(
      and(
        eq(lot.sellerLegalEntityId, sellerLegalEntityId),
        inArray(lot.status, ["draft", "scheduled"]),
      ),
    )
    .returning({ id: lot.id });
  return updated.length;
}

export type LegalEntityArchiveCascadeJobInput = {
  db: Db;
  emailService: IEmailService;
  log: pino.Logger;
  webOrigin: string;
  supportContactEmail: string;
  legalEntityId: string;
};

/** post-archive side effects (active buyer proxies, draft/scheduled lot flags,
 * member notice email, summary domain event).
 */
export async function runLegalEntityArchiveCascadeJob(
  input: LegalEntityArchiveCascadeJobInput,
): Promise<void> {
  const { db, emailService, log, webOrigin, supportContactEmail, legalEntityId } = input;

  const [entityRow] = await db
    .select({ displayName: legalEntity.displayName })
    .from(legalEntity)
    .where(eq(legalEntity.id, legalEntityId))
    .limit(1);
  const entityName = entityRow?.displayName ?? "Organisation";

  let proxiesCancelled = 0;
  let proxyEvents = 0;
  let lotsFlagged = 0;

  await db.transaction(async (tx) => {
    const pairs = await listActiveProxyPairsForBuyerEntity(tx, legalEntityId);
    for (const { lotId, bidderId } of pairs) {
      const cleared = await clearProxyAutoBidForBidderOnLot(tx, lotId, bidderId);
      if (cleared > 0) {
        proxiesCancelled += cleared;
        proxyEvents += 1;
        await tx.insert(domainEvent).values({
          aggregateType: "lot",
          aggregateId: lotId,
          eventType: "bid.proxy_cancelled",
          payload: {
            lotId,
            bidderUserId: bidderId,
            buyerLegalEntityId: legalEntityId,
            reason: "entity_archived",
          },
          producer: "apps/worker",
          actorUserId: null,
          actingLegalEntityId: legalEntityId,
          schemaVersion: 1,
        });
      }
    }

    lotsFlagged = await markArchivedSellerOnDraftScheduledLots(tx, legalEntityId);

    const members = await tx
      .selectDistinct({
        email: user.email,
        userId: user.id,
        firstName: user.firstName,
      })
      .from(legalEntityMember)
      .innerJoin(user, eq(user.id, legalEntityMember.userId))
      .where(
        and(
          eq(legalEntityMember.legalEntityId, legalEntityId),
          isNull(legalEntityMember.removedAt),
          isNotNull(legalEntityMember.acceptedAt),
          inArray(legalEntityMember.role, [...NOTIFY_ROLES]),
        ),
      );

    for (const m of members) {
      await emailService.enqueue({
        template: "legal-entity-archived-notice",
        to: m.email,
        userId: m.userId,
        vars: {
          recipientFirstName: m.firstName,
          entityName,
          legalEntityId,
          dashboardUrl: `${webOrigin.replace(/\/$/, "")}/dashboard`,
          supportContactEmail,
        },
        category: "transactional",
        idempotencyKey: `legal-entity-archived-notice:${legalEntityId}:${m.userId}`,
      });
    }

    await tx.insert(domainEvent).values({
      aggregateType: "legal_entity",
      aggregateId: legalEntityId,
      eventType: "legal_entity.archive_cascaded",
      payload: {
        legalEntityId,
        proxiesCancelled,
        proxyCancelEvents: proxyEvents,
        draftScheduledLotsFlagged: lotsFlagged,
        memberNoticeEmails: members.length,
      },
      producer: "apps/worker",
      actorUserId: null,
      actingLegalEntityId: legalEntityId,
      schemaVersion: 1,
    });
  });

  log.info(
    { legalEntityId, proxiesCancelled, lotsFlagged },
    "legal_entity_archive_cascade_completed",
  );
}
