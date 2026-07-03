import type {
  LegalEntity,
  LegalEntityKind,
  LegalEntityStatus,
  LegalEntitySubkind,
} from "@auction/types";

export type AdminStripeConnectRequirementRow = {
  id: string;
  displayName: string;
  status: LegalEntityStatus;
  stripeConnectRequirementsCurrentlyDue: string[];
};

/** Narrow row for admin picker UIs (matches GET /admin/legal-entities/browse). */
export type AdminLegalEntityPickerRow = {
  id: string;
  displayName: string;
  status: LegalEntityStatus;
};

/** Directory list row from GET /admin/legal-entities/browse. */
export type AdminLegalEntityListRow = {
  id: string;
  displayName: string;
  status: LegalEntityStatus;
  kind: LegalEntityKind;
  subkind: LegalEntitySubkind;
  updatedAt: string;
  stripeDueCount: number;
};

export type AdminLegalEntityListResult = {
  rows: AdminLegalEntityListRow[];
  total: number;
};

export type AdminLegalEntityDocument = {
  id: string;
  kind: string;
  label: string | null;
  reviewStatus: string;
  reviewNotes: string | null;
  reviewedAt: Date | null;
  uploadedAt: Date;
  uploadedByUserId: string;
  downloadUrl: string;
  contentType: string | null;
  byteSize: number | null;
};

export type { LegalEntity };
