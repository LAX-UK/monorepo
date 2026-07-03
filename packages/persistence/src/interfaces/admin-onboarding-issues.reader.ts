import type { AdminOnboardingIssues } from "./admin-read-models.js";

export interface IAdminOnboardingIssuesReader {
  getOnboardingIssues(): Promise<AdminOnboardingIssues>;
}

export type { AdminOnboardingIssues };
