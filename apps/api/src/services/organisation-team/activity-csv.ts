import type { ActivityKind } from "@auction/domain";
import { formatCsvDocument } from "@auction/exports";
import type { LegalEntityMemberRole } from "@auction/types";
import type { ActivityEntryView } from "../interfaces/organisation-team-service.js";

/** What happened, in the words a gallery's owner would use (British English, sentence case). */
const KIND_LABEL: Record<ActivityKind, string> = {
  member_invited: "Member invited",
  invitation_withdrawn: "Invitation withdrawn",
  invitation_declined: "Invitation declined",
  member_joined: "Member joined",
  role_changed: "Role changed",
  member_removed: "Member removed",
  member_left: "Member left",
  authorisation_granted: "Authorised to bid",
  authorisation_revoked: "Authorisation to bid ended",
  bidding_limit_changed: "Organisation bidding limit changed",
  agreement_accepted: "Consignment agreement accepted",
  unsold_choice_made: "Choice made for an unsold lot",
  payout_sent: "Payout sent",
  bank_details_changed: "Payout bank account changed",
  invoice_details_changed: "Invoice details changed",
  two_step_policy_changed: "Two-step verification rule changed",
};

const ROLE_LABEL: Record<LegalEntityMemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  consignor: "Consignor",
  finance: "Finance",
  buyer_agent: "Buyer agent",
  viewer: "Viewer",
};

const FIELD_LABEL: Record<string, string> = {
  billing_email: "billing email",
  address: "invoice address",
  po_reference: "PO reference",
};

const UNSOLD_CHOICE_LABEL: Record<string, string> = {
  relist: "Relist",
  private_sale: "Offer by private sale",
  collect: "Collect the work",
};

const role = (value: unknown) =>
  typeof value === "string" && value in ROLE_LABEL
    ? ROLE_LABEL[value as LegalEntityMemberRole]
    : null;

const pounds = (value: unknown) =>
  typeof value === "string" || typeof value === "number"
    ? `£${Number(value).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`
    : null;

/** The one line of detail each kind shows, or nothing. */
function detailText(entry: ActivityEntryView): string {
  const d = entry.detail;
  switch (entry.kind) {
    case "member_invited":
      return [d.email, role(d.role)].filter(Boolean).join(" as ");
    case "member_joined":
    case "invitation_withdrawn":
      return role(d.role) ?? "";
    case "role_changed":
      return [role(d.from_role), role(d.to_role)].filter(Boolean).join(" to ");
    case "member_removed":
      return role(d.role_at_removal) ?? "";
    case "member_left":
      return role(d.role_at_leaving) ?? "";
    case "authorisation_granted":
      return d.bid_limit ? `Up to ${pounds(d.bid_limit)} a lot` : "No limit a lot";
    case "bidding_limit_changed":
      return d.limit ? `Limit ${pounds(d.limit)}` : "Limit removed";
    case "unsold_choice_made":
      return UNSOLD_CHOICE_LABEL[String(d.choice)] ?? "";
    case "payout_sent":
      return pounds(d.netAmount) ?? "";
    case "bank_details_changed":
      return typeof d.bank_last4 === "string" ? `Account ending ${d.bank_last4}` : "";
    case "invoice_details_changed":
      return Array.isArray(d.changed_fields)
        ? d.changed_fields.map((field) => FIELD_LABEL[field] ?? field).join(", ")
        : "";
    case "two_step_policy_changed":
      return d.required ? "Required for every member" : "Each member chooses";
    default:
      return "";
  }
}

const COLUMNS = [
  { key: "date", header: "Date (UTC)" },
  { key: "who", header: "Who" },
  { key: "what", header: "What" },
  { key: "about", header: "About" },
  { key: "details", header: "Details" },
];

/** Activity as CSV: UTF-8 with a byte-order mark, so Excel opens it with the right characters. */
export function activityCsv(entries: readonly ActivityEntryView[]): string {
  const rows = entries.map((entry) => ({
    date: entry.occurredAt.toISOString().replace("T", " ").slice(0, 16),
    who: entry.actorName,
    what: KIND_LABEL[entry.kind],
    about: entry.subjectName ?? "",
    details: detailText(entry),
  }));
  return `﻿${formatCsvDocument(COLUMNS, rows)}\n`;
}
