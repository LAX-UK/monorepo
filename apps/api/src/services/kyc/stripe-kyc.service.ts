import type { KycVerification } from "@auction/types";
import Stripe from "stripe";
import type { Env } from "../../env.js";
import type { IKycRepository } from "../interfaces/kyc-repository.js";
import {
  type CreateKycSessionResult,
  type IKycService,
  KycNotConfiguredError,
  KycRequiredError,
  type KycStatusSummary,
} from "../interfaces/kyc-service.js";

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

function userKycStatusForVerification(
  s: KycVerification["status"],
): "unverified" | "pending" | "approved" | "rejected" {
  switch (s) {
    case "verified":
      return "approved";
    case "canceled":
    case "requires_input":
      return "rejected";
    case "processing":
    case "created":
      return "pending";
  }
}

export class StripeKycService implements IKycService {
  private readonly stripe: Stripe | null;
  private readonly webhookSecret: string | undefined;
  private readonly thresholdAmount: number;
  private readonly thresholdCurrency: string;

  constructor(
    env: Env,
    private readonly repo: IKycRepository,
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
    const verification = await this.repo.create({
      userId,
      stripeVerificationSessionId: session.id,
      status: mapStripeStatus(session.status),
    });
    await this.repo.setUserKycStatus(userId, "pending", null);
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
    const latest = await this.repo.findLatestByUserId(userId);
    const exposure = await this.repo.getPendingExposure(userId);
    const status: KycStatusSummary["status"] = latest
      ? userKycStatusForVerification(latest.status)
      : "unverified";
    const verifiedAt = latest?.status === "verified" ? latest.decisionAt : null;
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
  ): Promise<KycVerification | null> {
    if (!this.stripe) throw new KycNotConfiguredError();
    if (!this.webhookSecret) throw new KycNotConfiguredError();
    if (!signature) throw new Error("missing_stripe_signature");

    const event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);

    if (!event.type.startsWith("identity.verification_session.")) return null;

    const obj = event.data.object as Stripe.Identity.VerificationSession;
    const existing = await this.repo.findByStripeSessionId(obj.id);
    if (!existing) return null;

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

    const next = userKycStatusForVerification(status);
    await this.repo.setUserKycStatus(
      existing.userId,
      next,
      next === "approved" ? new Date() : null,
    );

    return updated;
  }

  async enforceThreshold(userId: string): Promise<void> {
    const summary = await this.getStatus(userId);
    if (summary.requiresKyc) throw new KycRequiredError(summary);
  }
}
