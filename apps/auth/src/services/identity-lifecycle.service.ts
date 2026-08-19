import type { IdentityEventPublisher } from "@auction/auth";
import type { BackchannelLogoutService } from "./backchannel-logout.service.js";
import type {
  IIdentityLifecycleRepository,
  IdentityLifecycleMutationOutcome,
} from "./identity-lifecycle.ports.js";

export interface IIdentityLifecycleService {
  disable(subjectId: string, reason?: string | undefined): Promise<void>;
  enable(subjectId: string): Promise<void>;
  merge(retiredSubjectId: string, canonicalSubjectId: string): Promise<void>;
}

export class IdentityLifecycleConflictError extends Error {
  constructor(readonly code: "subject_not_found" | "invalid_merge") {
    super(code);
  }
}

/** Owns global Identity state transitions, session invalidation, and durable events. */
export class IdentityLifecycleService implements IIdentityLifecycleService {
  constructor(
    private readonly repository: IIdentityLifecycleRepository,
    private readonly identityEventPublisher: IdentityEventPublisher,
    private readonly logout?: Pick<BackchannelLogoutService, "revokeSubject">,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async disable(subjectId: string, reason?: string): Promise<void> {
    const normalizedReason = reason?.trim() || null;
    let changed = false;
    await this.repository.transaction(async (transaction) => {
      const outcome = await this.repository.disableSubject(transaction, {
        subjectId,
        reason: normalizedReason,
        now: this.now(),
      });
      this.assertValidOutcome(outcome);
      if (outcome === "unchanged") return;
      await this.identityEventPublisher.publish(
        {
          type: "user.identity_disabled",
          userId: subjectId,
          ...(normalizedReason ? { reason: normalizedReason } : {}),
        },
        { producer: "apps/auth", transaction },
      );
      changed = true;
    });
    if (changed) await this.logout?.revokeSubject(subjectId);
  }

  async enable(subjectId: string): Promise<void> {
    await this.repository.transaction(async (transaction) => {
      const outcome = await this.repository.enableSubject(transaction, {
        subjectId,
        now: this.now(),
      });
      this.assertValidOutcome(outcome);
      if (outcome === "unchanged") return;
      await this.identityEventPublisher.publish(
        { type: "user.identity_enabled", userId: subjectId },
        { producer: "apps/auth", transaction },
      );
    });
  }

  async merge(retiredSubjectId: string, canonicalSubjectId: string): Promise<void> {
    if (retiredSubjectId === canonicalSubjectId) {
      throw new IdentityLifecycleConflictError("invalid_merge");
    }

    let changed = false;
    await this.repository.transaction(async (transaction) => {
      const outcome = await this.repository.mergeSubjects(transaction, {
        retiredSubjectId,
        canonicalSubjectId,
        now: this.now(),
      });
      this.assertValidOutcome(outcome);
      if (outcome === "unchanged") return;
      await this.identityEventPublisher.publish(
        {
          type: "user.identity_merged",
          retiredSubjectId,
          canonicalSubjectId,
        },
        { producer: "apps/auth", transaction },
      );
      changed = true;
    });
    if (changed) await this.logout?.revokeSubject(retiredSubjectId);
  }

  private assertValidOutcome(outcome: IdentityLifecycleMutationOutcome): void {
    if (outcome === "not_found") {
      throw new IdentityLifecycleConflictError("subject_not_found");
    }
    if (outcome === "invalid_merge") {
      throw new IdentityLifecycleConflictError("invalid_merge");
    }
  }
}
