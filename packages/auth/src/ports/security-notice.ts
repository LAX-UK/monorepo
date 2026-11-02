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
  | { kind: "phone_verified"; userId: string; at: Date; phone: string; userAgent?: string | null }
  | {
      kind: "email_changed";
      userId: string;
      at: Date;
      previousEmail: string;
      newEmail: string;
      userAgent?: string | null;
    };

export type SecurityNoticePublisher = {
  /** Never throws: a notice that cannot be sent must not undo or block the change it reports. */
  notify(event: SecurityNoticeEvent): Promise<void>;
};
