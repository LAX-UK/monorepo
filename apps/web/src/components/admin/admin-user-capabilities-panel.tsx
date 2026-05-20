import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { listCapabilitiesForStaffRole } from "@/lib/admin/staff-capabilities";
import { staffRoleLabel } from "@/lib/admin/staff-role-presenter";
import type { UserStaffRole } from "@auction/types";

export function AdminUserCapabilitiesPanel({
  staffRole,
}: {
  staffRole: UserStaffRole | null;
}) {
  const caps = listCapabilitiesForStaffRole(staffRole);

  if (staffRole == null) {
    return (
      <AdminEmptyState
        title="Legacy full access"
        description="No internal staff role is set. This account uses pre–18 June behaviour until a narrow role is assigned."
      />
    );
  }

  if (caps.length === 0) {
    return (
      <AdminEmptyState
        title="No capabilities"
        description={`Role “${staffRoleLabel(staffRole)}” has no mapped capabilities in the current policy matrix.`}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="font-body text-sm text-on-surface-variant">
        Read-only view of capabilities granted to{" "}
        <span className="font-medium capitalize text-on-surface">{staffRoleLabel(staffRole)}</span>{" "}
        in the current policy matrix.
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {caps.map((cap) => (
          <li
            key={cap}
            className="rounded-md border border-border-hairline bg-surface-container-lowest px-3 py-2 font-mono text-xs text-on-surface"
          >
            {cap}
          </li>
        ))}
      </ul>
    </div>
  );
}
