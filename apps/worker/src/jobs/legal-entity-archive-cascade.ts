import type { IEmailService } from "@auction/email";
import type { IRepositoryFactory, ITransactionRunner } from "@auction/persistence/interfaces";
import type pino from "pino";
import type { ILegalEntityArchiveCascadeReader } from "../interfaces/legal-entity-archive-cascade.reader.js";
import type { IWorkerDomainEventSink } from "../interfaces/worker-domain-event-sink.js";

export type LegalEntityArchiveCascadeJobInput = {
  transactionRunner: ITransactionRunner;
  repoFactory: IRepositoryFactory;
  domainEventSink: IWorkerDomainEventSink;
  archiveCascadeReader: ILegalEntityArchiveCascadeReader;
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
  const {
    transactionRunner,
    repoFactory,
    domainEventSink,
    archiveCascadeReader,
    emailService,
    log,
    webOrigin,
    supportContactEmail,
    legalEntityId,
  } = input;

  const entityName = await archiveCascadeReader.getEntityDisplayName(legalEntityId);

  let proxiesCancelled = 0;
  let proxyEvents = 0;
  let lotsFlagged = 0;

  await transactionRunner.runInTransaction(async (tx) => {
    const repos = repoFactory.forTransaction(tx);
    const events = domainEventSink.withTx(tx);
    const pairs = await repos.bid.listActiveProxyBidPairsForBuyerEntity(legalEntityId);
    for (const { lotId, bidderId } of pairs) {
      const cleared = await repos.bid.clearProxyAutoBidForBidderOnLot(lotId, bidderId);
      if (cleared > 0) {
        proxiesCancelled += cleared;
        proxyEvents += 1;
        await events.publish({
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

    lotsFlagged = await repos.lot.markArchivedSellerOnDraftScheduledLots(legalEntityId);

    const members = await archiveCascadeReader.listNotifyMembers(legalEntityId);

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

    await events.publish({
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
