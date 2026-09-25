import type { UserHttpJson } from "./user-route-http.js";

export interface IUserPublicHttpApplicationService {
  listPublicArtists(input: { limit: number; offset: number }): Promise<UserHttpJson>;

  getPublicUserProfile(input: { userId: string }): Promise<UserHttpJson>;
}
