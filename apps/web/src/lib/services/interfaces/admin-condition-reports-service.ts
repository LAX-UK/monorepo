import type { ServiceResult } from "../http/service-result";

export type AdminFulfillConditionReportInput = {
  conditionReport: {
    summary?: string;
    details?: string;
    downloadUrl?: string;
  };
  responseNote?: string;
};

export interface IAdminConditionReportsService {
  markInProgress(requestId: string): Promise<ServiceResult<unknown>>;
  fulfill(
    requestId: string,
    input: AdminFulfillConditionReportInput,
  ): Promise<ServiceResult<unknown>>;
  decline(requestId: string, responseNote?: string): Promise<ServiceResult<unknown>>;
}
