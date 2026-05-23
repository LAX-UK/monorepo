import type { Database } from "@auction/db";
import type { KycVerification } from "@auction/types";
import type { z } from "zod";
import type { Env } from "../../env.js";
import { tryClaimProcessedWebhookEvent } from "../../lib/processed-webhook-event.js";
import { VeriffClient } from "../../lib/veriff/veriff-client.js";
import {
  veriffDecisionWebhookSchema,
  veriffEventWebhookSchema,
} from "../../lib/veriff/veriff-types.js";
import {
  VeriffWebhookSignatureError,
  VeriffWebhookVerifier,
} from "../../lib/veriff/veriff-webhook-verifier.js";
import type { IKycRepository } from "../interfaces/kyc-repository.js";
import {
  type CreateKycSessionResult,
  type IKycService,
  KycAlreadyApprovedError,
  KycNotConfiguredError,
  KycRequiredError,
  type KycStatusSummary,
  type KycWebhookHandleResult,
  VeriffWebhookPayloadError,
} from "../interfaces/kyc-service.js";
import type { IMarketingEventService } from "../interfaces/marketing-event-service.js";
import { KycDecisionProcessor } from "./kyc-decision-processor.js";
import { assertHttpsReturnUrl, normalizeKycReturnUrl } from "./kyc-return-url.js";
import {
  mapVeriffDecisionToApplyInput,
  mapVeriffEventToUserStatus,
  mapVeriffEventToVerificationStatus,
} from "./veriff-status-mapper.js";

const VERIFF_PROVIDER = "veriff";

const TERMINAL_VERIFICATION_STATUSES = new Set<KycVerification["status"]>(["verified", "canceled"]);

function parseWebhookJson(rawBody: string): unknown {
  try {
    return JSON.parse(rawBody);
  } catch {
    throw new VeriffWebhookPayloadError("invalid_webhook_json");
  }
}

function parseVeriffSchema<T>(schema: z.ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new VeriffWebhookPayloadError("invalid_webhook_payload");
  }
  return parsed.data;
}

export class VeriffKycService implements IKycService {
  private readonly veriffClient: VeriffClient;
  private readonly webhookVerifier: VeriffWebhookVerifier;
  private readonly decisionProcessor: KycDecisionProcessor;
  private readonly thresholdAmount: number;
  private readonly thresholdCurrency: string;
  private readonly sharedSecret: string | undefined;
  private readonly webOrigin: string;

  constructor(
    env: Env,
    private readonly repo: IKycRepository,
    private readonly db: Database | null = null,
    marketingEvents: IMarketingEventService | null = null,
    veriffClient?: VeriffClient,
  ) {
    this.veriffClient = veriffClient ?? VeriffClient.fromEnv(env);
    this.sharedSecret = env.VERIFF_SHARED_SECRET;
    this.webhookVerifier = new VeriffWebhookVerifier(env.VERIFF_API_KEY, env.VERIFF_SHARED_SECRET);
    this.decisionProcessor = new KycDecisionProcessor(repo, marketingEvents);
    this.thresholdAmount = env.KYC_THRESHOLD_AMOUNT;
    this.thresholdCurrency = env.KYC_THRESHOLD_CURRENCY;
    this.webOrigin = env.WEB_ORIGIN;
  }

  isConfigured(): boolean {
    return this.veriffClient.isConfigured() && Boolean(this.sharedSecret);
  }

  async createSession(userId: string, returnUrl: string): Promise<CreateKycSessionResult> {
    if (!this.isConfigured()) throw new KycNotConfiguredError();

    const userState = await this.repo.getUserKycState(userId);
    if (userState?.kycStatus === "approved") {
      throw new KycAlreadyApprovedError();
    }

    const callbackUrl = normalizeKycReturnUrl(returnUrl, this.webOrigin);
    assertHttpsReturnUrl(callbackUrl);

    const { sessionId, verificationUrl } = await this.veriffClient.createSession({
      userId,
      callbackUrl,
    });

    const verification = await this.repo.createWithCurrentSession({
      userId,
      provider: VERIFF_PROVIDER,
      providerSessionId: sessionId,
      status: "created",
    });

    return { sessionId, verificationUrl, verification };
  }

  getLatestForUser(userId: string): Promise<KycVerification | null> {
    return this.repo.findLatestByUserId(userId);
  }

  async getStatus(userId: string): Promise<KycStatusSummary> {
    const userState = await this.repo.getUserKycState(userId);
    const latest = await this.repo.findLatestByUserId(userId);
    const exposure = await this.repo.getPendingExposure(userId);
    const status: KycStatusSummary["status"] = userState?.kycStatus ?? "unverified";
    const verifiedAt = status === "approved" ? (userState?.kycVerifiedAt ?? null) : null;
    const requiresKyc = exposure.total >= this.thresholdAmount && status !== "approved";
    return {
      status,
      verifiedAt,
      latestSessionId: latest?.providerSessionId ?? null,
      pendingExposure: exposure,
      thresholdAmount: this.thresholdAmount,
      thresholdCurrency: this.thresholdCurrency,
      requiresKyc,
    };
  }

  async handleDecisionWebhook(
    rawBody: string,
    signature: string | undefined,
    authClient: string | undefined,
  ): Promise<KycWebhookHandleResult> {
    if (!this.isConfigured()) throw new KycNotConfiguredError();
    this.webhookVerifier.verify(rawBody, signature, authClient);

    const parsed = parseVeriffSchema(veriffDecisionWebhookSchema, parseWebhookJson(rawBody));
    const verification = parsed.verification;
    if (!verification?.id || parsed.status !== "success") {
      return { verification: null, appliedUserKycUpdate: false, shouldProgressIndividuals: false };
    }

    const eventId = `${verification.id}:${verification.attemptId ?? "none"}:decision`;

    if (!this.db) {
      return this.applyDecision(verification, parsed as Record<string, unknown>, null);
    }

    return this.db.transaction(async (tx) => {
      const existing = await this.repo.findByProviderSessionId(verification.id, tx);
      if (!existing) {
        return {
          verification: null,
          appliedUserKycUpdate: false,
          shouldProgressIndividuals: false,
        };
      }

      const { claimed } = await tryClaimProcessedWebhookEvent(tx, eventId, "veriff_decision");
      if (!claimed) {
        const userState = await this.repo.getUserKycState(existing.userId, tx);
        const retryProgression = userState?.kycStatus === "approved";
        return {
          verification: existing,
          appliedUserKycUpdate: false,
          shouldProgressIndividuals: retryProgression,
        };
      }
      return this.applyDecision(verification, parsed as Record<string, unknown>, tx);
    });
  }

  async handleEventWebhook(
    rawBody: string,
    signature: string | undefined,
    authClient: string | undefined,
  ): Promise<void> {
    if (!this.isConfigured()) throw new KycNotConfiguredError();
    this.webhookVerifier.verify(rawBody, signature, authClient);

    const parsed = parseVeriffSchema(veriffEventWebhookSchema, parseWebhookJson(rawBody));
    const verificationStatus = mapVeriffEventToVerificationStatus(parsed.action);
    const userStatus = mapVeriffEventToUserStatus(parsed.action);
    if (!verificationStatus && !userStatus) return;

    const eventId = `${parsed.id}:${parsed.action}:event`;

    const applyEvent = async (conn: Database | null) => {
      const existing = await this.repo.findByProviderSessionId(parsed.id, conn ?? undefined);
      if (!existing) return;

      const webhookState = await this.repo.getUserKycWebhookState(
        existing.userId,
        conn ?? undefined,
      );
      if (webhookState?.currentKycSessionId !== existing.providerSessionId) return;

      const userState = await this.repo.getUserKycState(existing.userId, conn ?? undefined);
      const userAlreadyApproved = userState?.kycStatus === "approved";
      const verificationTerminal = TERMINAL_VERIFICATION_STATUSES.has(existing.status);

      if (verificationStatus && !verificationTerminal) {
        await this.repo.update(
          existing.id,
          {
            status: verificationStatus,
            decisionPayload: parsed as Record<string, unknown>,
          },
          conn ?? undefined,
        );
      }
      if (userStatus && !userAlreadyApproved) {
        await this.repo.setUserKycStatus(existing.userId, userStatus, null, conn ?? undefined);
      }
    };

    if (!this.db) {
      await applyEvent(null);
      return;
    }

    await this.db.transaction(async (tx) => {
      const existing = await this.repo.findByProviderSessionId(parsed.id, tx);
      if (!existing) return;

      const { claimed } = await tryClaimProcessedWebhookEvent(tx, eventId, "veriff_event");
      if (!claimed) return;

      await applyEvent(tx);
    });
  }

  async enforceThreshold(userId: string): Promise<void> {
    const summary = await this.getStatus(userId);
    if (summary.requiresKyc) throw new KycRequiredError(summary);
  }

  private async applyDecision(
    verification: NonNullable<ReturnType<typeof veriffDecisionWebhookSchema.parse>["verification"]>,
    payload: Record<string, unknown>,
    conn: Database | null,
  ): Promise<KycWebhookHandleResult> {
    const input = mapVeriffDecisionToApplyInput(
      {
        id: verification.id,
        attemptId: verification.attemptId ?? null,
        status: verification.status,
        reasonCode: verification.reasonCode ?? null,
        person: verification.person ?? null,
        document: verification.document ?? null,
        decisionTime: verification.decisionTime ?? null,
      },
      payload,
    );
    return this.decisionProcessor.apply(input, conn);
  }
}

export { VeriffWebhookSignatureError };
