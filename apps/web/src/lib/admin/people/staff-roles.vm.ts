import { formatStaffDate, londonToday, londonWallTimeToIso } from "@auction/staff-ui";
import {
  BID_STAFF_ROLE_RULES,
  LAX_ADMIN_ROLE_RULES,
  type LaxShopStaffRole,
  type LaxStaffAccessProduct,
  type StaffRoleAssignment,
  type StaffRoleRules,
  type UserStaffRole,
  laxStaffPlatform,
  staffRoleAssignmentEndsWithin,
  staffRoleRefusalMessage,
} from "@auction/types";

/** An end date this close counts as "ending soon": highlighted on chips, its own review view. */
export const STAFF_ROLE_ENDING_SOON_DAYS = 30;

const DAY_MS = 86_400_000;

/**
 * One admin's roles as the staff record shows and checks them: the role rules it applies (one
 * engine, its own table) and each role's name and job. Bid admin and LAX Admin each have one, so
 * the roles section, the add-role dialog and the access review are written once.
 */
export type StaffRoleProduct<R extends string> = {
  readonly product: LaxStaffAccessProduct;
  /** "Bid admin", "LAX Admin". */
  readonly toolLabel: string;
  readonly rules: StaffRoleRules<R>;
};

export const BID_ROLE_PRODUCT: StaffRoleProduct<UserStaffRole> = {
  product: "bid",
  toolLabel: "Bid admin",
  rules: BID_STAFF_ROLE_RULES,
};

export const LAX_ADMIN_ROLE_PRODUCT: StaffRoleProduct<LaxShopStaffRole> = {
  product: "shop",
  toolLabel: "LAX Admin",
  rules: LAX_ADMIN_ROLE_RULES,
};

/** A held role as the screens get it: its period, and whether LAX Admin has applied it yet. */
export type StaffRoleHeld<R extends string> = {
  readonly id: string;
  readonly role: R;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly grantedAt: string;
  readonly reason: string | null;
  readonly pending?: "assign" | "remove" | null | undefined;
};

/** "Saleroom clerk", "Catalogue editor": a role of `product` as people read it. */
export function staffRoleName<R extends string>(product: StaffRoleProduct<R>, role: R): string {
  return laxStaffPlatform(product.product).roles.find((r) => r.value === role)?.label ?? role;
}

function toAssignment<R extends string>(view: StaffRoleHeld<R>): StaffRoleAssignment<R> {
  return {
    role: view.role,
    startsAt: new Date(view.startsAt),
    endsAt: view.endsAt ? new Date(view.endsAt) : null,
  };
}

/** The roles as they will be once a waiting change is applied: what the rules check against. */
function asTheyWillBe<R extends string>(held: readonly StaffRoleHeld<R>[]) {
  return held.filter((view) => view.pending !== "remove").map(toAssignment);
}

/**
 * A role chosen to run "until 30 Nov" ends when 1 Dec starts in London, so it holds for the whole
 * of the last day. Returns that moment as ISO, or null for no end date.
 */
export function staffRoleEndsAtFromLastDay(lastDay: string | null): string | null {
  if (!lastDay) return null;
  const [y, m, d] = lastDay.split("-").map(Number);
  if (!y || !m || !d) return null;
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const day = next.toISOString().slice(0, 10);
  return londonWallTimeToIso(day, "00:00");
}

/** The last day a role is held: the day before the moment it ends. */
export function staffRoleLastDay(endsAt: string): string {
  return formatStaffDate(new Date(new Date(endsAt).getTime() - 1));
}

export type StaffRoleChipView<R extends string = UserStaffRole> = {
  id: string;
  role: R;
  label: string;
  /** "Since 3 Oct 2026 · Until 30 Nov 2026", or what LAX Admin has still to apply. */
  meta: string;
  /** Ends within {@link STAFF_ROLE_ENDING_SOON_DAYS} days, or waits for LAX Admin. */
  endingSoon: boolean;
  /** A change asked for that the admin has not applied yet; it cannot be changed again until then. */
  pending: "assign" | "remove" | null;
};

function untilText(endsAt: string, now: Date): string {
  const daysLeft = Math.ceil((new Date(endsAt).getTime() - now.getTime()) / DAY_MS);
  if (daysLeft <= 1) return "Ends today";
  return `Until ${staffRoleLastDay(endsAt)} · ${daysLeft} days left`;
}

/** A held role as a chip shows it: its name, since when, and until when. */
export function staffRoleChip<R extends string>(
  view: StaffRoleHeld<R>,
  now: Date,
  product: StaffRoleProduct<R>,
): StaffRoleChipView<R> {
  const label = staffRoleName(product, view.role);
  const pending = view.pending ?? null;
  if (pending) {
    return {
      id: view.id,
      role: view.role,
      label,
      meta:
        pending === "assign"
          ? `Waiting for ${product.toolLabel} to add it`
          : `Waiting for ${product.toolLabel} to remove it`,
      endingSoon: true,
      pending,
    };
  }
  const assignment = toAssignment(view);
  const started = assignment.startsAt.getTime() <= now.getTime();
  const from = `${started ? "Since" : "Starts"} ${formatStaffDate(view.startsAt)}`;
  const endingSoon = staffRoleAssignmentEndsWithin(assignment, now, STAFF_ROLE_ENDING_SOON_DAYS);
  const until = view.endsAt
    ? endingSoon
      ? untilText(view.endsAt, now)
      : `Until ${staffRoleLastDay(view.endsAt)}`
    : null;
  return {
    id: view.id,
    role: view.role,
    label,
    meta: until ? `${from} · ${until}` : from,
    endingSoon,
    pending: null,
  };
}

export type StaffRoleOption<R extends string = UserStaffRole> = {
  value: R;
  label: string;
  description: string;
};

/** The roles that can still be given, each with its one-line job description. */
export function addableStaffRoleOptions<R extends string>(
  held: readonly StaffRoleHeld<R>[],
  product: StaffRoleProduct<R>,
): StaffRoleOption<R>[] {
  const taken = new Set(
    held.filter((assignment) => assignment.pending !== "remove").map((a) => a.role as string),
  );
  return laxStaffPlatform(product.product)
    .roles.filter((option) => !taken.has(option.value))
    .map((option) => ({
      value: option.value as R,
      label: option.label,
      description: option.summary,
    }));
}

/** Why a role cannot be given, and which field the reason belongs to. */
export type AddStaffRoleIssue = { field: "role" | "lastDay"; message: string };

/**
 * Why `role` cannot be given from now until `endsAt`, in the words the API would use, or null
 * when it can. Run as soon as the person chooses, so the reason shows before saving.
 */
export function addStaffRoleIssue<R extends string>(
  held: readonly StaffRoleHeld<R>[],
  role: R,
  endsAt: string | null,
  now: Date,
  product: StaffRoleProduct<R>,
): AddStaffRoleIssue | null {
  const result = product.rules.check(
    asTheyWillBe(held),
    { kind: "assign", role, startsAt: now, endsAt: endsAt ? new Date(endsAt) : null },
    now,
    { otherActiveAdministrators: 0 },
  );
  if (result.ok) return null;
  return {
    field: result.reason === "invalid_period" ? "lastDay" : "role",
    message: staffRoleRefusalMessage({
      product: product.product,
      reason: result.reason,
      role,
      conflictingRole: result.conflictingRole,
    }),
  };
}

/** Why a held role cannot be removed (the last administrator), or null when it can. */
export function removeStaffRoleBlock<R extends string>(
  held: readonly StaffRoleHeld<R>[],
  role: R,
  otherActiveAdministrators: number,
  now: Date,
  product: StaffRoleProduct<R>,
): string | null {
  const view = held.find((h) => h.role === role);
  if (view?.pending)
    return `${product.toolLabel} has not applied the last change to this role yet.`;
  const result = product.rules.check(asTheyWillBe(held), { kind: "remove", role }, now, {
    otherActiveAdministrators,
  });
  if (result.ok) return null;
  return result.reason === "last_administrator"
    ? "The only administrator can't lose the role. Give someone else the administrator role first."
    : staffRoleRefusalMessage({ product: product.product, reason: result.reason, role });
}

/** Today in London, the earliest last day a new role can have. */
export function earliestStaffRoleLastDay(now: Date): string {
  return londonToday(now);
}
