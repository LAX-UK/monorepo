export type IdentityLifecycleEvent =
  | { type: "user.registered"; userId: string; email: string; name: string }
  | { type: "user.email_verified"; userId: string; email: string }
  | {
      type: "user.profile_updated";
      userId: string;
      email?: string;
      name?: string;
      phone?: string | null;
    }
  | { type: "user.identity_disabled"; userId: string; reason?: string }
  | { type: "user.identity_enabled"; userId: string }
  | { type: "user.identity_merged"; retiredSubjectId: string; canonicalSubjectId: string }
  | { type: "user.identity_deleted"; userId: string }
  | { type: "user.session_revoked"; userId: string; sessionId?: string }
  | { type: "user.credential_changed"; userId: string };

export type IdentityEventPublisher = {
  publish(
    event: IdentityLifecycleEvent,
    options?: {
      producer?: string;
      /** Adapter-specific transaction handle; ignored by non-transactional publishers. */
      transaction?: unknown;
    },
  ): Promise<void>;
};
