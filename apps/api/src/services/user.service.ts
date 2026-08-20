import type { IUserRepository } from "@auction/persistence/interfaces";
import type { IIdentityProfileClient } from "./interfaces/identity-issuer-client.js";

export class UserService {
  constructor(
    private readonly users: IUserRepository,
    private readonly identity?: Pick<IIdentityProfileClient, "markDeletionRequested">,
  ) {}

  async requestAccountDeletion(userId: string): Promise<void> {
    if (!this.identity) throw new Error("Identity deletion marker is not configured");
    await this.identity.markDeletionRequested(userId);
  }

  getById(id: string) {
    return this.users.findById(id);
  }

  listPublicArtists(params: { limit: number; offset: number }) {
    return this.users.listPublicProfiles(params);
  }

  /** dismiss the first-time acting-context tooltip. */
  markActingContextTooltipSeen(userId: string) {
    return this.users.updateActingContextTooltipSeen(userId, true);
  }
}
