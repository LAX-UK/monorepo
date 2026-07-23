export type ComplianceHttpJson = { status: number; body: unknown };

export type ComplianceViewerContext = {
  userId: string;
  role?: string | null | undefined;
  staffRole?: string | null | undefined;
};
