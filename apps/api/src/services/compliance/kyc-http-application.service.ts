import type { IKycHttpApplicationService } from "../interfaces/compliance-routes/compliance-kyc-http.js";
import type { ComplianceHttpJson } from "../interfaces/compliance-routes/compliance-route-http.js";
import {
  type IKycService,
  KycAlreadyApprovedError,
  KycNotConfiguredError,
} from "../interfaces/kyc-service.js";

export class KycHttpApplicationService implements IKycHttpApplicationService {
  constructor(private readonly kycService: IKycService) {}

  async getStatus(userId: string): Promise<ComplianceHttpJson> {
    const summary = await this.kycService.getStatus(userId);
    return { status: 200, body: { data: summary } };
  }

  async getLatestSession(userId: string): Promise<ComplianceHttpJson> {
    const latest = await this.kycService.getLatestForUser(userId);
    return { status: 200, body: { data: latest } };
  }

  async createSession(userId: string, returnUrl: string): Promise<ComplianceHttpJson> {
    try {
      const result = await this.kycService.createSession(userId, returnUrl);
      return { status: 201, body: { data: result } };
    } catch (err) {
      if (err instanceof KycNotConfiguredError) {
        return { status: 503, body: { error: "kyc_not_configured" } };
      }
      if (err instanceof KycAlreadyApprovedError) {
        return { status: 409, body: { error: err.code } };
      }
      const message = err instanceof Error ? err.message : "";
      if (
        message === "kyc_return_url_must_be_https" ||
        message === "kyc_return_url_invalid" ||
        message === "kyc_return_url_origin_not_allowed"
      ) {
        return { status: 400, body: { error: message } };
      }
      throw err;
    }
  }
}
