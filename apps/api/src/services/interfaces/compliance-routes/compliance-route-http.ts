import type { StaffRoles } from "@auction/types";
export type ComplianceHttpJson = { status: number; body: unknown };

export type ComplianceViewerContext = {
  userId: string;
  role?: string | null | undefined;
  staffRoles?: StaffRoles | undefined;
};
