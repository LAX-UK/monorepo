import type { IMediaUrlResolver } from "../interfaces/media-url-resolver.js";
import type { IUserPublicHttpApplicationService } from "../interfaces/user-routes/user-public-http.js";
import type { UserHttpJson } from "../interfaces/user-routes/user-route-http.js";
import type { UserService } from "../user.service.js";

export type UserPublicHttpDeps = {
  userService: UserService;
  mediaUrlResolver: IMediaUrlResolver;
};

export class UserPublicHttpApplicationService implements IUserPublicHttpApplicationService {
  constructor(private readonly deps: UserPublicHttpDeps) {}

  async listPublicArtists(input: { limit: number; offset: number }): Promise<UserHttpJson> {
    const rows = await this.deps.userService.listPublicArtists(input);
    const data = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        image: await this.deps.mediaUrlResolver.resolve(row.image),
      })),
    );
    return { status: 200, body: { data } };
  }

  async getPublicUserProfile(input: { userId: string }): Promise<UserHttpJson> {
    const row = await this.deps.userService.getById(input.userId);
    if (!row) return { status: 404, body: { error: "Not found" } };
    const image = await this.deps.mediaUrlResolver.resolve(row.image);
    return { status: 200, body: { data: { id: row.id, name: row.name, image } } };
  }
}
