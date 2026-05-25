import type { SessionUser } from "@/lib/data/contracts";
import { type UserStaffRole, normalizeUserRoleOrClient } from "@auction/types";

/** Shape returned by Better Auth `useSession().data.user`. */
export type AuthUserLike = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role?: string | null;
  staffRole?: string | null;
  suspended?: boolean | null;
  twoFactorEnabled?: boolean | null;
  emailVerified?: boolean | null;
};

/** Map Better Auth session user to the app's `SessionUser` contract. */
export function mapAuthSessionUser(user: AuthUserLike): SessionUser {
  const out: SessionUser = {
    id: user.id,
    email: user.email,
    name: user.name?.trim() || user.email,
    role: normalizeUserRoleOrClient(user.role),
    image: user.image ?? null,
  };
  if (typeof user.staffRole === "string" && user.staffRole.length > 0) {
    out.staffRole = user.staffRole as UserStaffRole;
  }
  if (typeof user.suspended === "boolean") out.suspended = user.suspended;
  if (typeof user.twoFactorEnabled === "boolean") out.twoFactorEnabled = user.twoFactorEnabled;
  if (typeof user.emailVerified === "boolean") out.emailVerified = user.emailVerified;
  return out;
}
