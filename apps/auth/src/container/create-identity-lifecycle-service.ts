import type { IdentityEventPublisher } from "@auction/auth";
import type { IdentityDatabase } from "@auction/identity-db";
import { DrizzleIdentityLifecycleRepository } from "../infrastructure/drizzle-identity-lifecycle-repository.js";
import type { BackchannelLogoutService } from "../services/backchannel-logout.service.js";
import { IdentityLifecycleService } from "../services/identity-lifecycle.service.js";

export function createIdentityLifecycleService(options: {
  db: IdentityDatabase;
  identityEventPublisher: IdentityEventPublisher;
  logout?: Pick<BackchannelLogoutService, "revokeSubject">;
}) {
  return new IdentityLifecycleService(
    new DrizzleIdentityLifecycleRepository(options.db),
    options.identityEventPublisher,
    options.logout,
  );
}
