import type { HashedUserData, MarketingUserRef } from "@auction/types";
import type { IClickIdStore } from "./interfaces/click-id-store.js";
import type { IMarketingProfileReader } from "./interfaces/marketing-profile-reader.js";
import type { IPiiHasher } from "./interfaces/pii-hasher.js";
import type {
  IUserIdentityResolver,
  ResolvedUserIdentity,
} from "./interfaces/user-identity-resolver.js";

export class ProfileUserIdentityResolver implements IUserIdentityResolver {
  constructor(
    private readonly profileReader: IMarketingProfileReader,
    private readonly clickIdStore: IClickIdStore,
    private readonly hasher: IPiiHasher,
  ) {}

  async resolve(userRef: MarketingUserRef): Promise<ResolvedUserIdentity> {
    if (userRef.kind === "anon") {
      return { external_id: [this.hasher.hashExternalId(userRef.anonId)] };
    }

    const [profile, clickIds] = await Promise.all([
      this.profileReader.getProfile(userRef.userId),
      this.clickIdStore.get(userRef.userId),
    ]);

    const userData: HashedUserData = {
      external_id: [this.hasher.hashExternalId(userRef.userId)],
    };

    if (!profile) return userData;

    if (profile.email) userData.em = [this.hasher.hashEmail(profile.email)];
    if (profile.phone) userData.ph = [this.hasher.hashPhone(profile.phone)];
    const nameParts = (profile.name ?? "").trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts[0];
    if (firstName) userData.fn = [this.hasher.hashName(firstName)];
    if (nameParts.length >= 2) {
      userData.ln = [this.hasher.hashName(nameParts.slice(1).join(" "))];
    }
    if (clickIds?.fbp) userData.fbp = clickIds.fbp;
    if (clickIds?.fbc) userData.fbc = clickIds.fbc;

    return userData;
  }
}
