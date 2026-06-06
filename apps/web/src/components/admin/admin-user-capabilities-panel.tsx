import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import {
  capabilityDescription,
  capabilityLabel,
  groupCapabilitiesForDisplay,
} from "@/lib/admin/capability-presenter";
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

  const groups = groupCapabilitiesForDisplay(caps);

  return (
    <div className="space-y-6">
      <p className="font-body text-sm text-on-surface-variant">
        Capabilities granted to{" "}
        <span className="font-medium capitalize text-on-surface">{staffRoleLabel(staffRole)}</span>{" "}
        in the current policy matrix.
      </p>
      {groups.map((group) => (
        <section key={group.id} className="space-y-3">
          <h3 className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            {group.label}
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {group.capabilities.map((cap) => (
              <li
                key={cap}
                className="rounded-md border border-border-hairline bg-surface-container-lowest px-3 py-3"
              >
                <p className="font-body text-sm font-medium text-on-surface">
                  {capabilityLabel(cap)}
                </p>
                <p className="mt-1 font-body text-xs text-on-surface-variant">
                  {capabilityDescription(cap)}
                </p>
                <p className="mt-2 font-mono text-[10px] text-on-surface-variant/80">{cap}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
