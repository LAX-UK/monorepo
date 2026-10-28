"use client";

import { AddStaffRoleDialog } from "@/components/admin/people/add-staff-role-dialog";
import type { StaffRoleActions } from "@/components/admin/people/staff-role-actions";
import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import {
  adminAssignLaxAdminRoleAction,
  adminAssignStaffRoleAction,
  adminRemoveLaxAdminRoleAction,
  adminRemoveStaffRoleAction,
} from "@/lib/actions/admin/admin-staff-roles";
import {
  BID_ROLE_PRODUCT,
  LAX_ADMIN_ROLE_PRODUCT,
  type StaffRoleChipView,
  type StaffRoleHeld,
  type StaffRoleProduct,
  removeStaffRoleBlock,
  staffRoleChip,
} from "@/lib/admin/people/staff-roles.vm";
import type { LaxAdminRolesOverview, StaffRolesOverview } from "@/lib/data/http/staff-roles.server";
import { USER_ROLE_MANAGEMENT_ACCESS } from "@/lib/navigation/staff-nav-access";
import { Notice, Permitted, Section, StaffButton, StaffChip } from "@auction/staff-ui";
import type { LaxShopStaffRole, UserStaffRole } from "@auction/types";
import { STAFF_ROLE_REASON_MAX, STAFF_ROLE_REASON_MIN } from "@auction/validators";
import { Plus } from "lucide-react";
import { useState } from "react";

type Person = { id: string; name: string };

type RolesOverview<R extends string> = {
  assignments: readonly StaffRoleHeld<R>[];
  otherActiveAdministrators: number;
};

type Props<R extends string> = {
  person: Person;
  product: StaffRoleProduct<R>;
  actions: StaffRoleActions<R>;
  /** Null when the roles could not be read. */
  overview: RolesOverview<R> | null;
  /** When the page was built, ISO; every date on the chips counts from it. */
  nowIso: string;
  copy: { id: string; title: string; description: string; empty: (name: string) => string };
};

/**
 * A person's roles on one admin as chips, each with when it started and when it ends. Role
 * managers add a role (with an optional last day and a reason) and remove one after confirming;
 * the last administrator's role cannot be removed, and says why. A change the admin has not
 * applied yet shows as waiting. Everyone else sees the roles only.
 */
function RolesSection<R extends string>({
  person,
  product,
  actions,
  overview,
  nowIso,
  copy,
}: Props<R>) {
  const now = new Date(nowIso);
  // Bid admin is where this record lives; another admin is named.
  const inTool = product.product === "bid" ? "" : ` in ${product.toolLabel}`;
  const toolAdministrator = product.product === "bid" ? "" : ` ${product.toolLabel}`;
  const [adding, setAdding] = useState(false);
  const confirm = useStaffConfirm();
  const held = overview?.assignments ?? [];
  const chips = held.map((assignment) => staffRoleChip(assignment, now, product));
  /** Roles that cannot be removed right now, and why. */
  const blocks = new Map(
    chips.flatMap((chip) => {
      const reason = overview
        ? removeStaffRoleBlock(held, chip.role, overview.otherActiveAdministrators, now, product)
        : null;
      return reason ? [[chip.id, reason] as const] : [];
    }),
  );
  const lastAdministrator = chips.some(
    (chip) => chip.role === product.rules.table.administratorRole && blocks.has(chip.id),
  );

  const remove = (chip: StaffRoleChipView<R>) =>
    confirm.ask({
      title: `Remove the ${chip.label} role from ${person.name}?`,
      description: `They lose what only this role allows${inTool} the next time they load a page. Roles they keep are not affected.`,
      confirmLabel: "Remove role",
      tone: "danger",
      reason: {
        label: "Reason",
        description: "Why the role is no longer needed. Kept in the audit log.",
        minLength: STAFF_ROLE_REASON_MIN,
        maxLength: STAFF_ROLE_REASON_MAX,
      },
      stepUpAction: "change staff roles",
      run: ({ reason }) => actions.remove(person.id, { role: chip.role, reason }),
      success: `${chip.label} role removed from ${person.name}`,
    });

  return (
    <>
      <Section
        id={copy.id}
        title={copy.title}
        description={copy.description}
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
          <p className="text-staff-sm text-staff-muted">{copy.empty(person.name)}</p>
        ) : (
          <ul
            aria-label={`${person.name}'s${toolAdministrator} roles`}
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
        {lastAdministrator ? (
          <Permitted requires={USER_ROLE_MANAGEMENT_ACCESS}>
            <p className="mt-3 text-staff-xs text-staff-muted">
              {person.name} is the only{toolAdministrator} administrator, so the role stays until
              someone else is given it.
            </p>
          </Permitted>
        ) : null}
      </Section>
      {overview ? (
        <AddStaffRoleDialog
          person={person}
          product={product}
          actions={actions}
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

const BID_ACTIONS: StaffRoleActions<UserStaffRole> = {
  assign: adminAssignStaffRoleAction,
  remove: adminRemoveStaffRoleAction,
};

const LAX_ADMIN_ACTIONS: StaffRoleActions<LaxShopStaffRole> = {
  assign: adminAssignLaxAdminRoleAction,
  remove: adminRemoveLaxAdminRoleAction,
};

/** A staff member's Bid admin roles on their staff record. */
export function StaffRolesSection(props: {
  person: Person;
  overview: StaffRolesOverview | null;
  nowIso: string;
}) {
  return (
    <RolesSection
      {...props}
      product={BID_ROLE_PRODUCT}
      actions={BID_ACTIONS}
      copy={{
        id: "roles",
        title: "Bid roles",
        description: "What they can do in Bid admin: the permissions of every role added together.",
        empty: (name) =>
          `No Bid roles. ${name} can sign in but cannot open any admin page until they are given one.`,
      }}
    />
  );
}

/** The same person's LAX Admin roles, managed from the same staff record. */
export function LaxAdminRolesSection(props: {
  person: Person;
  overview: LaxAdminRolesOverview | null;
  nowIso: string;
}) {
  return (
    <RolesSection
      {...props}
      product={LAX_ADMIN_ROLE_PRODUCT}
      actions={LAX_ADMIN_ACTIONS}
      copy={{
        id: "lax-admin-roles",
        title: "LAX Admin roles",
        description:
          "What they can do in LAX Admin, the Shop and gallery tool: every role's permissions added together. LAX Admin applies a change within a minute.",
        empty: (name) => `No LAX Admin roles. ${name} cannot sign in to LAX Admin.`,
      }}
    />
  );
}
