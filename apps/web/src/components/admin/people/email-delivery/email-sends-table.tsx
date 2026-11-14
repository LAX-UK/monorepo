"use client";

import type { EmailSendRowVm } from "@/lib/admin/email-delivery/email-delivery.vm";
import {
  type DataColumn,
  DataTable,
  DetailPanel,
  EmptyState,
  KeyValueList,
  type PanelQueue,
  StaffButton,
  StatusBadge,
  Timeline,
} from "@auction/staff-ui";

type TableProps = {
  rows: readonly EmailSendRowVm[];
  total: number;
  showingAll: boolean;
  onShowAll: () => void;
  onOpen: (id: string) => void;
  /** The send shown in the panel, marked so focus returns to it. */
  activeId?: string | null;
  personName: string;
  skippedCount: number;
};

const COLUMNS: DataColumn<EmailSendRowVm>[] = [
  {
    id: "email",
    header: "Email",
    mobile: "title",
    cell: (send) => (
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="truncate font-medium text-staff-fg">{send.label}</span>
        <span className="shrink-0 text-staff-xs text-staff-muted">{send.necessity}</span>
      </span>
    ),
  },
  {
    id: "product",
    header: "Product",
    width: "128px",
    hideBelow: "md",
    mobile: "meta",
    truncate: false,
    cell: (send) => <span className="text-staff-muted">{send.product}</span>,
  },
  {
    id: "time",
    header: "Time",
    width: "208px",
    hideBelow: "lg",
    mobile: "hidden",
    truncate: false,
    numeric: true,
    cell: (send) => <span className="text-staff-muted">{send.at}</span>,
  },
  {
    id: "status",
    header: "Status",
    width: "176px",
    mobile: "badge",
    truncate: false,
    cell: (send) => <StatusBadge tone={send.status.tone}>{send.status.label}</StatusBadge>,
  },
];

/**
 * The latest emails to this person, newest first: five at first, then all of them. A row opens
 * what the email provider reported. Emails skipped while the address was blocked are listed as
 * "Not sent: blocked" and are not resent.
 */
export function EmailSendsTable({
  rows,
  total,
  showingAll,
  onShowAll,
  onOpen,
  activeId = null,
  personName,
  skippedCount,
}: TableProps) {
  return (
    <div className="border-t border-staff-line-subtle">
      <div className="flex items-baseline gap-2 px-4 pt-3 pb-1">
        <h3 className="text-staff-sm font-semibold text-staff-fg">Recent sends</h3>
        <span className="text-staff-sm text-staff-muted">latest {total}, newest first</span>
      </div>
      <DataTable<EmailSendRowVm>
        embedded
        label={`Recent emails to ${personName}`}
        columns={COLUMNS}
        data={rows}
        getRowId={(send) => send.id}
        density="compact"
        defaultSort={{ columnId: "time", direction: "desc" }}
        stickyHeader={false}
        stickyToolbar={false}
        onRowOpen={(send) => onOpen(send.id)}
        activeRowId={activeId}
        empty={
          <EmptyState
            size="compact"
            headingLevel="h3"
            title="No emails sent yet"
            description="Emails to this address appear here once something is sent."
          />
        }
        {...(total === 0
          ? {}
          : {
              footer: (
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-staff-sm text-staff-muted">
                  <span className="tabular-nums">
                    Showing {rows.length} of {total}
                    {skippedCount > 0 ? `. ${skippedCount} not sent while blocked.` : ""}
                  </span>
                  {!showingAll && total > rows.length ? (
                    <StaffButton size="sm" variant="ghost" onClick={onShowAll}>
                      Show all {total}
                    </StaffButton>
                  ) : null}
                </div>
              ),
            })}
      />
    </div>
  );
}

/** What the provider reported about one email, in order. */
export function EmailSendDetail({
  send,
  onOpenChange,
  queue,
}: {
  send: EmailSendRowVm | null;
  onOpenChange: (open: boolean) => void;
  /** Its place among the sends shown, and J/K stepping. */
  queue?: PanelQueue;
}) {
  return (
    <DetailPanel
      open={send !== null}
      onOpenChange={onOpenChange}
      {...(queue ? { queue } : {})}
      title={send?.label ?? "Email"}
      {...(send ? { description: `${send.product} · ${send.at}` } : {})}
      status={send ? <StatusBadge tone={send.status.tone}>{send.status.label}</StatusBadge> : null}
    >
      {send ? (
        <div className="flex flex-col gap-4">
          <KeyValueList
            items={[
              { label: "Kind", value: send.necessity },
              { label: "Product", value: send.product },
            ]}
          />
          {send.statusKey === "not_sent_blocked" ? (
            <p className="text-staff-sm text-staff-muted">
              This email was skipped because the address was blocked. It is not resent. Resend it
              from the invoice or the lot if it still matters.
            </p>
          ) : null}
          <Timeline
            label={`Provider events for ${send.label}`}
            empty="The provider has not reported on this email yet."
            events={send.events.map((event) => ({
              id: event.id,
              title: event.title,
              at: event.at,
              tone: event.tone,
            }))}
          />
        </div>
      ) : null}
    </DetailPanel>
  );
}
