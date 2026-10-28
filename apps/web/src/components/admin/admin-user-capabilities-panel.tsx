import {
  capabilityDescription,
  capabilityLabel,
  groupCapabilitiesForDisplay,
} from "@/lib/admin/capability-presenter";
import { listCapabilitiesForStaffRoles } from "@/lib/admin/staff-capabilities";
import { staffRolesLabel } from "@/lib/admin/staff-role-presenter";
import { EmptyState, KeyValueList, Section } from "@auction/staff-ui";
import type { StaffRoles } from "@auction/types";

/**
 * What a person's roles let them do in LAX Bid, added together and grouped by area, from the
 * current policy matrix.
 */
export function AdminUserCapabilitiesPanel({ staffRoles }: { staffRoles: StaffRoles }) {
  const groups = groupCapabilitiesForDisplay(listCapabilitiesForStaffRoles(staffRoles));
  const roles = staffRolesLabel(staffRoles);

  if (groups.length === 0) {
    return (
      <Section id="permissions" title="Permissions" className="scroll-mt-20" bodyClassName="p-0">
        <EmptyState
          headingLevel="h3"
          title="No permissions yet"
          description="Permissions come from Bid roles. Add a role to give this person access to Bid admin."
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
          description={`${group.capabilities.length} ${group.capabilities.length === 1 ? "permission" : "permissions"} from ${roles}`}
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
