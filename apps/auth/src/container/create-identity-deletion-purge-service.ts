import type { IdentityEventPublisher } from "@auction/auth";
import type { IdentityDatabase } from "@auction/identity-db";
import { DrizzleDeletionPurgeRepository } from "../infrastructure/drizzle-deletion-purge.repository.js";
import {
  type IdentityDeletionPurgePorts,
  IdentityDeletionPurgeService,
} from "../services/identity-deletion-purge.service.js";

/** Wires the daily deletion run to the Identity database; everything else is passed in as ports. */
export function createIdentityDeletionPurgeService(options: {
  db: IdentityDatabase;
  events: IdentityEventPublisher;
  ports: Omit<IdentityDeletionPurgePorts, "repository">;
}): IdentityDeletionPurgeService {
  return new IdentityDeletionPurgeService({
    repository: new DrizzleDeletionPurgeRepository(options.db, options.events),
    ...options.ports,
  });
}
