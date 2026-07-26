import type { SessionUser } from "@/lib/data/contracts";
import {
  staffRoleFilterOptions,
  staffRoleLabel,
} from "@/lib/presenters/platform-role/platform-role-registry";
import { sessionUserToShellRole } from "@/lib/shell/session-user-shell-role";

export { staffRoleFilterOptions, staffRoleLabel };

/** Role label for shell identity chrome (sidebar pill, account menu). */
export function shellRolePillLabel(user: Pick<SessionUser, "role" | "staffRole">): string {
  const shell = sessionUserToShellRole(user);
  if (shell === "client") return "Client";
  if (user.role === "staff" && user.staffRole) {
    return staffRoleLabel(user.staffRole);
  }
  return "Staff";
}
