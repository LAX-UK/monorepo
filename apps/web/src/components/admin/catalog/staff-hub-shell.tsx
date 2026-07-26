import type { AdminListShellProps } from "@/components/admin/admin-list-shell";
import { AdminListShell } from "@/components/admin/admin-list-shell";
import { cn } from "@auction/ui";

type Props = Omit<AdminListShellProps, "layout">;

/**
 * Staff hub layout — finance home, onboarding, saleroom, events, and integrations.
 * Uses flat KPI band spacing aligned with catalog lists.
 */
export function StaffHubShell({ kpiStrip, className, ...rest }: Props) {
  return (
    <AdminListShell
      layout="hub"
      className={cn("pb-10", className)}
      kpiStrip={kpiStrip ? <div className="space-y-6">{kpiStrip}</div> : undefined}
      {...rest}
    />
  );
}
