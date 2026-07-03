import type { KycVerification } from "@auction/types";
import type {
  CreateKycSessionResult,
  KycStatusSummary,
  KycWebhookHandleResult,
} from "../interfaces/kyc-service.js";

/** Buyer session create/reuse for Veriff InContext. */
export interface IKycSessionService {
  isConfigured(): boolean;
  createSession(userId: string, returnUrl: string): Promise<CreateKycSessionResult>;
  getLatestForUser(userId: string): Promise<KycVerification | null>;
}

/** Push webhook ingest with idempotent persistence. */
export interface IKycWebhookIngestService {
  handleDecisionWebhook(
    rawBody: string,
    signature: string | undefined,
    authClient: string | undefined,
  ): Promise<KycWebhookHandleResult>;
  handleEventWebhook(
    rawBody: string,
    signature: string | undefined,
    authClient: string | undefined,
  ): Promise<void>;
}

/** Threshold enforcement for bidding and checkout paths. */
export interface IKycGateService {
  getStatus(userId: string): Promise<KycStatusSummary>;
  enforceThreshold(userId: string): Promise<void>;
}
