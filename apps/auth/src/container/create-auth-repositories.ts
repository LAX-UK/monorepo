import type { IdentityEventPublisher } from "@auction/auth";
import type { IdentityDatabase } from "@auction/identity-db";
import { createDrizzleIdentityEventPublisher } from "../infrastructure/drizzle-identity-event-publisher.js";

export type AuthRepositories = {
  identityEventPublisher: IdentityEventPublisher;
};

export function createAuthRepositories(db: IdentityDatabase): AuthRepositories {
  return {
    identityEventPublisher: createDrizzleIdentityEventPublisher(db),
  };
}
