import type { Lot } from "@auction/types";
import type { UpdateLotMarketingDetailsInput } from "@auction/validators";
import type { Result } from "neverthrow";

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

export type ConditionReportRequestListRow = ConditionReportRequestRow & {
  lotTitle: string | null;
  requesterEmail: string | null;
};

export type ConditionReportServiceError = { message: string; status: number; code?: string };

export type FulfillConditionReportInput = {
  id: string;
  fulfilledByUserId: string;
  conditionReport: NonNullable<UpdateLotMarketingDetailsInput["conditionReport"]>;
  responseNote?: string | undefined;
  responseAttachmentUploadId?: string | undefined;
};

export interface IConditionReportService {
  createRequest(input: {
    userId: string;
    lotId: string;
    requestingLegalEntityId?: string | undefined;
    requestNote?: string | undefined;
  }): Promise<Result<ConditionReportRequestRow, ConditionReportServiceError>>;

  listForAdmin(input: {
    status?: "pending" | "in_progress" | "fulfilled" | "declined" | undefined;
    lotId?: string | undefined;
    limit: number;
    offset: number;
  }): Promise<{ items: ConditionReportRequestListRow[]; total: number }>;

  fulfill(input: FulfillConditionReportInput): Promise<Result<Lot, ConditionReportServiceError>>;

  decline(input: {
    id: string;
    fulfilledByUserId: string;
    responseNote?: string | undefined;
  }): Promise<Result<void, ConditionReportServiceError>>;
}
