export type IdentityLifecycleTransaction = unknown;

export type IdentityLifecycleMutationOutcome =
  | "updated"
  | "unchanged"
  | "not_found"
  | "invalid_merge";

export interface IIdentityLifecycleRepository {
  transaction(
    operation: (transaction: IdentityLifecycleTransaction) => Promise<void>,
  ): Promise<void>;
  disableSubject(
    transaction: IdentityLifecycleTransaction,
    input: {
      subjectId: string;
      reason: string | null;
      now: Date;
    },
  ): Promise<IdentityLifecycleMutationOutcome>;
  enableSubject(
    transaction: IdentityLifecycleTransaction,
    input: {
      subjectId: string;
      now: Date;
    },
  ): Promise<IdentityLifecycleMutationOutcome>;
  mergeSubjects(
    transaction: IdentityLifecycleTransaction,
    input: {
      retiredSubjectId: string;
      canonicalSubjectId: string;
      now: Date;
    },
  ): Promise<IdentityLifecycleMutationOutcome>;
}
