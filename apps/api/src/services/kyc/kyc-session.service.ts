import type { KycVerification } from "@auction/types";
import type { VeriffClient } from "../../lib/veriff/veriff-client.js";
import type { IKycSessionRepository } from "../interfaces/kyc-repository.js";
import {
  type CreateKycSessionResult,
  KycAlreadyApprovedError,
  KycNotConfiguredError,
} from "../interfaces/kyc-service.js";
import { assertHttpsReturnUrl, normalizeKycReturnUrl } from "./kyc-return-url.js";
import {
  readKycSessionUrl,
  readVeriffReasonCode,
  shouldReuseKycSessionUrl,
} from "./kyc-user-feedback.js";
import type { IKycSessionService } from "./ports.js";

const VERIFF_PROVIDER = "veriff";

export class KycSessionService implements IKycSessionService {
  constructor(
    private readonly sessionRepo: IKycSessionRepository,
    private readonly veriffClient: VeriffClient,
    private readonly sharedSecret: string | undefined,
    private readonly webOrigin: string,
  ) {}

  isConfigured(): boolean {
    return this.veriffClient.isConfigured() && Boolean(this.sharedSecret);
  }

  async createSession(userId: string, returnUrl: string): Promise<CreateKycSessionResult> {
    if (!this.isConfigured()) throw new KycNotConfiguredError();

    const userState = await this.sessionRepo.getUserKycState(userId);
    if (userState?.kycStatus === "approved") {
      throw new KycAlreadyApprovedError();
    }

    const latest = await this.sessionRepo.findLatestByUserIdWithPayload(userId);
    if (
      latest &&
      shouldReuseKycSessionUrl({
        latestSessionStatus: latest.verification.status,
        decisionPayload: latest.decisionPayload,
      })
    ) {
      const sessionUrl = readKycSessionUrl(latest.decisionPayload);
      if (sessionUrl) {
        return {
          sessionId: latest.verification.providerSessionId,
          verificationUrl: sessionUrl,
          verification: latest.verification,
        };
      }
    } else if (
      latest?.verification.status === "requires_input" &&
      !shouldReuseKycSessionUrl({
        latestSessionStatus: latest.verification.status,
        decisionPayload: latest.decisionPayload,
      })
    ) {
      console.warn(
        JSON.stringify({
          msg: "kyc_session_reuse_skipped",
          userId,
          sessionId: latest.verification.providerSessionId,
          reasonCode: readVeriffReasonCode(latest.decisionPayload),
        }),
      );
    }

    const callbackUrl = normalizeKycReturnUrl(returnUrl, this.webOrigin);
    assertHttpsReturnUrl(callbackUrl);

    const { sessionId, verificationUrl } = await this.veriffClient.createSession({
      userId,
      callbackUrl,
    });

    const verification = await this.sessionRepo.createWithCurrentSession({
      userId,
      provider: VERIFF_PROVIDER,
      providerSessionId: sessionId,
      status: "created",
    });

    await this.sessionRepo.update(verification.id, {
      decisionPayload: { sessionUrl: verificationUrl },
    });

    return { sessionId, verificationUrl, verification };
  }

  getLatestForUser(userId: string): Promise<KycVerification | null> {
    return this.sessionRepo.findLatestByUserId(userId);
  }
}
