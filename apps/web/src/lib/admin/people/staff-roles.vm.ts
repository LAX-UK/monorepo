import type { StaffRoleAssignmentView } from "@/lib/data/http/staff-roles.server";
import { formatStaffDate, londonToday, londonWallTimeToIso } from "@auction/staff-ui";
import {
  type StaffRoleAssignment,
  type UserStaffRole,
  checkStaffRoleAssignment,
  laxStaffPlatform,
  staffRoleAssignmentEndsWithin,
  staffRoleRefusalMessage,
} from "@auction/types";

/** An end date this close counts as "ending soon": highlighted on chips, its own review view. */
export const STAFF_ROLE_ENDING_SOON_DAYS = 30;

const DAY_MS = 86_400_000;

function toAssignment(view: StaffRoleAssignmentView): StaffRoleAssignment {
  return {
    role: view.role,
    startsAt: new Date(view.startsAt),
    endsAt: view.endsAt ? new Date(view.endsAt) : null,
  };
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

export type StaffRoleChipView = {
  id: string;
  role: UserStaffRole;
  label: string;
  /** "Since 3 Oct 2026 · Until 30 Nov 2026". */
  meta: string;
  /** Ends within {@link STAFF_ROLE_ENDING_SOON_DAYS} days. */
  endingSoon: boolean;
};

function untilText(endsAt: string, now: Date): string {
  const daysLeft = Math.ceil((new Date(endsAt).getTime() - now.getTime()) / DAY_MS);
  if (daysLeft <= 1) return "Ends today";
  return `Until ${staffRoleLastDay(endsAt)} · ${daysLeft} days left`;
}

/** A held role as a chip shows it: its name, since when, and until when. */
export function staffRoleChip(view: StaffRoleAssignmentView, now: Date): StaffRoleChipView {
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
    label: laxStaffPlatform("bid").roles.find((r) => r.value === view.role)?.label ?? view.role,
    meta: until ? `${from} · ${until}` : from,
    endingSoon,
  };
}

export type StaffRoleOption = { value: UserStaffRole; label: string; description: string };

/** The roles that can still be given, each with its one-line job description. */
export function addableStaffRoleOptions(
  held: readonly StaffRoleAssignmentView[],
): StaffRoleOption[] {
  const taken = new Set(held.map((assignment) => assignment.role));
  return laxStaffPlatform("bid")
    .roles.filter((option) => !taken.has(option.value as UserStaffRole))
    .map((option) => ({
      value: option.value as UserStaffRole,
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
export function addStaffRoleIssue(
  held: readonly StaffRoleAssignmentView[],
  role: UserStaffRole,
  endsAt: string | null,
  now: Date,
): AddStaffRoleIssue | null {
  const result = checkStaffRoleAssignment(
    held.map(toAssignment),
    { kind: "assign", role, startsAt: now, endsAt: endsAt ? new Date(endsAt) : null },
    now,
    { otherActiveAdministrators: 0 },
  );
  if (result.ok) return null;
  return {
    field: result.reason === "invalid_period" ? "lastDay" : "role",
    message: staffRoleRefusalMessage({
      reason: result.reason,
      role,
      conflictingRole: result.conflictingRole,
    }),
  };
}

/** Why a held role cannot be removed (the last administrator), or null when it can. */
export function removeStaffRoleBlock(
  held: readonly StaffRoleAssignmentView[],
  role: UserStaffRole,
  otherActiveAdministrators: number,
  now: Date,
): string | null {
  const result = checkStaffRoleAssignment(held.map(toAssignment), { kind: "remove", role }, now, {
    otherActiveAdministrators,
  });
  if (result.ok) return null;
  return result.reason === "last_administrator"
    ? "The only administrator can't lose the role. Give someone else the administrator role first."
    : staffRoleRefusalMessage({ reason: result.reason, role });
}

/** Today in London, the earliest last day a new role can have. */
export function earliestStaffRoleLastDay(now: Date): string {
  return londonToday(now);
}
