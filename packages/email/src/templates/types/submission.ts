import type { TemplateDomainSlice } from "./shared.js";

const names = [
  "submission-approved",
  "submission-converted",
  "submission-rejected",
  "submission-draft-reminder",
] as const;

type SubmissionTemplateName = (typeof names)[number];

type SubmissionTemplateVars = {
  "submission-approved": {
    userName?: string | null;
    submissionTitle: string;
    submissionUrl: string;
    unsubscribeUrl: string;
  };
  "submission-converted": {
    userName?: string | null;
    submissionTitle: string;
    submissionUrl: string;
    unsubscribeUrl: string;
  };
  "submission-rejected": {
    userName?: string | null;
    submissionTitle: string;
    submissionUrl: string;
    resubmitUrl: string;
    reasonSummary?: string | null;
    unsubscribeUrl: string;
  };
  "submission-draft-reminder": {
    userName?: string | null;
    submissionTitle: string;
    submissionUrl: string;
    staleDays: number;
    unsubscribeUrl: string;
  };
};

export const submissionTemplates = {
  names,
  vars: {} as SubmissionTemplateVars,
  recipientResolution: {
    "submission-approved": "live",
    "submission-converted": "live",
    "submission-rejected": "live",
    "submission-draft-reminder": "live",
  },
} satisfies TemplateDomainSlice<SubmissionTemplateName, SubmissionTemplateVars>;

export type { SubmissionTemplateName, SubmissionTemplateVars };
