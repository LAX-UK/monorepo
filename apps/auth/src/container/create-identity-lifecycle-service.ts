import type { IdentityEventPublisher } from "@auction/auth";
import type { Database } from "@auction/db";
import type { IdentityDatabase } from "@auction/identity-db";
import { DrizzleIdentityLifecycleRepository } from "../infrastructure/drizzle-identity-lifecycle-repository.js";
import type { BackchannelLogoutService } from "../services/backchannel-logout.service.js";
import { IdentityLifecycleService } from "../services/identity-lifecycle.service.js";

export function createIdentityLifecycleService(options: {
  db: Database;
  identityEventPublisher: IdentityEventPublisher;
  logout?: Pick<BackchannelLogoutService, "revokeSubject">;
}) {
  return new IdentityLifecycleService(
    new DrizzleIdentityLifecycleRepository(options.db as unknown as IdentityDatabase),
    options.identityEventPublisher,
    options.logout,
  );
}
