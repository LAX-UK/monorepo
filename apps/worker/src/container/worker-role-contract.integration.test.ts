import { alertRetentionCutoffs } from "@auction/alerts";
import { createDb } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import { sql } from "drizzle-orm";
import pg from "pg";
import pino from "pino";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { WorkerDb } from "../workers/types.js";
import { type WorkerRepositories, createWorkerRepositories } from "./create-worker-repositories.js";
import { earlier, today } from "./worker-role-contract.fixtures.js";
import { NIL, countStatements, runRolledBack } from "./worker-role-contract.test-helpers.js";

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

const PROBE_QR_CODE_ID = "00000000-0000-0000-0000-0000000000a1";
/** A waiting lot sold under storage terms, so the collect-by reads run past their first query. */
const PROBE_LOT = {
  user: "role-contract-buyer",
  buyerEntity: "00000000-0000-0000-0000-0000000000b1",
  sellerEntity: "00000000-0000-0000-0000-0000000000b2",
  venue: "00000000-0000-0000-0000-0000000000b3",
  sale: "00000000-0000-0000-0000-0000000000b4",
  terms: "00000000-0000-0000-0000-0000000000b5",
  lot: "00000000-0000-0000-0000-0000000000b6",
};
/** After the probe lot's payment cleared, so it is returned: the reads then query its storage. */
const SWEEP_DAY = "2100-01-01";
const log = pino({ level: "silent" });
const now = today;

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
  enquiryQuarantinePurgeRepo: (r) => ({ purgeDue: () => r.purgeDue(earlier, 1) }),
  failedJobPayloadPurge: (r) => ({
    purgeResolvedPayloads: () => r.purgeResolvedPayloads(earlier, 1),
  }),
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
    advanceCursor: () => r.advanceCursor("probe", 1),
    advanceCursorLiteralName: () => r.advanceCursorLiteralName("probe", 1),
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
    existingOutboxKeys: () => r.existingOutboxKeys(["probe"]),
    accountRecipients: () => r.accountRecipients(NIL, [NIL]),
  }),
  collectByReader: (r) => ({
    withAccountLock: () => r.withAccountLock(NIL, async () => undefined),
    storedLotsWaiting: () => r.storedLotsWaiting({ today: SWEEP_DAY }),
    lotsClearedSince: () => r.lotsClearedSince(now),
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
    countSkippedForEventTypes: () =>
      r.countSkippedForEventTypes({ consumer: "probe", eventTypes: ["probe"], reason: "probe" }),
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

/** Committed by the owner, so `worker_app` sees it; removed again after the run. */
async function seedProbeLot(owner: pg.Pool): Promise<void> {
  const p = PROBE_LOT;
  await owner.query(
    `insert into "user" (id, name, email, email_verified, created_at, updated_at)
     values ($1, 'Buyer', $2, true, now(), now())`,
    [p.user, `${p.user}@integration.test`],
  );
  await owner.query(
    `insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
     values ($1, 'Probe buyer', 'individual', 'private_collector', $3, 'approved'),
            ($2, 'Probe seller', 'organisation', 'gallery', $3, 'approved')`,
    [p.buyerEntity, p.sellerEntity, p.user],
  );
  await owner.query(
    `insert into venue (id, legal_entity_id, name, address_line1, city, postcode, country)
     values ($1, $2, 'Probe gallery', '1 Test Street', 'London', 'W1W 6YW', 'GB')`,
    [p.venue, p.sellerEntity],
  );
  await owner.query(
    `insert into sale (id, title, start_time, end_time, venue_id, created_by_legal_entity_id)
     values ($1, 'Probe sale', now() - interval '30 days', now() - interval '20 days', $2, $3)`,
    [p.sale, p.venue, p.sellerEntity],
  );
  await owner.query(
    `insert into collection_place (venue_id, free_storage_days, online_booking_enabled)
     values ($1, 14, true)`,
    [p.venue],
  );
  await owner.query(
    `insert into collection_storage_terms (id, venue_id, free_days, count_mode, standard_daily_pence,
       large_daily_pence, handling_fee_pence, effective_from, reason)
     values ($1, $2, 14, 'calendar', 300, 600, 0, '2031-01-01', 'Probe terms')`,
    [p.terms, p.venue],
  );
  await owner.query(
    `insert into lot (id, seller_legal_entity_id, sale_id, title, lot_number, auction_type,
       starting_price, current_price, start_time, end_time, status, winner_id, buyer_legal_entity_id)
     values ($1, $2, $3, 'Probe lot', 1, 'english', 100, 100,
       now() - interval '40 days', now() - interval '20 days', 'ended', $4, $5)`,
    [p.lot, p.sellerEntity, p.sale, p.user, p.buyerEntity],
  );
  await owner.query(
    `insert into lot_fulfilment (lot_id, status, payment_cleared_at, storage_terms_id)
     values ($1, 'awaiting_release'::lot_fulfilment_status, '2031-02-13T12:00:00Z', $2)`,
    [p.lot, p.terms],
  );
}

async function removeProbeLot(owner: pg.Pool): Promise<void> {
  const p = PROBE_LOT;
  await owner.query("delete from lot_fulfilment where lot_id = $1", [p.lot]);
  await owner.query("delete from lot where id = $1", [p.lot]);
  await owner.query("delete from collection_storage_terms where id = $1", [p.terms]);
  await owner.query("delete from sale where id = $1", [p.sale]);
  await owner.query("delete from collection_place where venue_id = $1", [p.venue]);
  await owner.query("delete from venue where id = $1", [p.venue]);
  await owner.query("delete from legal_entity where id in ($1, $2)", [
    p.buyerEntity,
    p.sellerEntity,
  ]);
  await owner.query(`delete from "user" where id = $1`, [p.user]);
}

describe.skipIf(!ownerUrl || !workerUrl)("worker repositories as worker_app", () => {
  const env = { DOMAIN_EVENT_PUBLISH_VALIDATE: "off" } as const;
  const db = workerUrl ? createDb(workerUrl) : (undefined as never as WorkerDb);
  // Constructors run no queries, so a set built on the pool lists the methods to call.
  if (workerUrl) countStatements(db);
  const wired = workerUrl ? createWorkerRepositories(db, env) : undefined;
  const calls = Object.entries(PROBES).flatMap(([name, probe]) =>
    wired
      ? Object.keys(probe(wired[name as keyof WorkerRepositories] as never)).map(
          (method) => [name, method] as const,
        )
      : [],
  );

  let owner: pg.Pool;
  const unreached: string[] = [];

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
    await removeProbeLot(owner);
    await seedProbeLot(owner);
  });

  afterAll(async () => {
    await removeProbeLot(owner);
    await owner.query("delete from qr_code where id = $1", [PROBE_QR_CODE_ID]);
    await owner.end();
  });

  it("returns the probe lot, so the reads of its terms, extensions, waiver and quotes run", async () => {
    // Read as `worker_app` (not rolled back: it only reads), so a missing grant on the storage
    // tables fails here as `permission denied`.
    const found = await createWorkerRepositories(db, env).collectByReader.storedLotsWaiting({
      today: SWEEP_DAY,
    });
    const rows = found.filter((row) => row.lotId === PROBE_LOT.lot);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.storage).toBeDefined();
  });

  it("has a probe for every repository the worker wires, and none for one it does not", () => {
    expect(Object.keys(PROBES).sort()).toEqual(Object.keys(wired ?? {}).sort());
  });

  it.each(calls)("%s.%s is not denied", async (name, method) => {
    const { denied, reachedDatabase } = await runRolledBack(db, (tx) => {
      const repos = createWorkerRepositories(tx, env);
      const probe = PROBES[name as keyof WorkerRepositories] as (repo: unknown) => Calls;
      const call = probe(repos[name as keyof WorkerRepositories])[method];
      return call ? call() : Promise.resolve();
    });
    if (denied) throw new Error(`${name}.${method}: ${denied}`);
    if (!reachedDatabase) unreached.push(`${name}.${method}`);
  });

  it("reports the calls that never reached PostgreSQL", () => {
    console.info(`not proven (${unreached.length} of ${calls.length}):\n${unreached.join("\n")}`);
    expect(unreached, "every probe must run a statement past the privilege check").toEqual([]);
  });
});
