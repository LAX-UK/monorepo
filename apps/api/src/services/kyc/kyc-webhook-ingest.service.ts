import type { Database } from "@auction/db";
import type { KycVerification } from "@auction/types";
import type { z } from "zod";
import { tryClaimProcessedWebhookEvent } from "../../lib/processed-webhook-event.js";
import {
  veriffDecisionWebhookSchema,
  veriffEventWebhookSchema,
} from "../../lib/veriff/veriff-types.js";
import type { VeriffWebhookVerifier } from "../../lib/veriff/veriff-webhook-verifier.js";
import { KycNotConfiguredError, VeriffWebhookPayloadError } from "../interfaces/kyc-service.js";
import type { KycWebhookHandleResult } from "../interfaces/kyc-service.js";
import type { KycServiceDeps } from "./kyc-context.js";
import type { KycDecisionProcessor } from "./kyc-decision-processor.js";
import { mergeKycDecisionPayload } from "./kyc-user-feedback.js";
import type { IKycWebhookIngestService } from "./ports.js";
import {
  mapVeriffDecisionToApplyInput,
  mapVeriffEventToUserStatus,
  mapVeriffEventToVerificationStatus,
} from "./veriff-status-mapper.js";

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

export class KycWebhookIngestService implements IKycWebhookIngestService {
  constructor(
    private readonly deps: KycServiceDeps,
    private readonly webhookVerifier: VeriffWebhookVerifier,
    private readonly decisionProcessor: KycDecisionProcessor = deps.decisionProcessor,
  ) {}

  private isConfigured(): boolean {
    return this.deps.veriffClient.isConfigured() && Boolean(this.deps.sharedSecret);
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

    if (!this.deps.db) {
      return this.applyDecision(verification, parsed as Record<string, unknown>, null);
    }

    return this.deps.db.transaction(async (tx) => {
      const existing = await this.deps.sessionRepo.findByProviderSessionId(verification.id, tx);
      if (!existing) {
        return {
          verification: null,
          appliedUserKycUpdate: false,
          shouldProgressIndividuals: false,
        };
      }

      const { claimed } = await tryClaimProcessedWebhookEvent(tx, eventId, "veriff_decision");
      if (!claimed) {
        const userState = await this.deps.sessionRepo.getUserKycState(existing.userId, tx);
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
      const existing = await this.deps.sessionRepo.findByProviderSessionId(
        parsed.id,
        conn ?? undefined,
      );
      if (!existing) return;

      const webhookState = await this.deps.sessionRepo.getUserKycWebhookState(
        existing.userId,
        conn ?? undefined,
      );
      if (webhookState?.currentKycSessionId !== existing.providerSessionId) return;

      const userState = await this.deps.sessionRepo.getUserKycState(
        existing.userId,
        conn ?? undefined,
      );
      const userAlreadyApproved = userState?.kycStatus === "approved";
      const verificationTerminal = TERMINAL_VERIFICATION_STATUSES.has(existing.status);

      if (verificationStatus && !verificationTerminal) {
        const existingPayload = await this.deps.sessionRepo.getDecisionPayload(
          existing.id,
          conn ?? undefined,
        );
        await this.deps.sessionRepo.update(
          existing.id,
          {
            status: verificationStatus,
            decisionPayload: mergeKycDecisionPayload(
              existingPayload,
              parsed as Record<string, unknown>,
            ),
          },
          conn ?? undefined,
        );
      }
      if (userStatus && !userAlreadyApproved) {
        await this.deps.sessionRepo.setUserKycStatus(
          existing.userId,
          userStatus,
          null,
          conn ?? undefined,
        );
      }
    };

    if (!this.deps.db) {
      await applyEvent(null);
      return;
    }

    await this.deps.db.transaction(async (tx) => {
      const existing = await this.deps.sessionRepo.findByProviderSessionId(parsed.id, tx);
      if (!existing) return;

      const { claimed } = await tryClaimProcessedWebhookEvent(tx, eventId, "veriff_event");
      if (!claimed) return;

      await applyEvent(tx);
    });
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
        code: verification.code ?? null,
        reasonCode: verification.reasonCode ?? null,
        person: verification.person ?? null,
        document: verification.document ?? null,
        decisionTime: verification.decisionTime ?? null,
        riskScore: (verification as Record<string, unknown>).riskScore ?? null,
        ipCountry:
          ((verification as Record<string, unknown>).ipCountry as string | undefined) ?? null,
      },
      payload,
    );
    return this.decisionProcessor.apply(input, conn);
  }
}
