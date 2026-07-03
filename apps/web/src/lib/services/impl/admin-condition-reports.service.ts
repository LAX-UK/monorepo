import type { IAuthedApiClient } from "../http/authed-api-client";
import type {
  AdminFulfillConditionReportInput,
  IAdminConditionReportsService,
} from "../interfaces/admin-condition-reports-service";

function conditionReportPath(requestId: string, suffix: string): string {
  return `/admin/condition-report-requests/${encodeURIComponent(requestId)}/${suffix}`;
}

export class AdminConditionReportsService implements IAdminConditionReportsService {
  constructor(private readonly api: IAuthedApiClient) {}

  markInProgress(requestId: string) {
    return this.api.json<unknown>(conditionReportPath(requestId, "mark-in-progress"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
  }

  fulfill(requestId: string, input: AdminFulfillConditionReportInput) {
    return this.api.json<unknown>(conditionReportPath(requestId, "fulfill"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }

  decline(requestId: string, responseNote?: string) {
    return this.api.json<unknown>(conditionReportPath(requestId, "decline"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(responseNote ? { responseNote } : {}),
    });
  }
}
