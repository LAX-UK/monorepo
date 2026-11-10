import { vi } from "vitest";
import type { AmlServiceDeps } from "../../services/aml/aml-context.js";
import type { AmlMonitoringService } from "../../services/aml/aml-monitoring.service.js";
import { AmlWebhookIngestService } from "../../services/aml/aml-webhook-ingest.service.js";
import type { KycServiceDeps } from "../../services/kyc/kyc-context.js";
import type { KycDecisionProcessor } from "../../services/kyc/kyc-decision-processor.js";
import { KycWebhookIngestService } from "../../services/kyc/kyc-webhook-ingest.service.js";
import { type DeliveryCase, eventSink, stub } from "./support.js";

const SESSION_ID = "veriff_session_duplicate_delivery";

const kycDeps = (
  runner: KycServiceDeps["transactionRunner"],
  sessionRepo: Record<string, unknown>,
) =>
  stub<KycServiceDeps>({
    transactionRunner: runner,
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

export const identityCases: DeliveryCase[] = [
  {
    name: "identity check decision",
    claimsTable: "processed_webhook_events",
    claimedEventId: (eventId) => `${eventId}:none:decision`,
    build(eventId, runner) {
      const apply = vi.fn(async () => ({
        verification: null,
        appliedUserKycUpdate: true,
        shouldProgressIndividuals: false,
      }));
      const service = new KycWebhookIngestService(
        kycDeps(runner, knownSession),
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
