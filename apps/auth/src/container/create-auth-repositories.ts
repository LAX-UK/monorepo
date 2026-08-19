import type { IdentityEventPublisher } from "@auction/auth";
import type { Database } from "@auction/db";
import { createDrizzleIdentityEventPublisher } from "../infrastructure/drizzle-identity-event-publisher.js";

export type AuthRepositories = {
  identityEventPublisher: IdentityEventPublisher;
};

export function createAuthRepositories(db: Database): AuthRepositories {
  return {
    identityEventPublisher: createDrizzleIdentityEventPublisher(db),
  };
}
