/** Legacy `/admin/users` list redirect target from `role` query param. */
export function adminUsersListRedirectTarget(
  role: string | undefined,
): "/admin/staff" | "/admin/clients" {
  return role === "staff" ? "/admin/staff" : "/admin/clients";
}

export function buildAdminUsersLegacyListRedirect(
  searchParams: Record<string, string | undefined>,
): string {
  const { role, ...rest } = searchParams;
  const target = adminUsersListRedirectTarget(role);
  const qs = new URLSearchParams(
    Object.entries(rest).filter((entry): entry is [string, string] => entry[1] != null),
  ).toString();
  return qs ? `${target}?${qs}` : target;
}

/** Detail page path for a user by audience. */
export function adminUserDetailPath(
  role: "staff" | "client" | string,
  userId: string,
): `/admin/staff/${string}` | `/admin/clients/${string}` {
  return role === "staff" ? `/admin/staff/${userId}` : `/admin/clients/${userId}`;
}

/** Revalidate split list routes and legacy `/admin/users` redirect. */
export function revalidateAdminUserListPaths(revalidatePath: (path: string) => void): void {
  revalidatePath("/admin/clients");
  revalidatePath("/admin/staff");
  revalidatePath("/admin/users");
}

/** Revalidate list + all detail route shapes for a user id. */
export function revalidateAdminUserDetailPaths(
  revalidatePath: (path: string) => void,
  userId: string,
): void {
  revalidateAdminUserListPaths(revalidatePath);
  revalidatePath(`/admin/clients/${userId}`);
  revalidatePath(`/admin/staff/${userId}`);
  revalidatePath(`/admin/users/${userId}`);
}
