import { STAFF_EMAIL_CHANGE_ACCESS } from "@/lib/navigation/staff-nav-access";
import {
  ADMINISTRATOR_STAFF_ROLE,
  NO_STAFF_ROLES,
  type StaffRoles,
  type UserRole,
  hasStaffRole,
  userHasAccessTo,
} from "@auction/types";
import {
  ADMIN_EMAIL_CHANGE_REASON_MIN,
  ADMIN_EMAIL_CHANGE_REFERENCE_MIN,
  type AdminStaffEmailChangeBody,
  adminStaffEmailChangeBodySchema,
} from "@auction/validators";

/** What the viewer may do about an email change, decided once when the page loads. */
export type EmailChangeAccess = {
  /** Holds the email-change rule. */
  canChange: boolean;
  /** Also an Administrator, who alone may move a staff account. */
  canChangeStaff: boolean;
  /** The viewer's own id: nobody changes their own address through the staff tools. */
  viewerId: string;
};

export const NO_EMAIL_CHANGE_ACCESS: EmailChangeAccess = {
  canChange: false,
  canChangeStaff: false,
  viewerId: "",
};

export function emailChangeAccessFor(
  viewer: { id: string; role: string; staffRoles?: StaffRoles | undefined } | null,
): EmailChangeAccess {
  if (!viewer) return NO_EMAIL_CHANGE_ACCESS;
  return {
    canChange: userHasAccessTo(
      viewer.role as UserRole,
      viewer.staffRoles,
      STAFF_EMAIL_CHANGE_ACCESS,
    ),
    canChangeStaff: hasStaffRole(viewer.staffRoles ?? NO_STAFF_ROLES, ADMINISTRATOR_STAFF_ROLE),
    viewerId: viewer.id,
  };
}

/** Why the action is unavailable for this person, or null when the viewer may go ahead. */
export function emailChangeBlockedReason(
  access: EmailChangeAccess,
  person: { id: string; role: string },
): string | null {
  if (person.id === access.viewerId) {
    return "Change your own address from LAX Account";
  }
  if (person.role === "staff" && !access.canChangeStaff) {
    return "Only an Administrator can change a staff member's email";
  }
  return null;
}

/** The verified KYC record is only worth offering for someone whose identity check was approved. */
export function kycMatchAvailable(kycStatus: string): boolean {
  return kycStatus === "approved";
}

export type EmailChangeProofKind = "kyc_match" | "id_check";

export type EmailChangeDraft = {
  newEmail: string;
  currentEmail: string;
  reason: string;
  proofKind: EmailChangeProofKind | null;
  /** The KYC session shown to staff; present once the record has loaded. */
  kycSessionId: string | null;
  /** Staff ticked that the caller's name and date of birth match the record. */
  kycConfirmed: boolean;
  reference: string;
};

export type EmailChangeField = "newEmail" | "proof" | "reference" | "kycConfirmed" | "reason";
export type EmailChangeErrors = Partial<Record<EmailChangeField, string>>;

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmailChange(draft: EmailChangeDraft): EmailChangeErrors {
  const errors: EmailChangeErrors = {};
  const email = draft.newEmail.trim().toLowerCase();
  if (!email) errors.newEmail = "Enter the new email address";
  else if (!EMAIL_SHAPE.test(email)) errors.newEmail = "Enter a valid email address";
  else if (email === draft.currentEmail.trim().toLowerCase()) {
    errors.newEmail = "That is already this account's address";
  }

  if (draft.proofKind === null) {
    errors.proof = "Choose how you checked who is asking";
  } else if (draft.proofKind === "id_check") {
    if (draft.reference.trim().length < ADMIN_EMAIL_CHANGE_REFERENCE_MIN) {
      errors.reference = "Enter the reference of the ID check";
    }
  } else if (draft.kycSessionId === null) {
    errors.proof = "There is no verified KYC record to match. Use a fresh ID check instead";
  } else if (!draft.kycConfirmed) {
    errors.kycConfirmed = "Confirm the name and date of birth match before continuing";
  }

  const reason = draft.reason.trim();
  if (reason.length < ADMIN_EMAIL_CHANGE_REASON_MIN) {
    errors.reason = `Give a reason of at least ${ADMIN_EMAIL_CHANGE_REASON_MIN} characters`;
  }
  return errors;
}

/** The request body for a draft that passed validation; null if it would not parse. */
export function toEmailChangeBody(draft: EmailChangeDraft): AdminStaffEmailChangeBody | null {
  const parsed = adminStaffEmailChangeBodySchema.safeParse({
    newEmail: draft.newEmail,
    reason: draft.reason,
    proof:
      draft.proofKind === "kyc_match"
        ? { kind: "kyc_match", kycSessionId: draft.kycSessionId ?? "" }
        : { kind: "id_check", reference: draft.reference },
  });
  return parsed.success ? parsed.data : null;
}
