"use client";

import { AddStaffRoleDialog } from "@/components/admin/people/add-staff-role-dialog";
import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import { adminRemoveStaffRoleAction } from "@/lib/actions/admin/admin-staff-roles";
import {
  type StaffRoleChipView,
  removeStaffRoleBlock,
  staffRoleChip,
} from "@/lib/admin/people/staff-roles.vm";
import type { StaffRolesOverview } from "@/lib/data/http/staff-roles.server";
import { USER_ROLE_MANAGEMENT_ACCESS } from "@/lib/navigation/staff-nav-access";
import { Notice, Permitted, Section, StaffButton, StaffChip } from "@auction/staff-ui";
import { STAFF_ROLE_REASON_MAX, STAFF_ROLE_REASON_MIN } from "@auction/validators";
import { Plus } from "lucide-react";
import { useState } from "react";

type Props = {
  person: { id: string; name: string };
  /** Null when the roles could not be read. */
  overview: StaffRolesOverview | null;
  /** When the page was built, ISO; every date on the chips counts from it. */
  nowIso: string;
};

/**
 * A staff member's Bid roles as chips, each with when it started and when it ends. Role managers
 * add a role (with an optional last day and a reason) and remove one after confirming; the last
 * administrator's role cannot be removed, and says why. Everyone else sees the roles only.
 */
export function StaffRolesSection({ person, overview, nowIso }: Props) {
  const now = new Date(nowIso);
  const [adding, setAdding] = useState(false);
  const confirm = useStaffConfirm();
  const held = overview?.assignments ?? [];
  const chips = held.map((assignment) => staffRoleChip(assignment, now));
  /** Roles that cannot be removed right now, and why. */
  const blocks = new Map(
    chips.flatMap((chip) => {
      const reason = overview
        ? removeStaffRoleBlock(held, chip.role, overview.otherActiveAdministrators, now)
        : null;
      return reason ? [[chip.id, reason] as const] : [];
    }),
  );

  const remove = (chip: StaffRoleChipView) =>
    confirm.ask({
      title: `Remove the ${chip.label} role from ${person.name}?`,
      description:
        "They lose what only this role allows the next time they load a page. Roles they keep are not affected.",
      confirmLabel: "Remove role",
      tone: "danger",
      reason: {
        label: "Reason",
        description: "Why the role is no longer needed. Kept in the audit log.",
        minLength: STAFF_ROLE_REASON_MIN,
        maxLength: STAFF_ROLE_REASON_MAX,
      },
      stepUpAction: "change staff roles",
      run: ({ reason }) => adminRemoveStaffRoleAction(person.id, { role: chip.role, reason }),
      success: `${chip.label} role removed from ${person.name}`,
    });

  return (
    <>
      <Section
        id="roles"
        title="Bid roles"
        description="What they can do in Bid admin: the permissions of every role added together."
        className="scroll-mt-20"
        action={
          overview ? (
            <StaffButton
              size="sm"
              variant="secondary"
              icon={<Plus aria-hidden />}
              requires={USER_ROLE_MANAGEMENT_ACCESS}
              onClick={() => setAdding(true)}
            >
              Add role
            </StaffButton>
          ) : null
        }
      >
        {overview === null ? (
          <Notice tone="warning" title="Roles did not load">
            Refresh the page to try again.
          </Notice>
        ) : chips.length === 0 ? (
          <p className="text-staff-sm text-staff-muted">
            No Bid roles. {person.name} can sign in but cannot open any admin page until they are
            given one.
          </p>
        ) : (
          <ul
            aria-label={`${person.name}'s roles`}
            className="m-0 flex list-none flex-wrap gap-2 p-0"
          >
            {chips.map((chip) => {
              const blocked = blocks.get(chip.id) ?? null;
              return (
                <li key={chip.id} className="max-w-full">
                  <StaffChip
                    label={chip.label}
                    meta={chip.meta}
                    metaTone={chip.endingSoon ? "attention" : "muted"}
                    onRemove={() => remove(chip)}
                    removeLabel={`Remove the ${chip.label} role`}
                    removeRequires={USER_ROLE_MANAGEMENT_ACCESS}
                    {...(blocked ? { removeDisabledReason: blocked } : {})}
                  />
                </li>
              );
            })}
          </ul>
        )}
        {blocks.size > 0 ? (
          <Permitted requires={USER_ROLE_MANAGEMENT_ACCESS}>
            <p className="mt-3 text-staff-xs text-staff-muted">
              {person.name} is the only administrator, so the role stays until someone else is given
              it.
            </p>
          </Permitted>
        ) : null}
      </Section>
      {overview ? (
        <AddStaffRoleDialog
          person={person}
          held={held}
          open={adding}
          onOpenChange={setAdding}
          now={now}
        />
      ) : null}
      {confirm.dialog}
    </>
  );
}
