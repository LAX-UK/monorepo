/**
 * Something happened to a person's LAX Account that they should hear about by email. The issuer
 * app turns each event into the right message, so the Better Auth hooks here only say what
 * happened and never build email copy, links or times themselves.
 */
export type SecurityNoticeEvent =
  | {
      kind: "sign_in";
      userId: string;
      at: Date;
      userAgent: string | null;
      /** Coarse location signal such as an ISO country code from the edge; never an IP address. */
      region: string | null;
    }
  | { kind: "password_changed"; userId: string; at: Date; userAgent?: string | null }
  | { kind: "two_factor_enabled"; userId: string; at: Date; userAgent?: string | null }
  | { kind: "two_factor_disabled"; userId: string; at: Date; userAgent?: string | null }
  | { kind: "two_factor_reset_by_support"; userId: string; at: Date; userAgent?: string | null }
  | { kind: "backup_codes_regenerated"; userId: string; at: Date; userAgent?: string | null }
  | {
      kind: "account_deletion_requested";
      userId: string;
      at: Date;
      /** When the grace period ends and the personal data is erased. */
      effectiveAt: Date;
      userAgent?: string | null;
    }
  | { kind: "account_deletion_cancelled"; userId: string; at: Date; userAgent?: string | null }
  | {
      kind: "data_export_requested";
      userId: string;
      at: Date;
      /** The browser the request came from, as LAX Account forwarded it. */
      userAgent?: string | null;
    }
  | {
      kind: "data_export_ready";
      userId: string;
      at: Date;
      /** When the copy is deleted. */
      expiresAt: Date;
      userAgent?: string | null;
    }
  | {
      /** A week before the erasure: a last chance to cancel. */
      kind: "account_deletion_reminder";
      userId: string;
      at: Date;
      effectiveAt: Date;
      userAgent?: string | null;
    }
  | {
      /** The erasure was due but something is still open, so the details were kept. */
      kind: "account_deletion_held";
      userId: string;
      at: Date;
      /** One plain sentence per open item, as each product described it. */
      reasons: readonly string[];
      /** When the purge looks again. */
      nextCheckAt: Date;
      userAgent?: string | null;
    }
  | {
      /**
       * The erasure is done. The address is the one copied just before the scrub: the account
       * no longer holds it, and nothing keeps it once the message has been sent.
       */
      kind: "account_deletion_completed";
      userId: string;
      at: Date;
      email: string;
      userAgent?: string | null;
    }
  | {
      /** A Google or Apple sign-in was removed from the account. */
      kind: "sign_in_method_removed";
      userId: string;
      at: Date;
      provider: "google" | "apple";
      userAgent?: string | null;
    }
  | { kind: "phone_verified"; userId: string; at: Date; phone: string; userAgent?: string | null }
  | { kind: "phone_removed"; userId: string; at: Date; phone: string; userAgent?: string | null }
  | {
      kind: "email_changed";
      userId: string;
      at: Date;
      previousEmail: string;
      newEmail: string;
      userAgent?: string | null;
    };

/**
 * The same notices, delivered so that a failure reaches the caller. The durable outbox uses this
 * to retry; everything else uses {@link SecurityNoticePublisher}, which never throws.
 */
export type SecurityNoticeDelivery = {
  deliver(event: SecurityNoticeEvent): Promise<void>;
};

export type SecurityNoticePublisher = {
  /** Never throws: a notice that cannot be sent must not undo or block the change it reports. */
  notify(event: SecurityNoticeEvent): Promise<void>;
};
