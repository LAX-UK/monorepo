import type { UserHttpJson } from "./user-route-http.js";

/** Read-only portfolio and money views of the signed-in person's personal entity. */
export interface IUserLaxPortfolioHttpApplicationService {
  getPortfolio(input: { userId: string }): Promise<UserHttpJson>;

  getMoney(input: { userId: string }): Promise<UserHttpJson>;
}
