"use client";

import { useAdminMutation } from "@/components/use-admin-mutation";
import { useListNavigation } from "@/components/use-list-navigation.client";
import { createSavedViewsPort } from "@/lib/saved-views-port.client";
import { grantStaffRole, revokeStaffRole } from "@/server/application/admin-people-actions.server";
import {
  STAFF_LIST_PATH,
  STAFF_ROLE_OPTIONS,
  type StaffMemberRow,
  filterStaff,
  isGrantableRole,
  lastActiveLabel,
  parseStaffListParams,
  staffListHref,
  staffMemberName,
  staffMemberStatus,
  staffTeamViews,
} from "@/server/domain/staff-directory.vm";
import { staffRoleLabel } from "@/server/domain/staff-role-label.vm";
import {
  ConfirmActionDialog,
  DangerZone,
  DangerZoneAction,
  type DataColumn,
  DataTable,
  DataTableToolbar,
  DataViews,
  DetailPanel,
  EmptyState,
  EnumSelect,
  Field,
  FilterMenu,
  FormActions,
  KeyValueList,
  NoResultsState,
  PageHeader,
  PanelSection,
  StaffButton,
  StatusBadge,
  TableSearch,
  TextInput,
  formatStaffDateTime,
  initialsOf,
  useSavedViews,
} from "@auction/staff-ui";
import { CircleAlert, UserPlus } from "@auction/staff-ui/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

const STAFF_LIST_KEY = "lax-admin.staff";

type GrantableRole = (typeof STAFF_ROLE_OPTIONS)[number]["value"];

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-staff-neutral-bg text-staff-2xs font-semibold text-staff-neutral-fg"
    >
      {initialsOf(name)}
    </span>
  );
}

function MutationError({
  message,
  stepUpRequired,
  stepUpHref,
}: {
  message: string | null;
  stepUpRequired: boolean;
  stepUpHref: string;
}) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-staff-md bg-staff-danger-bg px-3 py-2.5 text-staff-sm text-staff-danger-fg"
    >
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>
        {message}
        {stepUpRequired ? (
          <>
            {" "}
            <a href={stepUpHref} className="font-medium underline">
              Sign in again
            </a>
          </>
        ) : null}
      </span>
    </p>
  );
}

/** Adds someone who already has a LAX login, by email, with a role. */
function AddStaffPanel({
  open,
  onOpenChange,
  bidStaffUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bidStaffUrl: string | undefined;
}) {
  const mutation = useAdminMutation();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<GrantableRole | null>(null);
  const [errors, setErrors] = useState<{ email?: string; role?: string }>({});

  const submit = async () => {
    const address = email.trim();
    const next = {
      ...(address ? {} : { email: "Enter their email address." }),
      ...(address && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)
        ? { email: "Enter an email address like name@example.com." }
        : {}),
      ...(role ? {} : { role: "Choose a role." }),
    };
    setErrors(next);
    if (Object.keys(next).length > 0 || !role) return;
    const ok = await mutation.run(
      () => grantStaffRole({ email: address, role, idempotencyKey: mutation.idempotencyKey }),
      `${address} can now sign in as ${staffRoleLabel(role)}`,
    );
    if (ok) {
      setEmail("");
      setRole(null);
      onOpenChange(false);
    }
  };

  return (
    <DetailPanel
      open={open}
      onOpenChange={onOpenChange}
      title="Add staff"
      description="They must already have a LAX login."
      footer={
        <>
          <StaffButton variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </StaffButton>
          <StaffButton variant="primary" type="submit" form="add-staff" loading={mutation.pending}>
            Add staff
          </StaffButton>
        </>
      }
    >
      <form
        id="add-staff"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <MutationError {...mutation} />
        <Field label="Email" error={errors.email}>
          <TextInput
            type="email"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@lax.art"
          />
        </Field>
        <Field
          label="Role"
          error={errors.role}
          description="What they can see and do in LAX Admin."
        >
          <EnumSelect
            value={role}
            onValueChange={setRole}
            options={STAFF_ROLE_OPTIONS}
            placeholder="Choose a role"
          />
        </Field>
        <p className="text-staff-sm text-staff-muted">
          Someone without a LAX login yet is invited from{" "}
          {bidStaffUrl ? (
            <a
              className="font-medium text-staff-fg underline underline-offset-2"
              href={bidStaffUrl}
            >
              Bid admin staff
            </a>
          ) : (
            "Bid admin"
          )}
          , which manages access across every LAX tool.
        </p>
      </form>
    </DetailPanel>
  );
}

/** One person: their details, change role, and revoke access in the danger zone. */
function StaffMemberPanel({
  member,
  isSelf,
  onClose,
}: {
  member: StaffMemberRow | null;
  isSelf: boolean;
  onClose: () => void;
}) {
  const grant = useAdminMutation();
  const revoke = useAdminMutation();
  const [role, setRole] = useState<GrantableRole | null>(null);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const name = member ? staffMemberName(member) : "";
  const currentRole = member && isGrantableRole(member.role) ? member.role : null;
  const chosen = role ?? currentRole;

  return (
    <DetailPanel
      open={member !== null}
      onOpenChange={(open) => {
        if (!open) {
          setRole(null);
          onClose();
        }
      }}
      title={name}
      description={member?.email && member.email !== name ? member.email : undefined}
      status={
        member ? (
          <StatusBadge tone={staffMemberStatus(member).tone}>
            {staffMemberStatus(member).label}
          </StatusBadge>
        ) : null
      }
    >
      {member ? (
        <>
          <PanelSection title="Details">
            <KeyValueList
              items={[
                { label: "Role", value: staffRoleLabel(member.role) },
                {
                  label: "Email",
                  value: member.email,
                  ...(member.email ? { copyValue: member.email } : {}),
                },
                {
                  label: "Last active",
                  value: member.lastActiveAt
                    ? formatStaffDateTime(member.lastActiveAt)
                    : "No activity yet",
                },
                { label: "Added", value: formatStaffDateTime(member.createdAt) },
                {
                  label: "LAX Account",
                  value: "Account reference",
                  copyValue: member.identitySubjectId,
                },
              ]}
            />
          </PanelSection>
          {member.email && !isSelf ? (
            <PanelSection title="Role">
              <form
                noValidate
                className="flex flex-col gap-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (!chosen || !member.email || chosen === member.role) return;
                  const ok = await grant.run(
                    () =>
                      grantStaffRole({
                        email: member.email ?? "",
                        role: chosen,
                        idempotencyKey: grant.idempotencyKey,
                      }),
                    `${name} is now ${staffRoleLabel(chosen)}`,
                  );
                  if (ok) setRole(null);
                }}
              >
                <MutationError {...grant} />
                <Field label="Role" description="Takes effect the next time they load a page.">
                  <EnumSelect value={chosen} onValueChange={setRole} options={STAFF_ROLE_OPTIONS} />
                </Field>
                <FormActions>
                  <StaffButton
                    type="submit"
                    variant="primary"
                    loading={grant.pending}
                    disabled={!chosen || chosen === member.role}
                  >
                    Change role
                  </StaffButton>
                </FormActions>
              </form>
            </PanelSection>
          ) : null}
          <PanelSection title="Access">
            <DangerZone title="Danger zone">
              <DangerZoneAction
                title="Revoke access"
                description={
                  isSelf
                    ? "You cannot revoke your own access; ask another administrator."
                    : `${name} will no longer be able to use LAX Admin. You can add them again later.`
                }
                action={
                  <StaffButton
                    variant="danger-secondary"
                    size="sm"
                    disabled={isSelf}
                    onClick={() => setConfirmingRevoke(true)}
                  >
                    Revoke access
                  </StaffButton>
                }
              />
            </DangerZone>
          </PanelSection>
          <ConfirmActionDialog
            open={confirmingRevoke}
            onOpenChange={setConfirmingRevoke}
            title={`Revoke ${name}'s access?`}
            description={`${name} loses the ${staffRoleLabel(member.role)} role and is signed out of LAX Admin.`}
            confirmLabel="Revoke access"
            tone="danger"
            loading={revoke.pending}
            onConfirm={async () => {
              const ok = await revoke.run(
                () =>
                  revokeStaffRole({
                    identitySubjectId: member.identitySubjectId,
                    idempotencyKey: revoke.idempotencyKey,
                  }),
                `${name}'s access revoked`,
              );
              if (ok) {
                setConfirmingRevoke(false);
                onClose();
              }
            }}
          >
            <MutationError {...revoke} />
          </ConfirmActionDialog>
        </>
      ) : null}
    </DetailPanel>
  );
}

/**
 * Who can sign in to LAX Admin: name, email, role and when they were last active. Add someone
 * from the header; open a person to change their role or revoke their access.
 */
export function StaffDirectory({
  members,
  currentSubject,
  bidStaffUrl,
  now,
  footer,
}: {
  members: StaffMemberRow[];
  currentSubject: string;
  bidStaffUrl: string | undefined;
  now: string;
  footer?: React.ReactNode;
}) {
  const router = useRouter();
  const { Link: ListLink } = useListNavigation();
  const { q, roles } = parseStaffListParams(useSearchParams());
  const setFilter = (next: { q: string; roles: string[] }) =>
    router.replace(staffListHref(next), { scroll: false });
  const port = useMemo(() => createSavedViewsPort(STAFF_LIST_KEY), []);
  const saved = useSavedViews(STAFF_LIST_KEY, port);
  const teamViews = useMemo(() => staffTeamViews(), []);
  const currentQuery = staffListHref({ q, roles }).split("?")[1] ?? "";
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const today = useMemo(() => new Date(now), [now]);
  const rows = useMemo(() => filterStaff(members, { q, roles }), [members, q, roles]);
  const open = members.find((member) => member.staffMemberId === openId) ?? null;
  const roleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const member of members) counts.set(member.role, (counts.get(member.role) ?? 0) + 1);
    return counts;
  }, [members]);

  const columns: DataColumn<StaffMemberRow>[] = [
    {
      id: "name",
      header: "Name",
      mobile: "title",
      sortable: true,
      sortValue: (row) => staffMemberName(row).toLowerCase(),
      cell: (row) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar name={staffMemberName(row)} />
          <span className="truncate font-medium">{staffMemberName(row)}</span>
          {row.identitySubjectId === currentSubject ? (
            <span className="shrink-0 text-staff-xs text-staff-muted">You</span>
          ) : null}
        </span>
      ),
    },
    {
      id: "email",
      header: "Email",
      hideBelow: "lg",
      mobile: "meta",
      cell: (row) => <span className="text-staff-muted">{row.email ?? "—"}</span>,
    },
    {
      id: "role",
      header: "Role",
      width: "168px",
      mobile: "meta",
      sortable: true,
      sortValue: (row) => staffRoleLabel(row.role),
      cell: (row) => staffRoleLabel(row.role),
    },
    {
      id: "lastActive",
      header: "Last active",
      width: "148px",
      mobile: "meta",
      sortable: true,
      sortValue: (row) => row.lastActiveAt ?? "",
      defaultSortDirection: "desc",
      cell: (row) => (
        <span
          className="text-staff-muted"
          {...(row.lastActiveAt ? { title: formatStaffDateTime(row.lastActiveAt) } : {})}
        >
          {lastActiveLabel(row.lastActiveAt, today)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      width: "112px",
      mobile: "badge",
      cell: (row) => (
        <StatusBadge tone={staffMemberStatus(row).tone}>{staffMemberStatus(row).label}</StatusBadge>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Staff"
        description="People who can sign in to LAX Admin, their role, and when they were last active."
        primaryAction={
          <StaffButton
            variant="primary"
            icon={<UserPlus aria-hidden />}
            onClick={() => setAdding(true)}
          >
            Add staff
          </StaffButton>
        }
      />
      <DataTable
        label="Staff"
        columns={columns}
        data={rows}
        getRowId={(row) => row.staffMemberId}
        defaultSort={{ columnId: "name", direction: "asc" }}
        onRowOpen={(row) => setOpenId(row.staffMemberId)}
        activeRowId={openId}
        toolbar={
          <DataTableToolbar
            views={
              <DataViews
                views={[{ id: "all", label: "All", href: STAFF_LIST_PATH, count: members.length }]}
                activeId="all"
                Link={ListLink}
                team={teamViews}
                saved={saved}
                savedHref={(view) => `${STAFF_LIST_PATH}?${view.query}`}
                currentQuery={currentQuery}
              />
            }
            search={
              <TableSearch
                label="Search staff"
                placeholder="Name or email"
                value={q}
                onSearch={(next) => setFilter({ q: next, roles })}
                live
              />
            }
            filters={
              <FilterMenu
                label="Role"
                options={STAFF_ROLE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                  count: roleCounts.get(option.value) ?? 0,
                }))}
                selected={roles}
                onChange={(next) => setFilter({ q, roles: next })}
              />
            }
          />
        }
        empty={
          members.length === 0 ? (
            <EmptyState
              title="No staff yet"
              description="Add the first person with a LAX login to give them access."
            />
          ) : (
            <NoResultsState
              title="No one matches"
              description="Try another name or email, or clear the role filter."
              action={
                <StaffButton size="sm" onClick={() => setFilter({ q: "", roles: [] })}>
                  Clear filters
                </StaffButton>
              }
            />
          )
        }
        {...(footer ? { footer } : {})}
      />
      <StaffMemberPanel
        member={open}
        isSelf={open?.identitySubjectId === currentSubject}
        onClose={() => setOpenId(null)}
      />
      <AddStaffPanel open={adding} onOpenChange={setAdding} bidStaffUrl={bidStaffUrl} />
    </div>
  );
}
