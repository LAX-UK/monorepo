/** Human-readable labels for admin user detail fields. */

export { formatSignupPersona } from "./format-signup-persona";

export function formatEmailDeliverabilityStatus(status: string | null | undefined): string {
  switch (status) {
    case "ok":
      return "Delivering normally";
    case "bounced":
      return "Bounced";
    case "complained":
      return "Marked as spam";
    default:
      return status ? status.replaceAll("_", " ") : "Unknown";
  }
}

export function formatUserRole(role: string): string {
  switch (role) {
    case "staff":
      return "Staff";
    case "client":
      return "Client";
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
}

export function formatAmlCheckType(checkType: string | null | undefined): string {
  if (!checkType) return "—";
  switch (checkType) {
    case "initial":
    case "initial_result":
      return "Initial screening";
    case "ongoing":
    case "ongoing_monitoring":
      return "Ongoing monitoring";
    default:
      return checkType.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

/** Lowercase phrase for inline sentences, e.g. "KYC rejected — follow up". */
export function kycStatusPhrase(status: string): string {
  switch (status) {
    case "approved":
      return "verified";
    case "pending":
    case "submitted":
      return "submitted";
    case "under_review":
      return "in review";
    case "rejected":
      return "rejected";
    case "expired":
      return "expired";
    default:
      return status.replaceAll("_", " ");
  }
}
