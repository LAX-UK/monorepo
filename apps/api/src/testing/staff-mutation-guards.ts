import { createAdminIdempotency } from "../middleware/admin-idempotency.js";
import { createRequireRecentStaffAuth } from "../middleware/require-recent-staff-auth.js";
import type { AdminStaffMutationGuards } from "../routes/admin/_shared.js";
import {
  IDEMPOTENCY_PENDING_VALUE,
  type IIdempotencyStore,
} from "../services/interfaces/idempotency-store.js";
import type { IStaffStepUpGuard } from "../services/staff-step-up.service.js";

/** In-memory stand-in for the Redis store; expiry is not modelled. */
export class InMemoryIdempotencyStore implements IIdempotencyStore {
  readonly entries = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.entries.get(key) ?? null;
  }

  async setWithExpiry(key: string, value: string): Promise<void> {
    this.entries.set(key, value);
  }

  async tryClaim(key: string): Promise<boolean> {
    if (this.entries.has(key)) return false;
    this.entries.set(key, IDEMPOTENCY_PENDING_VALUE);
    return true;
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }
}

/** A step-up guard whose answer a test controls. */
export function stubStepUpGuard(recent: boolean | (() => boolean)): IStaffStepUpGuard {
  return { isRecent: async () => (typeof recent === "function" ? recent() : recent) };
}

/**
 * The real step-up and idempotency middleware over stand-in collaborators, so route tests
 * exercise the same code paths the container wires.
 */
export function createTestStaffGuards(
  options: {
    recent?: boolean | (() => boolean);
    store?: IIdempotencyStore;
    /** Route tests set the session id the way the authenticator would. */
  } = {},
): AdminStaffMutationGuards {
  const store = options.store ?? new InMemoryIdempotencyStore();
  return {
    requireStepUp: createRequireRecentStaffAuth(stubStepUpGuard(options.recent ?? true)),
    idempotent: (scope) => createAdminIdempotency(store, scope),
  };
}
