import type { SessionUser } from "@/lib/data/contracts";
import type { AppShellLayout, UserRole } from "@auction/types";
import { staffRoleToShellLayout } from "@auction/types";

/** Visual shell segment for the dashboard chrome. */
export type AppShellRole = AppShellLayout;

/** Maps session user to shell layout (client vs platform admin vs finance). */
export function sessionUserToShellRole(
  user: Pick<SessionUser, "role" | "staffRole">,
): AppShellRole {
  return staffRoleToShellLayout(user.role as UserRole, user.staffRole ?? null);
}
