import { alertRetentionCutoffs } from "@auction/alerts";
import { createDb } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import { sql } from "drizzle-orm";
import pg from "pg";
import pino from "pino";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { WorkerDb } from "../workers/types.js";
import { type WorkerRepositories, createWorkerRepositories } from "./create-worker-repositories.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const workerUrl = process.env.DATABASE_URL_WORKER;

/**
 * Every repository the worker wires in `createWorkerRepositories`, called once per method as
 * `worker_app` against the migrated schema. Unit tests use fakes and most integration tests
 * connect as the owner, so a missing grant otherwise shows up only as `permission denied`
 * (SQLSTATE 42501) in production. Any such error fails here, naming the repository and method.
 *
 * Each call runs in its own transaction that is always rolled back: an insert leaves nothing
 * behind and a denied statement cannot poison the next call. Arguments are impossible ids, so
 * reads find nothing and writes change nothing. Errors other than 42501 are fine: PostgreSQL
 * checks privileges before it checks constraints or looks for rows.
 */

const NIL = "00000000-0000-0000-0000-000000000000";
const PROBE_QR_CODE_ID = "00000000-0000-0000-0000-0000000000a1";
const PERMISSION_DENIED = "42501";
const log = pino({ level: "silent" });
const now = new Date();
const earlier = new Date(now.getTime() - 24 * 60 * 60 * 1000);

type Calls = Record<string, () => Promise<unknown>>;
type Probes = { [K in keyof WorkerRepositories]: (repo: WorkerRepositories[K]) => Calls };

const PROBES: Probes = {
  uploadValidationRepo: (r) => ({
    findUploadedById: () => r.findUploadedById(NIL),
    rejectUpload: () => r.rejectUpload(NIL, "probe"),
    activateUpload: () => r.activateUpload(NIL, { contentType: "image/png", byteSize: 1 }),
    findExpiredPending: () => r.findExpiredPending(now),
    findExpiredUnsentEnquiryUploads: () => r.findExpiredUnsentEnquiryUploads(now),
    deleteById: () => r.deleteById(NIL),
  }),
  emailOutboxRepo: (r) => ({
    claimForSend: () => r.claimForSend(NIL),
    findSuppression: () => r.findSuppression("probe"),
    markSuppressed: () => r.markSuppressed(NIL, "probe"),
    markSent: () => r.markSent(NIL, "probe"),
    markFailedOrPending: () => r.markFailedOrPending(NIL, "probe", false),
    markSentPersistenceFailed: () => r.markSentPersistenceFailed(NIL, "probe", "probe"),
    resolveUserEmail: () => r.resolveUserEmail(NIL),
    insertSuppression: () => r.insertSuppression("probe", "hard_bounce"),
    recoverStaleForDispatch: () => r.recoverStaleForDispatch(),
  }),
  emailAddressLookup: (r) => ({ findEmail: () => r.findEmail(NIL) }),
  payoutStatementRepo: (r) => ({
    findPayoutById: () => r.findPayoutById(NIL),
    findLegalEntityById: () => r.findLegalEntityById(NIL),
    findPayoutLines: () => r.findPayoutLines(NIL),
    findAuthorNames: () => r.findAuthorNames([NIL]),
    markStatementGenerated: () => r.markStatementGenerated(NIL, "probe"),
    markStatementError: () => r.markStatementError(NIL, "probe"),
  }),
  profileMarketingReader: (r) => ({ getProfile: () => r.getProfile(NIL) }),
  marketingEventOutboxWorker: (r) => ({
    claimSingle: () => r.claimSingle(NIL),
    claimStuckBatch: () => r.claimStuckBatch(1),
    purgeStaleTerminal: () => r.purgeStaleTerminal(earlier),
  }),
  dataExportRepo: (r) => ({
    findById: () => r.findById(NIL),
    getStatus: () => r.getStatus(NIL),
    updateProgress: () => r.updateProgress(NIL, { status: "processing", progress: 0 }),
    markCompleted: () =>
      r.markCompleted(NIL, { processedRows: 0, s3Key: "probe", fileSizeBytes: 0, expiresAt: now }),
    findStuckProcessing: () => r.findStuckProcessing(earlier, 1),
    markTimedOut: () => r.markTimedOut(NIL),
    findExpired: () => r.findExpired(now, 1),
    findOlderThan: () => r.findOlderThan(earlier, 1),
    deleteById: () => r.deleteById(NIL),
  }),
  staffRoleReader: (r) => ({
    listCurrent: () => r.listCurrent(NIL, now),
    listActiveRoles: () => r.listActiveRoles(NIL, now),
  }),
  newsletterSignupSyncRepo: (r) => ({
    markFailed: () => r.markFailed(NIL),
    markPushed: () => r.markPushed(NIL, 200),
    markRejected: () => r.markRejected(NIL, 400),
  }),
  kycRetentionStores: (stores) =>
    Object.fromEntries(
      stores.flatMap((store) => [
        [
          `${store.kind}.listCandidates`,
          () => store.listCandidates({ closedBefore: earlier, afterId: null, limit: 1 }),
        ],
        [`${store.kind}.dealRecords`, () => store.dealRecords(NIL)],
        [`${store.kind}.describeHolding`, () => store.describeHolding(NIL)],
        [
          `${store.kind}.erase`,
          () => store.erase(NIL, { relationshipEndedAt: earlier, purgedAt: now }),
        ],
      ]),
    ),
  alertRetentionStores: (stores) =>
    Object.fromEntries(
      stores.map((store) => [
        `${store.name}.prune`,
        () => store.prune(alertRetentionCutoffs(earlier), { dryRun: false }),
      ]),
    ),
  staffOpsRecipientReader: (r) => ({ listRecipients: () => r.listRecipients() }),
  complianceRecipientReader: (r) => ({ listRecipients: () => r.listRecipients() }),
  mediaAssetProcessorRepo: (r) => ({
    upsertProcessed: () =>
      r.upsertProcessed({ key: "probe", width: 1, height: 1, blurDataURL: "probe" }),
    listUnmeasuredExternalLotPictures: () => r.listUnmeasuredExternalLotPictures(1, []),
  }),
  coverAnalysisJobRepo: (r) => ({
    listPending: () => r.listPending(1),
    save: () => r.save("probe", { status: "failed" }),
  }),
  mediaAssetCleanupRepo: (r) => ({
    isKeyReferenced: () => r.isKeyReferenced(["probe"]),
    getVariants: () => r.getVariants("probe"),
    deleteByKey: () => r.deleteByKey("probe"),
  }),
  qrCodeScanPersister: (r) => ({ persist: () => r.persist({ qrCodeId: NIL }) }),
  qrCodeScanPurgeRepo: (r) => ({ purgeBefore: () => r.purgeBefore(earlier, 1) }),
  marketingClickIdPurgeRepo: (r) => ({ purgeStale: () => r.purgeStale(earlier) }),
  marketingAttributionPurgeRepo: (r) => ({ purgeStale: () => r.purgeStale(earlier) }),
  notificationWriteRepo: (r) => ({
    createMany: () =>
      r.createMany([
        { userId: NIL, type: "probe", title: "probe", message: "probe", legalEntityId: null },
      ]),
  }),
  transactionRunner: (r) => ({
    runInTransaction: () => r.runInTransaction((tx) => tx.execute(sql`select 1`)),
  }),
  adminReviewTaskProjectorRepo: (r) => ({
    findAmlScreeningReview: () => r.findAmlScreeningReview(NIL),
    createAmlScreeningReview: () =>
      r.createAmlScreeningReview({
        screeningId: NIL,
        userId: null,
        providerSessionId: null,
        outcome: null,
        matchStatus: null,
        categories: null,
        reasons: null,
      }),
    findSourceOfFundsReview: () => r.findSourceOfFundsReview(NIL),
    reactivateSourceOfFundsReview: () => r.reactivateSourceOfFundsReview(NIL),
    createSourceOfFundsReview: () =>
      r.createSourceOfFundsReview({
        sourceOfFundsId: NIL,
        userId: null,
        trigger: null,
        thresholdAmount: null,
        exposureAmount: null,
        currency: null,
      }),
  }),
  impersonationSweepRepo: (r) => ({ sweepStaleSessions: () => r.sweepStaleSessions(earlier, 1) }),
  identityOutboxRelayRepo: (r) => ({ relayBatch: () => r.relayBatch() }),
  legalEntityArchiveCascadeReader: (r) => ({
    getEntityDisplayName: () => r.getEntityDisplayName(NIL),
    listNotifyMembers: () => r.listNotifyMembers(NIL),
  }),
  domainEventSink: (r) => ({
    publish: () =>
      r.publish({
        aggregateType: "probe",
        aggregateId: NIL,
        eventType: "probe.contract",
        payload: {},
      }),
  }),
  projectorStateRepo: (r) => ({
    ensureCursor: () => r.ensureCursor("probe"),
    getCursor: () => r.getCursor("probe"),
    advanceCursor: () => r.advanceCursor("probe", 0),
    advanceCursorLiteralName: () => r.advanceCursorLiteralName("probe", 0),
    recordError: () => r.recordError("probe", "probe"),
  }),
  domainEventReader: (r) => ({
    getById: () => r.getById(0),
    listAfterCursor: () => r.listAfterCursor(0, { limit: 1 }),
  }),
  projectorFailureRecorder: (r) => ({
    record: () => r.record({ projectorName: "probe", eventId: 0, err: new Error("probe"), log }),
  }),
  notificationFanoutReader: (r) => ({
    listSaleCancelledPeople: () => r.listSaleCancelledPeople([NIL], NIL),
    listEntityRecipients: () => r.listEntityRecipients(NIL),
    getEntityDisplayName: () => r.getEntityDisplayName(NIL),
    getPayoutAmounts: () => r.getPayoutAmounts(NIL),
    getLotForVoided: () => r.getLotForVoided(NIL),
    getLotTitle: () => r.getLotTitle(NIL),
    getSaleTitle: () => r.getSaleTitle(NIL),
    getUserForProxyNotice: () => r.getUserForProxyNotice(NIL),
    getWinnerContact: () => r.getWinnerContact(NIL),
    getManualReviewContext: () => r.getManualReviewContext(NIL, NIL, NIL),
  }),
  adminImpersonationNotifyReader: (r) => ({
    getAdminDisplayName: () => r.getAdminDisplayName(NIL),
    listEntityOwnerAdmins: () => r.listEntityOwnerAdmins(NIL),
  }),
  paymentRefundNotifyReader: (r) => ({ getRefundContext: () => r.getRefundContext(NIL, NIL) }),
  collectionNoticeReader: (r) => ({
    visit: () => r.visit(NIL),
    dueReminders: () => r.dueReminders({ from: earlier, to: now, changedBefore: earlier }),
    collectorEmailsSince: () => r.collectorEmailsSince("probe", earlier),
    accountRecipients: () => r.accountRecipients(NIL, [NIL]),
  }),
  collectByReader: (r) => ({
    storedLotsDue: () =>
      r.storedLotsDue({ today: "2000-01-01", defaultFreeStorageDays: 30, reminderLeadDays: 7 }),
    remindedLotIds: () =>
      r.remindedLotIds({ keyPrefix: "probe:", userId: "probe", today: "2000-01-01" }),
  }),
  collectionLotFacts: (r) => ({
    lotIdsForBuyer: () => r.lotIdsForBuyer(NIL, NIL, 1),
    read: () => r.read([NIL]),
  }),
  payoutTransferFailedNotifyReader: (r) => ({
    getTransferFailedContext: () => r.getTransferFailedContext(NIL, NIL, 0, "GBP"),
  }),
  clearArtistBlocksRepo: (r) => ({
    getArtistStatus: () => r.getArtistStatus(NIL),
    clearLotsArtistReviewRequired: () => r.clearLotsArtistReviewRequired(NIL),
  }),
  zohoCampaignsOptOutLiftRepo: (r) => ({ liftOptOut: () => r.liftOptOut("probe", now) }),
  ensurePersonalLegalEntity: (r) => ({
    ensure: () => r.ensure({ userId: NIL, displayName: "Probe", email: "probe@integration.test" }),
  }),
  sourceOfFundsSettlementReader: (r) => ({
    loadSettlementContext: () => r.loadSettlementContext(NIL),
    getCaseStatus: () => r.getCaseStatus(NIL),
  }),
  sourceOfFundsBuyerReader: (r) => ({ getBuyerContact: () => r.getBuyerContact(NIL) }),
  sourceOfFundsDocumentsTaskRepo: (r) => ({
    reopenResolvedReviewTask: () => r.reopenResolvedReviewTask(NIL),
  }),
  sourceOfFundsDocumentReviewRepo: (r) => ({
    upsertReview: () =>
      r.upsertReview({
        documentId: NIL,
        sourceOfFundsId: NIL,
        reviewedByUserId: NIL,
        reviewedAt: now,
        checks: {
          matchesDeclaredSource: true,
          coversExposure: true,
          recentEnough: true,
          legibleComplete: true,
        },
        note: null,
      }),
  }),
  sourceOfFundsReviewResolutionRepo: (r) => ({
    resolveIfTerminal: () => r.resolveIfTerminal(NIL, null, log),
  }),
  lotNotifyReader: (r) => ({ getLotTitle: () => r.getLotTitle(NIL) }),
  domainEventDeliveryRepo: (r) => ({
    claim: () => r.claim({ consumer: "probe", batchSize: 1, leaseMs: 1 }),
    renewLease: () => r.renewLease({ deliveryId: 0, leaseMs: 1 }),
    markSucceeded: () => r.markSucceeded({ deliveryId: 0 }),
    markSkipped: () => r.markSkipped({ deliveryId: 0, reason: "probe" }),
    replaySkippedForEventTypes: () =>
      r.replaySkippedForEventTypes({ consumer: "probe", eventTypes: ["probe"], limit: 1 }),
    scheduleRetry: () => r.scheduleRetry({ deliveryId: 0, nextRetryAt: now, lastError: "probe" }),
    oldestPendingAt: () => r.oldestPendingAt({ consumer: "probe" }),
    deadLetter: () => r.deadLetter({ deliveryId: 0, lastError: "probe" }),
    replay: () => r.replay({ deliveryId: 0 }),
    ensurePending: () =>
      r.ensurePending({ consumer: "probe", eventId: 0, idempotencyKey: "probe" }),
    getById: () => r.getById(0),
    listDeadLettered: () => r.listDeadLettered({ limit: 1, offset: 0 }),
  }),
  crmRecordLinkRepo: (r) => ({
    findByEntity: () => r.findByEntity("probe", NIL),
    upsertLink: () =>
      r.upsertLink({
        entityType: "probe",
        entityId: NIL,
        zohoModule: "Contacts",
        zohoRecordId: "probe",
      }),
    mergeSubjectLinks: () =>
      r.mergeSubjectLinks({
        canonicalSubjectId: NIL,
        retiredSubjectId: NIL,
        tombstoneModule: "Contacts",
        tombstoneRecordId: "probe",
      }),
    reassignDealLinksSubjectId: () => r.reassignDealLinksSubjectId(NIL, NIL),
    markErased: () => r.markErased("probe", NIL),
    tombstone: () =>
      r.tombstone({
        entityType: "probe",
        entityId: NIL,
        tombstoneModule: "Contacts",
        tombstoneRecordId: "probe",
      }),
    tombstoneDealByZohoRecordId: () => r.tombstoneDealByZohoRecordId("probe"),
    setDeletionRequested: () => r.setDeletionRequested("probe", NIL),
    clearDeletionRequested: () => r.clearDeletionRequested("probe", NIL),
    isDeletionRequested: () => r.isDeletionRequested("probe", NIL),
    markRecyclePurged: () => r.markRecyclePurged("probe", NIL),
    isErased: () => r.isErased("probe", NIL),
    listActiveDealLinksBySubject: () => r.listActiveDealLinksBySubject(NIL),
    listActiveLinksBySubject: () => r.listActiveLinksBySubject(NIL, ["probe"]),
    listHeldDeals: () => r.listHeldDeals(1),
    touchLink: () => r.touchLink("probe", NIL),
    eraseHeldDealsBySubject: () => r.eraseHeldDealsBySubject(NIL),
  }),
};

class RolledBack extends Error {}

function findPermissionDenied(error: unknown): string | null {
  for (let cause = error; cause instanceof Error; cause = cause.cause) {
    const { code } = cause as { code?: string };
    if (code === PERMISSION_DENIED) return cause.message;
  }
  return null;
}

describe.skipIf(!ownerUrl || !workerUrl)("worker repositories as worker_app", () => {
  const env = { DOMAIN_EVENT_PUBLISH_VALIDATE: "off" } as const;
  const db = workerUrl ? createDb(workerUrl) : (undefined as never as WorkerDb);
  // Constructors run no queries, so a set built on the pool lists the methods to call.
  const wired = workerUrl ? createWorkerRepositories(db, env) : undefined;
  const calls = Object.entries(PROBES).flatMap(([name, probe]) =>
    wired
      ? Object.keys(probe(wired[name as keyof WorkerRepositories] as never)).map(
          (method) => [name, method] as const,
        )
      : [],
  );

  let owner: pg.Pool;

  beforeAll(async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    await applyApplicationRoleGrants(ownerUrl!);
    // The QR purge selects stale scans first and deletes only when it finds one, so it needs a
    // stale scan to reach its DELETE. The rows are inert; each call rolls its deletion back.
    owner = new pg.Pool({ connectionString: ownerUrl });
    await owner.query(
      `insert into qr_code (id, short_code, entity_type, entity_id)
       values ($1, 'role-contract', 'sale', $1) on conflict do nothing`,
      [PROBE_QR_CODE_ID],
    );
    await owner.query(
      `insert into qr_code_scan (id, qr_code_id, scanned_at)
       values ($1, $1, now() - interval '10 years') on conflict do nothing`,
      [PROBE_QR_CODE_ID],
    );
  });

  afterAll(async () => {
    await owner.query("delete from qr_code where id = $1", [PROBE_QR_CODE_ID]);
    await owner.end();
  });

  it("has a probe for every repository the worker wires, and none for one it does not", () => {
    expect(Object.keys(PROBES).sort()).toEqual(Object.keys(wired ?? {}).sort());
  });

  it.each(calls)("%s.%s is not denied", async (name, method) => {
    let denied: string | null = null;
    try {
      await db.transaction(async (tx) => {
        const repos = createWorkerRepositories(tx as unknown as WorkerDb, env);
        const probe = PROBES[name as keyof WorkerRepositories] as (repo: unknown) => Calls;
        try {
          await probe(repos[name as keyof WorkerRepositories])[method]?.();
        } catch (error) {
          denied = findPermissionDenied(error);
        }
        throw new RolledBack();
      });
    } catch (error) {
      if (!(error instanceof RolledBack)) throw error;
    }
    if (denied) throw new Error(`${name}.${method}: ${denied}`);
  });
});
