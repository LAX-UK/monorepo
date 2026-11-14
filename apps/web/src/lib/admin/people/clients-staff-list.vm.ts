import { buildListHref } from "@/lib/admin/admin-list-params";
import { defineListSort } from "@/lib/admin/define-list-sort";
import { staffIdentityStatus } from "@/lib/admin/staff-kit-status";
import type { AdminUserRow } from "@/lib/data/http/admin-users.types";
import {
  type StatusPresentation,
  type TeamView,
  formatStaffNumber,
  viewQuery,
} from "@auction/staff-ui";
import type { UserRole, UserStaffRole } from "@auction/types";
import { CLIENTS_LIST_PATH } from "./build-clients-list-page-model";
import { peopleRecordHref } from "./people-record-href";

export type ClientsListSearch = Record<string, string | string[] | undefined>;

/** One client as the staff list shows them; plain data for the client component. */
export type ClientsStaffRow = {
  id: string;
  name: string;
  email: string;
  account: StatusPresentation;
  identity: StatusPresentation;
  emailVerified: boolean;
  twoFactor: boolean;
  persona: string;
  mobile: string | null;
  joinedAt: string;
  identityVerifiedAt: string | null;
  role: UserRole;
  staffRole: UserStaffRole | null;
  suspended: boolean;
  /** The client's page, remembering this list (`?list=`). */
  href: string;
};

const PERSONA_LABELS: Record<string, string> = {
  individual: "Individual",
  organisation: "Organisation",
};

/** Account standing, as a badge: deletion requests and suspensions say so. */
export function accountStanding(row: {
  deletionRequestedAt: string | null;
  suspendedAt: string | null;
}): StatusPresentation {
  if (row.deletionRequestedAt) return { label: "Deletion requested", tone: "warning" };
  if (row.suspendedAt) return { label: "Suspended", tone: "danger" };
  return { label: "Active", tone: "success" };
}

export function toClientsStaffRows(
  rows: readonly AdminUserRow[],
  listQuery: string,
): ClientsStaffRow[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name?.trim() || row.email,
    email: row.email,
    account: accountStanding(row),
    identity: staffIdentityStatus(row.kycStatus),
    emailVerified: row.emailVerified,
    twoFactor: row.twoFactorEnabled,
    persona: (row.signupPersona && PERSONA_LABELS[row.signupPersona]) || "Not set",
    mobile: row.mobile,
    joinedAt: row.createdAt,
    identityVerifiedAt: row.kycVerifiedAt,
    role: row.role === "staff" ? "staff" : "client",
    staffRole: (row.staffRole as UserStaffRole | null) ?? null,
    suspended: row.suspendedAt !== null,
    href: peopleRecordHref(CLIENTS_LIST_PATH, row.id, listQuery),
  }));
}

export function clientsListHref(
  current: ClientsListSearch,
  patch: Record<string, string | number | null | undefined>,
): string {
  return buildListHref(CLIENTS_LIST_PATH, current, { offset: 0, client: null, ...patch });
}

/**
 * Views of the clients list everyone sees, beyond the status tabs: combinations of the list's
 * own filters. Fixed here, never edited.
 */
export function clientsTeamViews(): TeamView[] {
  const view = (id: string, label: string, patch: Record<string, string>) => {
    const [path, rest = ""] = clientsListHref({}, patch).split("?");
    const query = viewQuery(rest);
    return { id: `team-${id}`, label, href: `${path}?${query}`, query };
  };
  return [
    view("identity-submitted", "Identity submitted", { kycStatus: "pending" }),
    view("email-not-verified", "Email not verified", { emailVerified: "0" }),
    view("deletion-requested", "Deletion requested", { deletionRequested: "1" }),
  ];
}

export const CLIENT_IDENTITY_FILTERS = [
  { value: "approved", label: "Verified" },
  { value: "pending", label: "Submitted" },
  { value: "rejected", label: "Rejected" },
  { value: "unverified", label: "Not verified" },
] as const;

export const CLIENT_EMAIL_FILTERS = [
  { value: "1", label: "Verified" },
  { value: "0", label: "Not verified" },
] as const;

export const CLIENT_PERSONA_FILTERS = [
  { value: "individual", label: "Individual" },
  { value: "organisation", label: "Organisation" },
  { value: "none", label: "Not set" },
] as const;

/** Newest sign-ups first, unless the person sorts by name or oldest first. */
export const clientsSort = defineListSort(
  {
    name: { asc: "name_asc", desc: "name_desc" },
    joined: { asc: "created_asc", desc: "created_desc" },
  },
  "created_desc",
);

export function clientsSortHref(
  current: ClientsListSearch,
  sort: { columnId: string; direction: "asc" | "desc" },
): string {
  return clientsListHref(current, { sort: clientsSort.param(sort) });
}

/** "1–50 of 312 clients". */
export function peopleRangeSummary(
  offset: number,
  countOnPage: number,
  total: number,
  noun: { one: string; other: string },
): string {
  const first = offset + 1;
  const last = offset + countOnPage;
  return `${first}–${last} of ${formatStaffNumber(total)} ${total === 1 ? noun.one : noun.other}`;
}
