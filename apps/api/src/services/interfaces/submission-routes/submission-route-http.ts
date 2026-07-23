export type SubmissionHttpJson = { status: number; body: unknown };

export type SubmissionViewerContext = {
  userId: string;
  role?: string | null | undefined;
  staffRole?: string | null | undefined;
};

export type SubmissionLegalEntityContext = {
  legalEntityId: string;
};
