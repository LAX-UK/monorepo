import type { AdminOnboardingIssues } from "../../admin/admin-route-dtos.js";

export interface IAdminOnboardingIssuesReader {
  getOnboardingIssues(): Promise<AdminOnboardingIssues>;
}
