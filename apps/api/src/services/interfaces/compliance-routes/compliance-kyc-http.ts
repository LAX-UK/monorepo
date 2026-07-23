import type { ComplianceHttpJson } from "./compliance-route-http.js";

export interface IKycHttpApplicationService {
  getStatus(userId: string): Promise<ComplianceHttpJson>;

  getLatestSession(userId: string): Promise<ComplianceHttpJson>;

  createSession(userId: string, returnUrl: string): Promise<ComplianceHttpJson>;
}
