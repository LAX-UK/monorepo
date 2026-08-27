import type { UserHttpJson } from "./user-route-http.js";

export interface IUserCategoryInterestsHttpApplicationService {
  getForUser(input: { userId: string }): Promise<UserHttpJson>;
  replacePreferences(input: {
    userId: string;
    categoryIds: readonly string[];
  }): Promise<UserHttpJson>;
  replaceAndComplete(input: {
    userId: string;
    categoryIds: readonly string[];
  }): Promise<UserHttpJson>;
}
