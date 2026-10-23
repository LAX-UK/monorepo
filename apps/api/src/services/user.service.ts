import type { AccountDeletionOutcome } from "@auction/identity-contracts";
import type { IUserRepository } from "@auction/persistence/interfaces";
import type { IIdentityProfileClient } from "./interfaces/identity-issuer-client.js";

export class UserService {
  constructor(
    private readonly users: IUserRepository,
    private readonly identity?: Pick<IIdentityProfileClient, "requestAccountDeletion">,
  ) {}

  /**
   * Asks Identity to start the deletion grace period. Identity asks every product first, so the
   * answer may be a refusal; it is a business outcome here, not an error.
   */
  async requestAccountDeletion(userId: string): Promise<AccountDeletionOutcome> {
    if (!this.identity) throw new Error("Identity deletion service is not configured");
    return this.identity.requestAccountDeletion(userId);
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
