import type { Database } from "@auction/db";
import type { IKycSessionRepository } from "@auction/persistence";
import type { KycVerification, MarketingEvent, UserKycStatus } from "@auction/types";
import { buildMarketingEventConsent, nowUnixSeconds } from "../../lib/marketing-event-factory.js";
import type { KycWebhookHandleResult } from "../interfaces/kyc-service.js";
import type { IMarketingEventService } from "../interfaces/marketing-event-service.js";
import { buildKycUserFeedback, mergeKycDecisionPayload } from "./kyc-user-feedback.js";

export type KycVerifiedFields = {
  verifiedFirstName: string | null;
  verifiedLastName: string | null;
  verifiedDateOfBirth: Date | null;
  verifiedIdNumberLast4: string | null;
  verifiedIdCountry: string | null;
  verifiedIdType: string | null;
  verifiedIdExpiry: Date | null;
  verifiedGender: string | null;
  verifiedNationality: string | null;
  verifiedCitizenship: string | null;
  verifiedPlaceOfBirth: string | null;
  verifiedYearOfBirth: string | null;
  verifiedIdNumber: string | null;
  verifiedDocState: string | null;
  verifiedIdValidFrom: Date | null;
  decisionRiskScore: string | null;
  decisionIpCountry: string | null;
};

export type KycDecisionApplyInput = {
  providerSessionId: string;
  providerAttemptId: string | null;
  verificationStatus: KycVerification["status"];
  userKycUpdate: {
    setStatus: UserKycStatus | null;
    verifiedAt: Date | null;
    incrementRetry: boolean;
  };
  verifiedFields: KycVerifiedFields;
  decisionPayload: Record<string, unknown>;
  decisionAt: Date | null;
  isApproved: boolean;
};

const TERMINAL_VERIFICATION_STATUSES = new Set<KycVerification["status"]>(["verified", "canceled"]);

/** Applies a normalized KYC decision to persistence and user columns. */
export class KycDecisionProcessor {
  constructor(
    private readonly repo: IKycSessionRepository,
    private readonly marketingEvents: IMarketingEventService | null = null,
  ) {}

  async apply(
    input: KycDecisionApplyInput,
    conn: Database | null,
  ): Promise<KycWebhookHandleResult> {
    const existing = await this.repo.findByProviderSessionId(
      input.providerSessionId,
      conn ?? undefined,
    );
    if (!existing) {
      return { verification: null, appliedUserKycUpdate: false, shouldProgressIndividuals: false };
    }

    const userState = await this.repo.getUserKycState(existing.userId, conn ?? undefined);
    const userAlreadyApproved = userState?.kycStatus === "approved";
    const verificationTerminal = TERMINAL_VERIFICATION_STATUSES.has(existing.status);
    const skipVerificationDowngrade = verificationTerminal && !input.isApproved;
    const skipUserDowngrade = userAlreadyApproved && !input.isApproved;

    let updated = existing;
    if (!skipVerificationDowngrade) {
      const existingPayload = await this.repo.getDecisionPayload(existing.id, conn ?? undefined);
      updated = await this.repo.update(
        existing.id,
        {
          status: input.verificationStatus,
          providerAttemptId: input.providerAttemptId,
          decisionAt: input.decisionAt,
          decisionPayload: mergeKycDecisionPayload(existingPayload, input.decisionPayload),
          verifiedFirstName: input.verifiedFields.verifiedFirstName,
          verifiedLastName: input.verifiedFields.verifiedLastName,
          verifiedDateOfBirth: input.verifiedFields.verifiedDateOfBirth,
          verifiedIdNumberLast4: input.verifiedFields.verifiedIdNumberLast4,
          verifiedIdCountry: input.verifiedFields.verifiedIdCountry,
          verifiedIdType: input.verifiedFields.verifiedIdType,
          verifiedIdExpiry: input.verifiedFields.verifiedIdExpiry,
          verifiedGender: input.verifiedFields.verifiedGender,
          verifiedNationality: input.verifiedFields.verifiedNationality,
          verifiedCitizenship: input.verifiedFields.verifiedCitizenship,
          verifiedPlaceOfBirth: input.verifiedFields.verifiedPlaceOfBirth,
          verifiedYearOfBirth: input.verifiedFields.verifiedYearOfBirth,
          verifiedIdNumber: input.verifiedFields.verifiedIdNumber,
          verifiedDocState: input.verifiedFields.verifiedDocState,
          verifiedIdValidFrom: input.verifiedFields.verifiedIdValidFrom,
          decisionRiskScore: input.verifiedFields.decisionRiskScore,
          decisionIpCountry: input.verifiedFields.decisionIpCountry,
        },
        conn ?? undefined,
      );
    }

    const webhookState = await this.repo.getUserKycWebhookState(existing.userId, conn ?? undefined);
    const isCurrentSession =
      Boolean(webhookState) && webhookState?.currentKycSessionId === existing.providerSessionId;

    const { setStatus, verifiedAt, incrementRetry } = input.userKycUpdate;

    let appliedUserKycUpdate = false;
    let shouldProgressIndividuals = false;
    let marketingEventToEnqueue: MarketingEvent | undefined;
    let resubmissionNotify: KycWebhookHandleResult["resubmissionNotify"];

    if (isCurrentSession) {
      if (setStatus !== null && !skipUserDowngrade) {
        if (input.isApproved && conn && this.marketingEvents && !userAlreadyApproved) {
          marketingEventToEnqueue = {
            name: "CompleteRegistration",
            eventId: `kyc_approved_${existing.userId}`,
            eventTime: nowUnixSeconds(),
            actionSource: "system_generated",
            userIdOrAnon: { kind: "user", userId: existing.userId },
            consent: buildMarketingEventConsent(false, false, "legitimate_interest"),
            customData: { kycStatus: "approved" },
          };
          await this.repo.setUserKycStatus(existing.userId, setStatus, verifiedAt, conn);
          await this.marketingEvents.stage(marketingEventToEnqueue, conn);
        } else if (!userAlreadyApproved) {
          await this.repo.setUserKycStatus(
            existing.userId,
            setStatus,
            verifiedAt,
            conn ?? undefined,
          );
        }
        appliedUserKycUpdate = true;
      }
      if (incrementRetry && !userAlreadyApproved) {
        await this.repo.incrementUserKycRetryCount(existing.userId, conn ?? undefined);
        appliedUserKycUpdate = true;
      }
      shouldProgressIndividuals = input.isApproved && !userAlreadyApproved;
      if (
        input.verificationStatus === "requires_input" &&
        appliedUserKycUpdate &&
        !userAlreadyApproved
      ) {
        const mergedPayload = mergeKycDecisionPayload(
          await this.repo.getDecisionPayload(existing.id, conn ?? undefined),
          input.decisionPayload,
        );
        resubmissionNotify = {
          userId: existing.userId,
          providerSessionId: input.providerSessionId,
          providerAttemptId: input.providerAttemptId,
          feedback: buildKycUserFeedback({
            userStatus: setStatus ?? userState?.kycStatus ?? "pending",
            latestSessionStatus: input.verificationStatus,
            requiresKyc: false,
            decisionPayload: mergedPayload,
          }),
        };
      }
    } else {
      console.warn(
        JSON.stringify({
          msg: "kyc_webhook_stale_session",
          userId: existing.userId,
          sessionInWebhook: input.providerSessionId,
          userCurrentSessionId: webhookState?.currentKycSessionId ?? null,
        }),
      );
    }

    if (skipUserDowngrade || skipVerificationDowngrade) {
      console.warn(
        JSON.stringify({
          msg: "kyc_webhook_decision_downgrade_skipped",
          userId: existing.userId,
          sessionInWebhook: input.providerSessionId,
          userAlreadyApproved,
          verificationTerminal,
          incomingApproved: input.isApproved,
        }),
      );
    }

    return {
      verification: updated,
      appliedUserKycUpdate,
      shouldProgressIndividuals,
      ...(marketingEventToEnqueue ? { marketingEventToEnqueue } : {}),
      ...(resubmissionNotify ? { resubmissionNotify } : {}),
    };
  }
}
