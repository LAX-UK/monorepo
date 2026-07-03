export type EmailChangeConfirmPayload = {
  userId: string;
  oldEmail: string;
  newEmail: string;
  confirmFor: "old" | "new";
};

export type EmailChangeConfirmFailureKind =
  | "user_not_found"
  | "stale_flow"
  | "expired"
  | "email_taken";

export class EmailChangeConfirmError extends Error {
  readonly kind: EmailChangeConfirmFailureKind;

  constructor(kind: EmailChangeConfirmFailureKind) {
    super(kind);
    this.name = "EmailChangeConfirmError";
    this.kind = kind;
  }
}
