import type { LegalEntityKind, LegalEntityStatus } from "@auction/types";

export type AdminLegalEntityBrowseRow = {
  id: string;
  displayName: string;
  status: string;
  kind: string;
  subkind: string;
  updatedAt: Date;
  stripeDueCount: number;
};

export type AdminLegalEntityBrowseSummary = {
  total: number;
  byStatus: Record<LegalEntityStatus, number>;
  stripeDueCount: number;
  byKind: Record<LegalEntityKind, number>;
};

export type AdminLegalEntityBrowseResult = {
  rows: AdminLegalEntityBrowseRow[];
  total: number;
  summary: AdminLegalEntityBrowseSummary;
};

export type AdminLegalEntityBrowseParams = {
  q?: string;
  /** When set, only entities created by this user. */
  createdByUserId?: string;
  status?: LegalEntityStatus;
  kind?: LegalEntityKind;
  stripeDue?: boolean;
  limit: number;
  offset: number;
};

export type AdminLegalEntityBrowseFilter = Omit<AdminLegalEntityBrowseParams, "limit" | "offset">;
