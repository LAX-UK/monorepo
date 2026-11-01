import { staffRoleLabel } from "@/lib/presenters/platform-role/platform-role-registry";
import type { UserStaffRole } from "@auction/types";
import { userStaffRoles } from "@auction/types";
import type { ConsignmentAssignableStaff } from "@auction/validators";

export type AssignOption = {
  userId: string;
  name: string;
  /** "Clara Mendes (you)". */
  label: string;
  /** "Specialist · 9 open". */
  description: string;
  current: boolean;
};

function roleLabel(role: string | null): string | null {
  return role && (userStaffRoles as readonly string[]).includes(role)
    ? staffRoleLabel(role as UserStaffRole)
    : null;
}

/**
 * The colleagues an Assign menu offers: the viewer first, then by name; each with their role and
 * how many open threads they have, and the current owner ticked.
 */
export function assignableStaffItems(
  staff: readonly ConsignmentAssignableStaff[],
  input: { viewerUserId: string; assigneeUserId: string | null; exclude: string | null },
): AssignOption[] {
  return staff
    .filter((person) => person.userId !== input.exclude)
    .sort((a, b) => {
      if (a.userId === input.viewerUserId) return -1;
      if (b.userId === input.viewerUserId) return 1;
      return a.name.localeCompare(b.name, "en-GB");
    })
    .map((person) => {
      const role = roleLabel(person.staffRole);
      const open = `${person.openCount} open`;
      return {
        userId: person.userId,
        name: person.name,
        label: person.userId === input.viewerUserId ? `${person.name} (you)` : person.name,
        description: role ? `${role} · ${open}` : open,
        current: person.userId === input.assigneeUserId,
      };
    });
}
