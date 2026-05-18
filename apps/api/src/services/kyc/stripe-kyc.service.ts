import type { Database } from "@auction/db";
import type { KycVerification, MarketingEvent, UserKycStatus } from "@auction/types";
import Stripe from "stripe";
import type { Env } from "../../env.js";
import { buildMarketingEventConsent, nowUnixSeconds } from "../../lib/marketing-event-factory.js";
import type { IKycRepository } from "../interfaces/kyc-repository.js";
import {
  type CreateKycSessionResult,
  type IKycService,
  KycNotConfiguredError,
  KycRequiredError,
  type KycStatusSummary,
  type KycWebhookHandleResult,
} from "../interfaces/kyc-service.js";
import type { IMarketingEventService } from "../interfaces/marketing-event-service.js";

function mapStripeStatus(
  s: Stripe.Identity.VerificationSession["status"],
): KycVerification["status"] {
  switch (s) {
    case "verified":
      return "verified";
    case "processing":
      return "processing";
    case "requires_input":
      return "requires_input";
    case "canceled":
      return "canceled";
    default:
      return "created";
  }
}

/** Stripe Identity `last_error.code` values that count as a hard verification failure (increment retry). */
const KYC_HARD_FAILURE_CODES = new Set([
  "document_unverified_other",
  "document_expired",
  "document_type_not_supported",
  "selfie_document_missing_photo_id",
  "document_unverified_copy",
  "document_manipulated",
  "document_invalid",
  "document_name_mismatch",
]);

const KYC_USER_ACTION_CODES = new Set(["consent_declined", "under_supported_age"]);

function userKycUpdateFromStripeSession(obj: Stripe.Identity.VerificationSession): {
  setStatus: UserKycStatus | null;
  verifiedAt: Date | null;
  incrementRetry: boolean;
} {
  const stripeStatus = obj.status;
  const errCode = obj.last_error?.code ?? null;

  if (stripeStatus === "verified") {
    return { setStatus: "approved", verifiedAt: new Date(), incrementRetry: false };
  }
  if (stripeStatus === "canceled") {
    return { setStatus: null, verifiedAt: null, incrementRetry: false };
  }
  if (stripeStatus === "requires_input") {
    if (!errCode) {
      return { setStatus: null, verifiedAt: null, incrementRetry: false };
    }
    if (KYC_USER_ACTION_CODES.has(errCode)) {
      return { setStatus: "rejected", verifiedAt: null, incrementRetry: false };
    }
    if (KYC_HARD_FAILURE_CODES.has(errCode)) {
      return { setStatus: "rejected", verifiedAt: null, incrementRetry: true };
    }
    return { setStatus: "rejected", verifiedAt: null, incrementRetry: false };
  }
  if (stripeStatus === "processing" || stripeStatus === "created") {
    return { setStatus: "pending", verifiedAt: null, incrementRetry: false };
  }
  return { setStatus: "pending", verifiedAt: null, incrementRetry: false };
}

export class StripeKycService implements IKycService {
  private readonly stripe: Stripe | null;
  private readonly webhookSecret: string | undefined;
  private readonly thresholdAmount: number;
  private readonly thresholdCurrency: string;

  constructor(
    env: Env,
    private readonly repo: IKycRepository,
    private readonly db: Database | null = null,
    private readonly marketingEvents: IMarketingEventService | null = null,
  ) {
    this.webhookSecret = env.STRIPE_IDENTITY_WEBHOOK_SECRET;
    this.thresholdAmount = env.KYC_THRESHOLD_AMOUNT;
    this.thresholdCurrency = env.KYC_THRESHOLD_CURRENCY;
    this.stripe = env.STRIPE_SECRET_KEY
      ? new Stripe(env.STRIPE_SECRET_KEY, {
          typescript: true,
        })
      : null;
  }

  isConfigured(): boolean {
    return this.stripe !== null;
  }

  async createSession(userId: string, returnUrl: string): Promise<CreateKycSessionResult> {
    if (!this.stripe) throw new KycNotConfiguredError();
    const session = await this.stripe.identity.verificationSessions.create({
      type: "document",
      metadata: { userId },
      return_url: returnUrl,
      options: {
        document: {
          require_matching_selfie: true,
          require_id_number: false,
          require_live_capture: true,
        },
      },
    });
    const verification = await this.repo.createWithCurrentStripeSession({
      userId,
      stripeVerificationSessionId: session.id,
      status: mapStripeStatus(session.status),
    });
    return {
      sessionId: session.id,
      clientSecret: session.client_secret ?? "",
      hostedUrl: session.url ?? null,
      verification,
    };
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
      latestSessionId: latest?.stripeVerificationSessionId ?? null,
      pendingExposure: exposure,
      thresholdAmount: this.thresholdAmount,
      thresholdCurrency: this.thresholdCurrency,
      requiresKyc,
    };
  }

  async handleWebhook(
    rawBody: string,
    signature: string | undefined,
  ): Promise<KycWebhookHandleResult> {
    if (!this.stripe) throw new KycNotConfiguredError();
    if (!this.webhookSecret) throw new KycNotConfiguredError();
    if (!signature) throw new Error("missing_stripe_signature");

    const event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);

    if (!event.type.startsWith("identity.verification_session.")) {
      return { verification: null, appliedUserKycUpdate: false, shouldProgressIndividuals: false };
    }

    const obj = event.data.object as Stripe.Identity.VerificationSession;
    const existing = await this.repo.findByStripeSessionId(obj.id);
    if (!existing) {
      return { verification: null, appliedUserKycUpdate: false, shouldProgressIndividuals: false };
    }

    const verifiedOutputs = obj.verified_outputs ?? null;
    const status = mapStripeStatus(obj.status);
    const updated = await this.repo.update(existing.id, {
      status,
      decisionAt: status === "verified" || status === "canceled" ? new Date() : null,
      decisionPayload: obj as unknown as Record<string, unknown>,
      verifiedFirstName: verifiedOutputs?.first_name ?? null,
      verifiedLastName: verifiedOutputs?.last_name ?? null,
      verifiedDateOfBirth: verifiedOutputs?.dob
        ? new Date(
            `${verifiedOutputs.dob.year}-${String(verifiedOutputs.dob.month).padStart(2, "0")}-${String(
              verifiedOutputs.dob.day,
            ).padStart(2, "0")}`,
          )
        : null,
      verifiedIdNumberLast4: null,
      verifiedIdCountry: null,
      verifiedIdType: null,
      verifiedIdExpiry: null,
    });

    const webhookState = await this.repo.getUserKycWebhookState(existing.userId);
    const isCurrentSession =
      Boolean(webhookState) &&
      webhookState?.currentKycSessionId === existing.stripeVerificationSessionId;

    const decision = userKycUpdateFromStripeSession(obj);

    let appliedUserKycUpdate = false;
    let shouldProgressIndividuals = false;
    let marketingEventToEnqueue: MarketingEvent | undefined;

    if (isCurrentSession) {
      const isApproval = decision.setStatus === "approved";
      if (decision.setStatus !== null) {
        if (isApproval && this.db && this.marketingEvents && obj.status === "verified") {
          marketingEventToEnqueue = {
            name: "CompleteRegistration",
            eventId: `kyc_approved_${existing.userId}`,
            eventTime: nowUnixSeconds(),
            actionSource: "system_generated",
            userIdOrAnon: { kind: "user", userId: existing.userId },
            consent: buildMarketingEventConsent(false, false, "legitimate_interest"),
            customData: { kycStatus: "approved" },
          };
          await this.db.transaction(async (tx) => {
            await this.repo.setUserKycStatus(
              existing.userId,
              decision.setStatus!,
              decision.verifiedAt,
              tx,
            );
            await this.marketingEvents!.stage(marketingEventToEnqueue!, tx);
          });
        } else {
          await this.repo.setUserKycStatus(
            existing.userId,
            decision.setStatus,
            decision.verifiedAt,
          );
        }
        appliedUserKycUpdate = true;
      }
      if (decision.incrementRetry) {
        await this.repo.incrementUserKycRetryCount(existing.userId);
        appliedUserKycUpdate = true;
      }
      shouldProgressIndividuals = obj.status === "verified";
    } else {
      console.warn(
        JSON.stringify({
          msg: "kyc_webhook_stale_session",
          userId: existing.userId,
          sessionInWebhook: obj.id,
          userCurrentSessionId: webhookState?.currentKycSessionId ?? null,
        }),
      );
    }

    return {
      verification: updated,
      appliedUserKycUpdate,
      shouldProgressIndividuals,
      ...(marketingEventToEnqueue ? { marketingEventToEnqueue } : {}),
    };
  }

  async enforceThreshold(userId: string): Promise<void> {
    const summary = await this.getStatus(userId);
    if (summary.requiresKyc) throw new KycRequiredError(summary);
  }
}
