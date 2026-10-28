import type { TemplateDomainSlice } from "./shared.js";

const names = [
  "submission-approved",
  "submission-converted",
  "submission-rejected",
  "submission-draft-reminder",
  "submission-changes-requested",
  "consignment-agreement-reminder",
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
  "submission-changes-requested": {
    userName?: string | null;
    submissionTitle: string;
    submissionUrl: string;
    note?: string | null;
    unsubscribeUrl: string;
  };
  "consignment-agreement-reminder": {
    userName?: string | null;
    submissionTitle: string;
    submissionUrl: string;
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
    "submission-changes-requested": "live",
    "consignment-agreement-reminder": "live",
  },
} satisfies TemplateDomainSlice<SubmissionTemplateName, SubmissionTemplateVars>;

export type { SubmissionTemplateName, SubmissionTemplateVars };
