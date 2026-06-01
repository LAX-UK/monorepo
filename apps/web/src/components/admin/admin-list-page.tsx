import type { AdminListShellProps } from "@/components/admin/admin-list-shell";
import { AdminListShell } from "@/components/admin/admin-list-shell";

export type AdminListPageVariant = AdminListShellProps["variant"];
export type AdminListPageProps = AdminListShellProps;

/**
 * @deprecated Use `AdminListShell` directly. This alias remains for legacy imports during migration.
 */
export function AdminListPage({ mobileCards, ...props }: AdminListPageProps) {
  return (
    <AdminListShell
      {...props}
      {...(mobileCards ? { mobileCards } : {})}
      wrapView={Boolean(mobileCards)}
    />
  );
}
