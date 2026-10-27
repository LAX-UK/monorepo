"use client";

import { InvitationAccessBadges } from "@/components/admin/invitation-access-badges";
import { InvitePeopleDialog } from "@/components/admin/invite-people-dialog";
import { StaffBulkOperations } from "@/components/admin/staff/staff-bulk-operations";
import { useListPanel } from "@/components/admin/staff/use-list-panel";
import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import {
  adminResendInvitationResultAction,
  adminRevokeInvitationResultAction,
} from "@/lib/actions/admin/admin-invitations";
import { getInvitationBulkOperations } from "@/lib/admin/bulk-ops/invitations";
import {
  type InvitationStaffRow,
  type InvitationsListSearch,
  invitationPanelHref,
  invitationsListHref,
  invitationsSort,
} from "@/lib/admin/people/invitations-staff-list.vm";
import {
  type DataColumn,
  DataViews,
  DetailPanel,
  ListPage,
  Notice,
  type OverflowAction,
  OverflowMenu,
  PrimaryCell,
  StaffButton,
  StaffDate,
  StatusBadge,
  TableSearch,
  formatStaffDateTime,
  toast,
} from "@auction/staff-ui";
import { Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

export type InvitationsStaffListProps = {
  rows: InvitationStaffRow[];
  search: InvitationsListSearch;
  counts: { total: number; pending: number; accepted: number };
  filterChips: Array<{ id: string; label: string; clearHref: string }>;
  pageSize: number;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  /** An invitation opened from a link that is not on this page. */
  offPage: InvitationStaffRow | null;
  loadError: string | null;
  filtered: boolean;
};

const str = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

/** Resend and revoke, the same from a row's `…` menu and the panel, each confirmed first. */
export function useInvitationActions() {
  const confirm = useStaffConfirm();
  const { ask } = confirm;

  const resend = useCallback(
    (row: InvitationStaffRow) =>
      ask({
        title: `Resend the invitation to ${row.email}?`,
        description:
          "We email a new sign-up link that lasts 7 days. Any earlier link stops working.",
        confirmLabel: "Resend invitation",
        run: () => adminResendInvitationResultAction(row.id),
        success: `Invitation resent to ${row.email}`,
      }),
    [ask],
  );

  const revoke = useCallback(
    (row: InvitationStaffRow) =>
      ask({
        title: `Revoke the invitation to ${row.email}?`,
        description:
          "The sign-up link stops working straight away. To invite them later, send a new invitation.",
        confirmLabel: "Revoke invitation",
        tone: "danger",
        run: () => adminRevokeInvitationResultAction(row.id),
        success: `Invitation to ${row.email} revoked`,
      }),
    [ask],
  );

  const actionsFor = useCallback(
    (row: InvitationStaffRow): OverflowAction[] => [
      {
        id: "resend",
        label: "Resend invitation",
        onSelect: () => resend(row),
        ...(row.resendBlocked ? { disabledReason: row.resendBlocked } : {}),
      },
      {
        id: "copy",
        label: "Copy email address",
        onSelect: () => {
          void navigator.clipboard
            ?.writeText(row.email)
            .then(() => toast.success("Email address copied"));
        },
      },
      {
        id: "revoke",
        label: "Revoke invitation",
        tone: "danger",
        onSelect: () => revoke(row),
        ...(row.revokeBlocked ? { disabledReason: row.revokeBlocked } : {}),
      },
    ],
    [resend, revoke],
  );

  return { actionsFor, resend, revoke, dialog: confirm.dialog };
}

const VIEWS = [
  { id: "all", label: "All", status: null },
  { id: "pending", label: "Pending", status: "pending" },
  { id: "accepted", label: "Accepted", status: "accepted" },
  { id: "expired", label: "Expired", status: "expired" },
  { id: "revoked", label: "Revoked", status: "revoked" },
] as const;

const VIEW_EMPTY: Record<string, { title: string; description: string }> = {
  all: {
    title: "Invite your first person",
    description:
      "Invite a client or a colleague by email. Each invitation shows here until it is accepted, expires or is revoked.",
  },
  pending: {
    title: "No invitations waiting",
    description: "Invitations that have been sent but not yet accepted appear here.",
  },
  accepted: {
    title: "No accepted invitations",
    description: "When someone signs up from an invitation, it moves here.",
  },
  expired: {
    title: "No expired invitations",
    description: "Invitations not accepted within 7 days appear here, ready to resend.",
  },
  revoked: {
    title: "No revoked invitations",
    description: "Invitations withdrawn before they were accepted appear here.",
  },
};

/**
 * Invitations on the staff list template: views by status with counts, search by email, server
 * sorting (most recently sent first by default), bulk resend and revoke, and a record panel
 * deep-linked with `?invitation=`. Actions an invitation's state blocks stay in the menu,
 * disabled with the reason.
 */
export function InvitationsStaffList(props: InvitationsStaffListProps) {
  const { rows, search, filtered } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const inviteParam = str(search.invite);
  const [inviteOpen, setInviteOpen] = useState(inviteParam !== "");
  const panelHref = useCallback((id: string | null) => invitationPanelHref(search, id), [search]);
  const panel = useListPanel({
    param: "invitation",
    initialId: str(search.invitation) || null,
    hrefFor: panelHref,
  });
  const actions = useInvitationActions();
  const operations = useMemo(() => getInvitationBulkOperations(), []);
  const status = str(search.status);
  const q = str(search.q);
  const counts: Record<string, number | undefined> = {
    all: props.counts.total,
    pending: props.counts.pending,
    accepted: props.counts.accepted,
  };

  const columns = useMemo<DataColumn<InvitationStaffRow>[]>(
    () => [
      {
        id: "email",
        header: "Invitee",
        mobile: "title",
        sortable: true,
        defaultSortDirection: "asc",
        cell: (row) => (
          <PrimaryCell
            href={panelHref(row.id)}
            Link={panel.PanelLink}
            secondary={row.invitedBy ? `Invited by ${row.invitedBy}` : null}
          >
            {row.email}
          </PrimaryCell>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "140px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <StatusBadge tone={row.status.tone}>{row.status.label}</StatusBadge>,
      },
      {
        id: "access",
        header: "Access",
        width: "26%",
        hideBelow: "md",
        mobile: "meta",
        truncate: false,
        cell: (row) => (
          <InvitationAccessBadges
            targetRole={row.targetRole}
            targetStaffRole={row.targetStaffRole}
            grants={row.grants}
          />
        ),
      },
      {
        id: "sent",
        header: "Sent",
        width: "128px",
        sortable: true,
        defaultSortDirection: "desc",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.sentAt} />,
      },
      {
        id: "expires",
        header: "Expires",
        width: "128px",
        sortable: true,
        defaultSortDirection: "asc",
        hideBelow: "lg",
        mobile: "hidden",
        truncate: false,
        cell: (row) =>
          row.status.label === "Accepted" ? null : <StaffDate value={row.expiresAt} />,
      },
    ],
    [panelHref, panel.PanelLink],
  );

  const open =
    rows.find((row) => row.id === panel.openId) ??
    (props.offPage && props.offPage.id === panel.openId ? props.offPage : null);

  return (
    <>
      <ListPage<InvitationStaffRow>
        title="Invitations"
        description="Invite clients and staff by email. They finish signing up from the link we send."
        Link={ListLink}
        listKey="bid-admin.invitations"
        primaryAction={
          <StaffButton
            variant="primary"
            size="sm"
            icon={<Plus aria-hidden />}
            onClick={() => setInviteOpen(true)}
          >
            Invite people
          </StaffButton>
        }
        views={
          <DataViews
            views={VIEWS.map((view) => ({
              id: view.id,
              label: view.label,
              href: invitationsListHref(search, { status: view.status }),
              ...(view.id in counts ? { count: counts[view.id] as number } : {}),
            }))}
            activeId={status || "all"}
            Link={ListLink}
          />
        }
        search={
          <TableSearch
            key={q}
            fullWidth
            label="Search invitations"
            placeholder="Search by email"
            value={q}
            onSearch={(next) => navigate(invitationsListHref(search, { q: next || null }))}
          />
        }
        activeFilters={props.filterChips
          .filter((chip) => chip.id !== "status")
          .map((chip) => ({
            id: chip.id,
            label: chip.label,
            onRemove: () => navigate(chip.clearHref),
          }))}
        onClearFilters={() => navigate(invitationsListHref(search, { q: null }))}
        loading={pending}
        filtered={filtered}
        error={
          props.loadError
            ? {
                title: "Invitations did not load",
                description: props.loadError,
                onRetry: () => navigate(invitationsListHref(search, {})),
              }
            : null
        }
        empty={{
          ...(VIEW_EMPTY[status || "all"] ??
            (VIEW_EMPTY.all as { title: string; description: string })),
          ...(status
            ? {}
            : {
                action: (
                  <StaffButton size="sm" variant="primary" onClick={() => setInviteOpen(true)}>
                    Invite people
                  </StaffButton>
                ),
              }),
        }}
        noResults={{ noun: "invitations" }}
        table={{
          columns,
          data: rows,
          getRowId: (row) => row.id,
          defaultDensity: "comfortable",
          defaultSort: invitationsSort.defaultSort,
          sort: invitationsSort.state(str(search.sort)),
          onSortChange: (sort) =>
            navigate(invitationsListHref(search, { sort: invitationsSort.param(sort) })),
          onRowOpen: (row) => panel.show(row.id),
          activeRowId: panel.openId,
          selectedIds: selected,
          onSelectedIdsChange: setSelected,
          bulkNoun: { one: "invitation", other: "invitations" },
          bulkActions: (chosen: InvitationStaffRow[]) => (
            <StaffBulkOperations
              operations={operations}
              selectedIds={chosen.map((row) => row.id)}
              onClear={() => setSelected(new Set())}
              noun={{ one: "invitation", other: "invitations" }}
            />
          ),
          rowActions: {
            label: (row) => `Actions for the invitation to ${row.email}`,
            actions: (row) => [
              { id: "open", label: "Open details", onSelect: () => panel.show(row.id) },
              ...actions.actionsFor(row),
            ],
          },
        }}
        pageSize={{
          value: props.pageSize,
          onChange: (size) => navigate(invitationsListHref(search, { limit: size })),
        }}
        pagination={props.pagination}
      />
      <DetailPanel
        open={panel.openId !== null && open === null && !pending}
        onOpenChange={(next) => {
          if (!next) panel.show(null);
        }}
        title="Invitation not found"
      >
        <Notice tone="warning" title="This invitation is not in the list">
          It may have been removed, or the link is out of date. Search by email to find it.
        </Notice>
      </DetailPanel>
      <InvitationQuickView
        row={open}
        actions={open ? actions.actionsFor(open) : []}
        onResend={open ? () => actions.resend(open) : undefined}
        onClose={() => panel.show(null)}
      />
      <InvitePeopleDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        {...(inviteParam === "staff" ? { defaultRole: "staff" as const } : {})}
      />
      {actions.dialog}
    </>
  );
}

/** One invitation beside the list: who, what access, where it stands, and what can be done. */
export function InvitationQuickView({
  row,
  actions,
  onResend,
  onClose,
}: {
  row: InvitationStaffRow | null;
  actions: OverflowAction[];
  onResend: (() => void) | undefined;
  onClose: () => void;
}) {
  const accepted = row?.status.label === "Accepted";
  return (
    <DetailPanel
      open={row !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={row?.email ?? "Invitation"}
      status={row ? <StatusBadge tone={row.status.tone}>{row.status.label}</StatusBadge> : null}
      meta={
        row ? [{ label: "Sent", value: formatStaffDateTime(row.sentAt, { zoneLabel: true }) }] : []
      }
      overflow={
        row ? (
          <OverflowMenu
            label={`Actions for the invitation to ${row.email}`}
            actions={actions.filter((action) => action.id !== "resend")}
          />
        ) : null
      }
      notice={
        row?.status.label === "Email bounced" ? (
          <Notice tone="danger" title="The invitation email did not arrive">
            Check the address with the person, then resend, or revoke this one and invite the right
            address.
          </Notice>
        ) : null
      }
      summary={
        row
          ? [
              {
                label: "Access",
                value: (
                  <InvitationAccessBadges
                    targetRole={row.targetRole}
                    targetStaffRole={row.targetStaffRole}
                    grants={row.grants}
                  />
                ),
              },
              { label: "Invited by", value: row.invitedBy ?? "Not recorded" },
              {
                label: "Opened",
                value: row.openedAt
                  ? formatStaffDateTime(row.openedAt, { zoneLabel: true })
                  : "Not yet",
              },
              {
                label: accepted ? "Link expired" : "Expires",
                value: formatStaffDateTime(row.expiresAt, { zoneLabel: true }),
              },
              { label: "Email delivery", value: row.delivery ?? "Not reported yet" },
              { label: "Invitation ID", value: row.id, copyValue: row.id },
            ]
          : []
      }
      footer={
        row && onResend ? (
          row.resendBlocked ? (
            <p className="text-staff-sm text-staff-muted">{row.resendBlocked}</p>
          ) : (
            <StaffButton variant="primary" onClick={onResend}>
              Resend invitation
            </StaffButton>
          )
        ) : null
      }
    >
      {null}
    </DetailPanel>
  );
}
