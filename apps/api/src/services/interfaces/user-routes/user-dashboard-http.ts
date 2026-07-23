import type { ListMyConditionReportRequestsQuery } from "@auction/validators";
import type { UserHttpJson } from "./user-route-http.js";

export interface IUserDashboardHttpApplicationService {
  listConditionReportRequests(input: {
    userId: string;
    query: ListMyConditionReportRequestsQuery;
  }): Promise<UserHttpJson>;

  listBids(input: { userId: string }): Promise<UserHttpJson>;

  listPortfolio(input: { userId: string }): Promise<UserHttpJson>;
}
