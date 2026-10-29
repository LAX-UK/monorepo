import { buildListHref } from "@/lib/admin/admin-list-params";
import { defineListSort } from "@/lib/admin/define-list-sort";
import {
  BID_ROLE_PRODUCT,
  LAX_ADMIN_ROLE_PRODUCT,
  STAFF_ROLE_ENDING_SOON_DAYS,
  type StaffRoleChipView,
  staffRoleChip,
  staffRoleLastDay,
  staffRoleName,
} from "@/lib/admin/people/staff-roles.vm";
import type { StaffAccessReviewRow } from "@/lib/data/http/staff-roles.server";
import { formatStaffDate } from "@auction/staff-ui";
import {
  type LaxStaffAccessProduct,
  isLaxAdminRole,
  normalizeUserStaffRole,
  staffRoleAssignmentEndsWithin,
} from "@auction/types";

export const STAFF_ACCESS_REVIEW_PATH = "/admin/staff/access";

export type AccessReviewSearch = Record<string, string | string[] | undefined>;

export type AccessReviewView = "all" | "ending";

/** Which admin's roles the review shows; null shows both. */
export type AccessReviewProduct = LaxStaffAccessProduct | null;

export type AccessReviewFilters = {
  view: AccessReviewView;
  product: AccessReviewProduct;
  /** One role of the chosen admin (Bid admin when no admin is chosen). */
  role: string | null;
  q: string;
};

/** The admins the review can narrow to, as the filter and its chip name them. */
export const ACCESS_REVIEW_PRODUCTS = [
  { value: "bid", label: "Bid admin" },
  { value: "shop", label: "LAX Admin" },
] as const satisfies readonly { value: LaxStaffAccessProduct; label: string }[];

export function accessReviewProductLabel(product: LaxStaffAccessProduct): string {
  return ACCESS_REVIEW_PRODUCTS.find((p) => p.value === product)?.label ?? product;
}

const first = (value: string | string[] | undefined) =>
  (typeof value === "string" ? value : value?.[0])?.trim() ?? "";

function parseProduct(value: string): AccessReviewProduct {
  return value === "bid" || value === "shop" ? value : null;
}

/** The review's filters from the URL: the view, one admin, one of its roles, and a search. */
export function parseAccessReviewFilters(search: AccessReviewSearch): AccessReviewFilters {
  const product = parseProduct(first(search.product));
  const rawRole = first(search.role);
  const role =
    product === "shop"
      ? isLaxAdminRole(rawRole)
        ? rawRole
        : null
      : (normalizeUserStaffRole(rawRole) ?? null);
  return {
    view: first(search.view) === "ending" ? "ending" : "all",
    product,
    role,
    q: first(search.q),
  };
}

/** The label of the role filter, in the chosen admin's words. */
export function accessReviewRoleLabel(filters: Pick<AccessReviewFilters, "product" | "role">) {
  if (!filters.role) return null;
  return filters.product === "shop"
    ? staffRoleName(LAX_ADMIN_ROLE_PRODUCT, filters.role)
    : staffRoleName(BID_ROLE_PRODUCT, filters.role);
}

type HeldRole =
  | StaffAccessReviewRow["roles"][number]
  | StaffAccessReviewRow["laxAdminRoles"][number];

/** The roles of `row` the filters look at: the chosen admin's, or both. */
function rolesInScope(row: StaffAccessReviewRow, product: AccessReviewProduct): HeldRole[] {
  if (product === "bid") return row.roles;
  if (product === "shop") return row.laxAdminRoles;
  return [...row.roles, ...row.laxAdminRoles];
}

export function accessReviewHref(
  search: AccessReviewSearch,
  patch: Record<string, string | null | undefined>,
): string {
  return buildListHref(STAFF_ACCESS_REVIEW_PATH, search, patch);
}

function endsSoon(row: StaffAccessReviewRow, product: AccessReviewProduct, now: Date): boolean {
  return rolesInScope(row, product).some(
    (role) =>
      role.endsAt !== null &&
      staffRoleAssignmentEndsWithin(
        { endsAt: new Date(role.endsAt) },
        now,
        STAFF_ROLE_ENDING_SOON_DAYS,
      ),
  );
}

function matchesSearch(row: StaffAccessReviewRow, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    row.email.toLowerCase().includes(needle) || (row.name ?? "").toLowerCase().includes(needle)
  );
}

function holdsRole(row: StaffAccessReviewRow, filters: AccessReviewFilters): boolean {
  if (filters.role === null) return true;
  const roles = filters.product === "shop" ? row.laxAdminRoles : row.roles;
  return roles.some((held) => held.role === filters.role);
}

/**
 * People with roles on the chosen admin who hold `role` (in force or starting later), match the
 * search, and fit the view.
 */
export function filterAccessReview(
  rows: readonly StaffAccessReviewRow[],
  filters: AccessReviewFilters,
  now: Date,
): StaffAccessReviewRow[] {
  return rows.filter(
    (row) =>
      (filters.product === null || rolesInScope(row, filters.product).length > 0) &&
      holdsRole(row, filters) &&
      matchesSearch(row, filters.q) &&
      (filters.view === "all" || endsSoon(row, filters.product, now)),
  );
}

/** How many people each view holds under the role filter and search. */
export function accessReviewCounts(
  rows: readonly StaffAccessReviewRow[],
  filters: AccessReviewFilters,
  now: Date,
): Record<AccessReviewView, number> {
  return {
    all: filterAccessReview(rows, { ...filters, view: "all" }, now).length,
    ending: filterAccessReview(rows, { ...filters, view: "ending" }, now).length,
  };
}

/** One admin's roles of a person, as the review lists them. */
export type AccessReviewRoleGroup = {
  product: LaxStaffAccessProduct;
  /** "Bid admin", "LAX Admin". */
  label: string;
  roles: StaffRoleChipView<string>[];
};

/** One staff member as the review shows them. */
export type AccessReviewRowView = {
  id: string;
  name: string;
  email: string;
  suspended: boolean;
  /** Each admin they hold roles on, in the filter's scope. */
  roleGroups: AccessReviewRoleGroup[];
  /** The soonest end among their roles, ISO; null when none ends. */
  nextEnd: string | null;
  lastSignInAt: string | null;
  /** Their staff record, for viewers who may open it. */
  href: string | null;
};

export function toAccessReviewRows(
  rows: readonly StaffAccessReviewRow[],
  now: Date,
  recordHref: ((userId: string) => string) | null,
  product: AccessReviewProduct = null,
): AccessReviewRowView[] {
  return rows.map((row) => {
    const ends = rolesInScope(row, product)
      .flatMap((role) => (role.endsAt ? [role.endsAt] : []))
      .sort();
    const groups: AccessReviewRoleGroup[] = [
      {
        product: "bid",
        label: accessReviewProductLabel("bid"),
        roles: row.roles.map((role) => staffRoleChip(role, now, BID_ROLE_PRODUCT)),
      },
      {
        product: "shop",
        label: accessReviewProductLabel("shop"),
        roles: row.laxAdminRoles.map((role) => staffRoleChip(role, now, LAX_ADMIN_ROLE_PRODUCT)),
      },
    ];
    return {
      id: row.userId,
      name: row.name?.trim() || row.email,
      email: row.email,
      suspended: row.suspended,
      roleGroups: groups.filter(
        (group) => group.roles.length > 0 && (product === null || group.product === product),
      ),
      nextEnd: ends[0] ?? null,
      lastSignInAt: row.lastSignInAt,
      href: recordHref ? recordHref(row.userId) : null,
    };
  });
}

/** Name A to Z by default; also by last sign-in, and by the soonest end date. */
export const accessReviewSort = defineListSort(
  {
    name: { asc: "name_asc", desc: "name_desc" },
    nextEnd: { asc: "ends_asc", desc: "ends_desc" },
    lastSignIn: { asc: "signin_asc", desc: "signin_desc" },
  },
  "name_asc",
);

const SORT_VALUE: Record<string, (row: AccessReviewRowView) => string> = {
  name: (row) => row.name.toLowerCase(),
  // Rows without an end or a sign-in sort after every dated row, whichever the direction.
  nextEnd: (row) => row.nextEnd ?? "",
  lastSignIn: (row) => row.lastSignInAt ?? "",
};

export function sortAccessReview(
  rows: readonly AccessReviewRowView[],
  sortKey: string | null | undefined,
): AccessReviewRowView[] {
  const { columnId, direction } = accessReviewSort.state(sortKey);
  const value = SORT_VALUE[columnId] ?? SORT_VALUE.name;
  const dir = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = value?.(a) ?? "";
    const bv = value?.(b) ?? "";
    if (av === bv) return a.name.localeCompare(b.name);
    if (av === "") return 1;
    if (bv === "") return -1;
    return av < bv ? -dir : dir;
  });
}

/** One CSV row per role held on each admin, so a reviewer can sort and filter the file by role. */
export function accessReviewCsvRows(
  rows: readonly StaffAccessReviewRow[],
  product: AccessReviewProduct = null,
) {
  return rows.flatMap((row) => {
    const base = {
      name: row.name?.trim() || row.email,
      email: row.email,
      account: row.suspended ? "Suspended" : "Active",
      lastSignIn: row.lastSignInAt ? new Date(row.lastSignInAt).toISOString() : "",
    };
    const held = [
      ...(product === "shop"
        ? []
        : row.roles.map((role) => ({
            admin: accessReviewProductLabel("bid"),
            role: staffRoleName(BID_ROLE_PRODUCT, role.role),
            startsAt: role.startsAt,
            endsAt: role.endsAt,
          }))),
      ...(product === "bid"
        ? []
        : row.laxAdminRoles.map((role) => ({
            admin: accessReviewProductLabel("shop"),
            role: staffRoleName(LAX_ADMIN_ROLE_PRODUCT, role.role),
            startsAt: role.startsAt,
            endsAt: role.endsAt,
          }))),
    ];
    if (held.length === 0) return [{ ...base, admin: "", role: "", since: "", lastDay: "" }];
    return held.map((role) => ({
      ...base,
      admin: role.admin,
      role: role.role,
      since: formatStaffDate(role.startsAt),
      lastDay: role.endsAt ? staffRoleLastDay(role.endsAt) : "",
    }));
  });
}

export const ACCESS_REVIEW_CSV_COLUMNS = [
  { key: "name", header: "Name" },
  { key: "email", header: "Email" },
  { key: "account", header: "Account" },
  { key: "admin", header: "Admin" },
  { key: "role", header: "Role" },
  { key: "since", header: "Since" },
  { key: "lastDay", header: "Last day" },
  { key: "lastSignIn", header: "Last sign-in" },
] as const;
