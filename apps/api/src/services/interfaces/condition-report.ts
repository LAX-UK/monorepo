import type { BuyerConditionReportListRow, ConditionReportRequestListRow, ConditionReportRequestRow } from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";
import type { UpdateLotMarketingDetailsInput } from "@auction/validators";
import type { Result } from "neverthrow";

export type {
  BuyerConditionReportListRow,
  ConditionReportRequestListRow,
  ConditionReportRequestRow,
};

export type ConditionReportServiceError = { message: string; status: number; code?: string };

export type FulfillConditionReportInput = {
  id: string;
  fulfilledByUserId: string;
  conditionReport: NonNullable<UpdateLotMarketingDetailsInput["conditionReport"]>;
  responseNote?: string | undefined;
  responseAttachmentUploadId?: string | undefined;
};

export interface IConditionReportBuyerService {
  createRequest(input: {
    userId: string;
    lotId: string;
    requestingLegalEntityId?: string | undefined;
    requestNote?: string | undefined;
  }): Promise<Result<ConditionReportRequestRow, ConditionReportServiceError>>;

  findForBuyerOnLot(input: {
    userId: string;
    lotId: string;
  }): Promise<ConditionReportRequestRow | null>;

  listForBuyer(input: {
    userId: string;
    limit: number;
    offset: number;
  }): Promise<{ items: BuyerConditionReportListRow[]; total: number }>;
}

export interface IConditionReportAdminService {
  listForAdmin(input: {
    status?: "open" | "pending" | "in_progress" | "fulfilled" | "declined" | undefined;
    lotId?: string | undefined;
    limit: number;
    offset: number;
  }): Promise<{ items: ConditionReportRequestListRow[]; total: number }>;

  markInProgress(input: {
    id: string;
    actorUserId: string;
  }): Promise<Result<ConditionReportRequestRow, ConditionReportServiceError>>;

  fulfill(input: FulfillConditionReportInput): Promise<Result<Lot, ConditionReportServiceError>>;

  decline(input: {
    id: string;
    fulfilledByUserId: string;
    responseNote?: string | undefined;
  }): Promise<Result<void, ConditionReportServiceError>>;
}

export interface IConditionReportFulfilmentService {
  fulfill(input: FulfillConditionReportInput): Promise<Result<Lot, ConditionReportServiceError>>;

  decline(input: {
    id: string;
    fulfilledByUserId: string;
    responseNote?: string | undefined;
  }): Promise<Result<void, ConditionReportServiceError>>;
}

export interface IConditionReportService
  extends IConditionReportBuyerService,
    IConditionReportAdminService {}
