import {
  capabilityDescription,
  capabilityLabel,
  groupCapabilitiesForDisplay,
} from "@/lib/admin/capability-presenter";
import { listCapabilitiesForStaffRole } from "@/lib/admin/staff-capabilities";
import { staffRoleLabel } from "@/lib/admin/staff-role-presenter";
import { EmptyState, KeyValueList, Notice, Section } from "@auction/staff-ui";
import type { UserStaffRole } from "@auction/types";

/** What a staff role can do in LAX Bid, grouped by area, from the current policy matrix. */
export function AdminUserCapabilitiesPanel({ staffRole }: { staffRole: UserStaffRole | null }) {
  if (staffRole == null) {
    return (
      <Notice tone="warning" title="No staff role is set">
        This account keeps the full access it had before 18 June until a narrower role is assigned.
      </Notice>
    );
  }

  const groups = groupCapabilitiesForDisplay(listCapabilitiesForStaffRole(staffRole));

  if (groups.length === 0) {
    return (
      <Section id="permissions" title="Permissions" className="scroll-mt-20" bodyClassName="p-0">
        <EmptyState
          headingLevel="h3"
          title="No permissions"
          description={`The ${staffRoleLabel(staffRole)} role has no permissions in the current policy.`}
        />
      </Section>
    );
  }

  return (
    <>
      {groups.map((group, index) => (
        <Section
          key={group.id}
          {...(index === 0 ? { id: "permissions" } : {})}
          title={group.label}
          description={`${group.capabilities.length} ${group.capabilities.length === 1 ? "permission" : "permissions"} for the ${staffRoleLabel(staffRole)} role`}
          className="scroll-mt-20"
        >
          <KeyValueList
            items={group.capabilities.map((capability) => ({
              label: capabilityLabel(capability),
              value: capabilityDescription(capability),
            }))}
          />
        </Section>
      ))}
    </>
  );
}
