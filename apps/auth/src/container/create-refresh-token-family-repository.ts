import type { Database } from "@auction/db";
import type { BackchannelLogoutService } from "../services/backchannel-logout.service.js";
import { DrizzleRefreshTokenFamilyRepository } from "../services/refresh-token-family.repository.js";

export function createRefreshTokenFamilyRepository(
  db: Database,
  logout?: Pick<BackchannelLogoutService, "revokeSubject">,
) {
  return new DrizzleRefreshTokenFamilyRepository(db, logout);
}
