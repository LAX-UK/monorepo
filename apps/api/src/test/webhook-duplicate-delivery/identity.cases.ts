import type { Database } from "@auction/db";
import { sql } from "drizzle-orm";
import { vi } from "vitest";
import type { AmlServiceDeps } from "../../services/aml/aml-context.js";
import type { AmlMonitoringService } from "../../services/aml/aml-monitoring.service.js";
import { AmlWebhookIngestService } from "../../services/aml/aml-webhook-ingest.service.js";
import type { KycServiceDeps } from "../../services/kyc/kyc-context.js";
import type { KycDecisionProcessor } from "../../services/kyc/kyc-decision-processor.js";
import type { IKycNoticeQueue } from "../../services/kyc/kyc-notice-queue.js";
import { KycWebhookIngestService } from "../../services/kyc/kyc-webhook-ingest.service.js";
import { type DeliveryCase, eventSink, stub } from "./support.js";

const SESSION_ID = "veriff_session_duplicate_delivery";

const kycDeps = (
  runner: KycServiceDeps["transactionRunner"],
  sessionRepo: Record<string, unknown>,
  notices: IKycNoticeQueue | null = null,
) =>
  stub<KycServiceDeps>({
    transactionRunner: runner,
    notices,
    sessionRepo: stub(sessionRepo),
    sharedSecret: "secret",
    veriffClient: { isConfigured: () => true },
  });

const knownSession = {
  findByProviderSessionId: async () => ({
    id: "kyc_1",
    userId: "user_1",
    providerSessionId: SESSION_ID,
    status: "created",
  }),
  getUserKycWebhookState: async () => ({ currentKycSessionId: SESSION_ID }),
  getUserKycState: async () => ({ kycStatus: "pending" }),
  getDecisionPayload: async () => null,
};

/** The person an identity decision is for: one per event, so cases never share rows. */
const userIdFor = (eventId: string) => `kycn_${eventId}`;

const countOf = async (owner: Database, query: ReturnType<typeof sql>) =>
  Number((await owner.execute(query)).rows[0]?.count ?? 0);

/** The account an identity decision is for, which the owner seeds (api_app cannot). */
const decisionFixture: NonNullable<DeliveryCase["fixture"]> = {
  async seed(owner, eventId) {
    const userId = userIdFor(eventId);
    const address = `${userId}@integration.test`;
    await owner.execute(sql`
      insert into "user" (id, name, email, email_verified, created_at, updated_at)
      values (${userId}, 'Ada Lovelace', ${address}, true, now(), now())`);
    await owner.execute(sql`
      insert into bid_identity_directory (subject_id, email, name, email_verified, identity_created_at)
      values (${userId}, ${address}, 'Ada Lovelace', true, now())`);
  },
  async stored(owner, eventId) {
    const userId = userIdFor(eventId);
    return {
      emails: await countOf(
        owner,
        sql`select count(*) as count from email_outbox where user_id = ${userId}`,
      ),
      notices: await countOf(
        owner,
        sql`select count(*) as count from notification where user_id = ${userId}`,
      ),
    };
  },
  expected: { emails: 1, notices: 1 },
  async clean(owner, eventId) {
    const userId = userIdFor(eventId);
    await owner.execute(sql`delete from notification where user_id = ${userId}`);
    await owner.execute(sql`delete from email_outbox where user_id = ${userId}`);
    await owner.execute(sql`delete from bid_identity_directory where subject_id = ${userId}`);
    await owner.execute(sql`delete from "user" where id = ${userId}`);
  },
};

export const identityCases: DeliveryCase[] = [
  {
    name: "identity check decision",
    claimsTable: "processed_webhook_events",
    claimedEventId: (eventId) => `${eventId}:none:decision`,
    fixture: decisionFixture,
    build(eventId, runner, notices) {
      const apply = vi.fn(async () => ({
        verification: null,
        appliedUserKycUpdate: true,
        shouldProgressIndividuals: false,
        outcomeNotify: {
          userId: userIdFor(eventId),
          outcome: "approved" as const,
          providerSessionId: eventId,
          providerAttemptId: null,
        },
      }));
      const service = new KycWebhookIngestService(
        kycDeps(runner, knownSession, notices ?? stub<IKycNoticeQueue>()),
        stub({ verify: () => undefined }),
        stub<KycDecisionProcessor>({ apply }),
      );
      const body = JSON.stringify({
        status: "success",
        verification: { id: eventId, status: "approved" },
      });
      return {
        deliver: () => service.handleDecisionWebhook(body, "signature", "client"),
        effect: apply,
        // A replay is answered with the session as it stands and no change applied.
        isDuplicate: (result) =>
          (result as { appliedUserKycUpdate: boolean }).appliedUserKycUpdate === false,
      };
    },
  },
  {
    name: "identity check progress event",
    claimsTable: "processed_webhook_events",
    claimedEventId: (eventId) => `${eventId}:submitted:event`,
    build(eventId, runner) {
      const update = vi.fn(async () => undefined);
      const service = new KycWebhookIngestService(
        kycDeps(runner, { ...knownSession, update }),
        stub({ verify: () => undefined }),
      );
      const body = JSON.stringify({ id: eventId, action: "submitted" });
      return {
        deliver: () => service.handleEventWebhook(body, "signature", "client"),
        effect: update,
      };
    },
  },
  {
    name: "watchlist screening result",
    claimsTable: "processed_webhook_events",
    claimedEventId: (eventId) => `veriff_watchlist_fetch:${eventId}:initial_result`,
    build(eventId, runner) {
      const upsert = vi.fn(async () => ({
        id: "screening_1",
        userId: "user_1",
        providerSessionId: eventId,
        monitorStatus: "monitored",
      }));
      const deps = stub<AmlServiceDeps>({
        transactionRunner: runner,
        policy: { evaluate: () => ({ outcome: "clear", reasons: [] }) },
        screeningWriter: { upsertFromResult: upsert },
        holdStore: stub(),
        events: eventSink(),
      });
      const fetcher = {
        isConfigured: () => true,
        fetchBySessionId: async () => ({
          userId: "user_1",
          providerSessionId: eventId,
          checkType: "initial_result" as const,
          result: {
            provider: "veriff",
            providerSessionId: eventId,
            matchStatus: "no_match",
            monitorStatus: "monitored",
            totalHits: 0,
            hits: [],
            categories: [],
            rawPayload: {},
            screenedAt: new Date(),
          },
        }),
      };
      const service = new AmlWebhookIngestService(
        deps,
        stub(),
        fetcher as never,
        stub<AmlMonitoringService>(),
      );
      return {
        deliver: () => service.ingestFromFetch(eventId),
        effect: upsert,
        isDuplicate: (result) => (result as { processed: boolean }).processed === false,
      };
    },
  },
];
