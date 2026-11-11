export type IdentityLifecycleEvent =
  | {
      type: "user.registered";
      userId: string;
      email: string;
      name: string;
      image?: string | null;
      phone?: string | null;
      emailVerified?: boolean;
      createdAt?: Date;
    }
  | { type: "user.email_verified"; userId: string; email: string }
  | {
      type: "user.profile_updated";
      userId: string;
      email?: string;
      /** Set when `email` is an address the person has just verified. */
      emailVerified?: boolean;
      name?: string;
      phone?: string | null;
      phoneVerified?: boolean;
      image?: string | null;
      /** LAX Account's time zone choice; sent together. */
      timeZoneMode?: "automatic" | "fixed";
      timeZone?: string | null;
    }
  | { type: "user.deletion_requested"; userId: string; requestedAt?: Date }
  | { type: "user.deletion_cancelled"; userId: string; cancelledAt?: Date }
  | {
      type: "user.deletion_held";
      userId: string;
      heldAt: Date;
      reasons: readonly { code: string; message: string; href: string | null }[];
    }
  | { type: "user.identity_disabled"; userId: string; reason?: string }
  | { type: "user.identity_enabled"; userId: string }
  | { type: "user.identity_merged"; retiredSubjectId: string; canonicalSubjectId: string }
  | { type: "user.identity_deleted"; userId: string }
  | { type: "subject.data_export_requested"; userId: string; exportId: string }
  | { type: "user.session_revoked"; userId: string; sessionId?: string }
  | {
      type: "user.credential_changed";
      userId: string;
      changeType?: "create" | "update";
    }
  | { type: "user.sign_in_method_unlinked"; userId: string; provider: "google" | "apple" }
  | { type: "user.sign_in_method_added"; userId: string; method: "google" | "apple" | "passkey" }
  | { type: "user.sign_in_method_removed"; userId: string; method: "google" | "apple" | "passkey" }
  | { type: "user.unconfirmed_password_removed"; userId: string; provider: "google" | "apple" }
  | {
      type: "user.social_link_refused_staff";
      userId: string;
      provider: "google" | "apple";
      attempt: "link" | "sign_in";
    };

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
