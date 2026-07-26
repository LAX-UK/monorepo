import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { CatalogDetailTabCard } from "@/components/admin/catalog";
import {
  capabilityDescription,
  capabilityLabel,
  groupCapabilitiesForDisplay,
} from "@/lib/admin/capability-presenter";
import { listCapabilitiesForStaffRole } from "@/lib/admin/staff-capabilities";
import { staffRoleLabel } from "@/lib/admin/staff-role-presenter";
import type { UserStaffRole } from "@auction/types";

/** Visible profile cards on staff overview (used for tab count badge). */
export const STAFF_OVERVIEW_SECTION_COUNT = 4;

export function countStaffCapabilities(staffRole: UserStaffRole | null): number {
  return listCapabilitiesForStaffRole(staffRole).length;
}

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
        <CatalogDetailTabCard
          key={group.id}
          title={group.label}
          description={`${group.capabilities.length} permission${group.capabilities.length === 1 ? "" : "s"}`}
          countBadge={group.capabilities.length}
        >
          <ul className="divide-y divide-border-hairline">
            {group.capabilities.map((cap) => (
              <li
                key={cap}
                className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-body text-sm font-medium text-on-surface">
                    {capabilityLabel(cap)}
                  </p>
                  <p className="mt-1 font-body text-xs text-on-surface-variant">
                    {capabilityDescription(cap)}
                  </p>
                </div>
                <AdminStatusBadge domain="kyc" status="approved" label="Granted" size="sm" />
              </li>
            ))}
          </ul>
        </CatalogDetailTabCard>
      ))}
    </div>
  );
}
