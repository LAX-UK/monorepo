"use client";

import { RelatedRecordsSection } from "@/components/admin/people/related-records-section";
import { ShopStaffAccessControl } from "@/components/admin/people/shop-staff-access-control";
import {
  type PersonActionTarget,
  usePersonActions,
} from "@/components/admin/people/use-person-actions";
import {
  pendingChangeLabel,
  staffRoleOnPlatformLabel,
} from "@/lib/admin/people/staff-access-presenter";
import type { StaffAccessDetail } from "@/lib/data/http/staff-access.server";
import {
  type DataColumn,
  KeyValueList,
  Notice,
  Section,
  StaffButton,
  StaffDate,
} from "@auction/staff-ui";
import { laxStaffPlatform } from "@auction/types";
import { useMemo } from "react";

type Props = {
  person: PersonActionTarget;
  detail: StaffAccessDetail | null;
  /** May change this person's access on each platform. */
  canManage: boolean;
};

type HistoryRow = StaffAccessDetail["history"][number] & { rowId: string };

function changeLabel(entry: StaffAccessDetail["history"][number]): string {
  return entry.action === "granted" && entry.role
    ? `Given ${staffRoleOnPlatformLabel(entry.product, entry.role)}`
    : "Access removed";
}

const historyColumns: DataColumn<HistoryRow>[] = [
  {
    id: "at",
    header: "When",
    numeric: true,
    sortable: true,
    defaultSortDirection: "desc",
    width: "176px",
    mobile: "meta",
    sortValue: (entry) => Date.parse(entry.at),
    cell: (entry) => <StaffDate value={entry.at} withTime />,
  },
  {
    id: "platform",
    header: "Platform",
    width: "120px",
    mobile: "hidden",
    cell: (entry) => laxStaffPlatform(entry.product).label,
  },
  {
    id: "change",
    header: "Change",
    mobile: "title",
    cell: (entry) => changeLabel(entry),
  },
  {
    id: "by",
    header: "By",
    mobile: "meta",
    cell: (entry) => (
      <span className="text-staff-muted">
        {entry.actorName ?? "A LAX admin"}
        {entry.viaInvitation ? " (invitation)" : ""}
      </span>
    ),
  },
];

/** What this person can do on each LAX platform, who changed it, and the way to change it. */
export function StaffLaxAccessPanel({ person, detail, canManage }: Props) {
  const actions = usePersonActions({ canModerate: false, canManageRoles: canManage });
  const history = useMemo<HistoryRow[]>(
    () =>
      (detail?.history ?? []).map((entry, index) => ({
        ...entry,
        rowId: `${entry.at}-${entry.product}-${index}`,
      })),
    [detail],
  );

  if (!detail) {
    return (
      <Notice tone="warning" title="LAX access is unavailable">
        We could not load this person's access across LAX. Refresh the page to try again.
      </Notice>
    );
  }

  return (
    <>
      {detail.platforms.map((view) => {
        const platform = laxStaffPlatform(view.product);
        const shopRole = view.pending?.action === "granted" ? view.pending.role : view.role;
        return (
          <Section
            key={view.product}
            id={`access-${view.product}`}
            title={platform.label}
            description={platform.description}
            className="scroll-mt-20"
            {...(canManage
              ? {
                  action:
                    view.product === "bid" ? (
                      <StaffButton
                        size="sm"
                        variant="secondary"
                        onClick={() => actions.changeRole(person)}
                      >
                        Change role
                      </StaffButton>
                    ) : (
                      <ShopStaffAccessControl
                        userId={person.id}
                        userName={person.name}
                        currentRole={shopRole}
                      />
                    ),
                }
              : {})}
          >
            <KeyValueList
              items={[
                {
                  label: "Role",
                  value: view.role
                    ? staffRoleOnPlatformLabel(view.product, view.role)
                    : "No access",
                },
                ...(view.pending
                  ? [{ label: "Waiting", value: pendingChangeLabel(view.product, view.pending) }]
                  : []),
                ...(view.updatedAt
                  ? [
                      {
                        label: "Last changed",
                        value: <StaffDate value={view.updatedAt} withTime />,
                      },
                    ]
                  : []),
              ]}
            />
          </Section>
        );
      })}
      <RelatedRecordsSection
        id="access-history"
        title="Access history"
        description="Grants and removals on every platform."
        label="Access history"
        columns={historyColumns}
        data={history}
        getRowId={(entry) => entry.rowId}
        defaultSort={{ columnId: "at", direction: "desc" }}
        empty={{
          title: "No changes recorded yet",
          description: "Grants and removals appear here with who made them.",
        }}
      />
      {actions.dialogs}
    </>
  );
}
