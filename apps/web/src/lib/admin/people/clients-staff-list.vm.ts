import { buildListHref } from "@/lib/admin/admin-list-params";
import { toStaffStatus } from "@/lib/admin/staff-kit-status";
import type { AdminUserRow } from "@/lib/data/http/admin-users.types";
import { kycStatusLabel, kycStatusToBadgeVariant } from "@/lib/presenters/status-presentation";
import type { StatusPresentation } from "@auction/staff-ui";
import { CLIENTS_LIST_PATH } from "./build-clients-list-page-model";

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
  joinedAt: string;
  href: string;
};

const PERSONA_LABELS: Record<string, string> = {
  individual: "Individual",
  organisation: "Organisation",
};

export function toClientsStaffRows(
  rows: readonly AdminUserRow[],
  returnTo: string,
): ClientsStaffRow[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name?.trim() || row.email,
    email: row.email,
    account: row.deletionRequestedAt
      ? { label: "Deletion requested", tone: "warning" }
      : row.suspendedAt
        ? { label: "Suspended", tone: "danger" }
        : { label: "Active", tone: "success" },
    identity: toStaffStatus(kycStatusToBadgeVariant(row.kycStatus), kycStatusLabel(row.kycStatus)),
    emailVerified: row.emailVerified,
    twoFactor: row.twoFactorEnabled,
    persona: (row.signupPersona && PERSONA_LABELS[row.signupPersona]) || "Not set",
    joinedAt: row.createdAt,
    href: `${CLIENTS_LIST_PATH}/${row.id}?returnTo=${encodeURIComponent(returnTo)}`,
  }));
}

export function clientsListHref(
  current: ClientsListSearch,
  patch: Record<string, string | number | null | undefined>,
): string {
  return buildListHref(CLIENTS_LIST_PATH, current, { offset: 0, client: null, ...patch });
}

export const CLIENT_IDENTITY_FILTERS = [
  { value: "approved", label: "Verified" },
  { value: "pending", label: "Submitted" },
  { value: "rejected", label: "Rejected" },
] as const;

/** Name and joined columns sort on the server; a third click clears the sort. */
export function clientsSortHref(
  current: ClientsListSearch,
  sort: { columnId: string; direction: "asc" | "desc" } | null,
): string {
  if (!sort) return clientsListHref(current, { sort: null });
  if (sort.columnId === "name") {
    return clientsListHref(current, { sort: sort.direction === "asc" ? "name_asc" : "name_desc" });
  }
  if (sort.columnId === "joined") {
    return clientsListHref(current, {
      sort: sort.direction === "asc" ? "created_asc" : "created_desc",
    });
  }
  return clientsListHref(current, { sort: null });
}

export function clientsSortState(sort: string | undefined) {
  switch (sort) {
    case "name_asc":
      return { columnId: "name", direction: "asc" as const };
    case "name_desc":
      return { columnId: "name", direction: "desc" as const };
    case "created_asc":
      return { columnId: "joined", direction: "asc" as const };
    case "created_desc":
      return { columnId: "joined", direction: "desc" as const };
    default:
      return null;
  }
}
