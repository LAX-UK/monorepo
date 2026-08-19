import type { Database } from "@auction/db";
import type { IdentityDatabase } from "@auction/identity-db";
import { DrizzleRefreshTokenFamilyRepository } from "../infrastructure/drizzle-refresh-token-family-repository.js";
import type { BackchannelLogoutService } from "../services/backchannel-logout.service.js";

export function createRefreshTokenFamilyRepository(
  db: Database,
  logout?: Pick<BackchannelLogoutService, "revokeSubject">,
) {
  return new DrizzleRefreshTokenFamilyRepository(db as unknown as IdentityDatabase, logout);
}
