export type ConditionReportRequestRow = {
  id: string;
  lotId: string;
  requestedByUserId: string;
  requestingLegalEntityId: string | null;
  status: "pending" | "in_progress" | "fulfilled" | "declined";
  requestNote: string | null;
  responseNote: string | null;
  responseAttachmentUploadId: string | null;
  fulfilledByUserId: string | null;
  fulfilledAt: Date | null;
  createdAt: Date;
};

export type ConditionReportAdminListFilter = {
  status?: "open" | "pending" | "in_progress" | "fulfilled" | "declined" | undefined;
  lotId?: string | undefined;
  limit: number;
  offset: number;
};

export type ConditionReportRequestListRow = ConditionReportRequestRow & {
  lotTitle: string | null;
  requesterEmail: string | null;
};

export type BuyerConditionReportListRow = ConditionReportRequestRow & {
  lotTitle: string;
  lotNumber: number | null;
  downloadUrl: string | null;
};

export type InsertConditionReportRequestInput = {
  lotId: string;
  requestedByUserId: string;
  requestingLegalEntityId?: string | null;
  requestNote?: string | null;
};

export type UpdateConditionReportRequestInput = {
  status?: ConditionReportRequestRow["status"];
  responseNote?: string | null;
  responseAttachmentUploadId?: string | null;
  fulfilledByUserId?: string | null;
  fulfilledAt?: Date | null;
};

export interface IConditionReportRequestRepository {
  findById(id: string): Promise<ConditionReportRequestRow | null>;
  findOpenByLotAndUser(lotId: string, userId: string): Promise<ConditionReportRequestRow | null>;
  findAnyByLotAndUser(lotId: string, userId: string): Promise<ConditionReportRequestRow | null>;
  listByLotAndUser(lotId: string, userId: string): Promise<ConditionReportRequestRow[]>;
  insert(input: InsertConditionReportRequestInput): Promise<ConditionReportRequestRow>;
  updateById(
    id: string,
    patch: UpdateConditionReportRequestInput,
    tx?: unknown,
  ): Promise<ConditionReportRequestRow | null>;
  listForAdmin(
    filter: ConditionReportAdminListFilter,
  ): Promise<{ items: ConditionReportRequestListRow[]; total: number }>;
  listForBuyer(input: {
    userId: string;
    limit: number;
    offset: number;
  }): Promise<{ items: BuyerConditionReportListRow[]; total: number }>;
}
