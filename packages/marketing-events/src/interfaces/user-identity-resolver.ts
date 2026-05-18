import type { HashedUserData, MarketingUserRef } from "@auction/types";

export type ResolvedUserIdentity = HashedUserData;

export interface IUserIdentityResolver {
  resolve(userRef: MarketingUserRef): Promise<ResolvedUserIdentity>;
}
