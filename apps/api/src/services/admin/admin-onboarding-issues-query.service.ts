import type { AdminOnboardingIssues } from "../../admin/admin-route-dtos.js";
import type { IAdminOnboardingIssuesReader } from "../../repositories/interfaces/admin-onboarding-issues.reader.js";
import type { IAdminOnboardingIssuesQueryService } from "../interfaces/admin-routes.js";

export class AdminOnboardingIssuesQueryService implements IAdminOnboardingIssuesQueryService {
  constructor(private readonly reader: IAdminOnboardingIssuesReader) {}

  getOnboardingIssues(): Promise<AdminOnboardingIssues> {
    return this.reader.getOnboardingIssues();
  }
}
