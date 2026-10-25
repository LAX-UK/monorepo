"use client";

import { RelatedRecordsSection } from "@/components/admin/people/related-records-section";
import {
  buildSofCaseDetailHref,
  buildSofListHref,
  normalizeSofListStatus,
} from "@/lib/admin/sof-list-query";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import type { AdminSourceOfFundsRow } from "@/lib/data/http/compliance.server";
import {
  type AdminSofTableRow,
  buildAdminSofTableRow,
} from "@/lib/data/view-models/admin-sof-table.vm";
import {
  CellLink,
  type DataColumn,
  StaffButton,
  StaffDate,
  type StaffLinkComponent,
  StatusBadge,
} from "@auction/staff-ui";
import Link from "next/link";
import { useMemo } from "react";

const NextLink: StaffLinkComponent = Link;
const CASES_SHOWN = 5;

const columns: DataColumn<AdminSofTableRow>[] = [
  {
    id: "status",
    header: "Status",
    width: "200px",
    mobile: "title",
    truncate: false,
    cell: (row) => {
      const status = staffStatus("sofCase", row.displayStatus);
      return <StatusBadge tone={status.tone}>{status.label}</StatusBadge>;
    },
  },
  {
    id: "reason",
    header: "Opened because",
    mobile: "meta",
    cell: (row) => <span className="text-staff-muted">{row.triggerLabel}</span>,
  },
  {
    id: "exposure",
    header: "Exposure",
    numeric: true,
    width: "128px",
    mobile: "meta",
    cell: (row) => row.exposureLabel,
  },
  {
    id: "opened",
    header: "Opened",
    sortable: true,
    defaultSortDirection: "desc",
    width: "176px",
    mobile: "hidden",
    sortValue: (row) => Date.parse(row.createdAt),
    cell: (row) => <StaffDate value={row.createdAt} withTime />,
  },
  {
    id: "open",
    header: "Open case",
    headerHidden: true,
    width: "96px",
    truncate: false,
    mobile: "actions",
    cell: (row) => (
      <div className="flex justify-end">
        <CellLink
          Link={NextLink}
          href={buildSofCaseDetailHref(row.id, normalizeSofListStatus(row.status))}
        >
          Open
        </CellLink>
      </div>
    ),
  },
];

/** The client's source of funds cases, newest first, each opening in the compliance queue. */
export function AdminUserSofPanel({ cases }: { cases: AdminSourceOfFundsRow[] }) {
  const rows = useMemo(() => cases.map(buildAdminSofTableRow), [cases]);
  const latest = cases[0] ?? null;
  const hasPending = cases.some((row) => row.status === "pending");
  const queueHref = latest
    ? buildSofCaseDetailHref(latest.id, normalizeSofListStatus(latest.status))
    : buildSofListHref("pending");

  return (
    <RelatedRecordsSection
      id="sof"
      title="Source of funds"
      description="Cases opened when this client's buying passes a compliance threshold."
      {...(latest
        ? {
            action: (
              <StaffButton asChild size="sm" variant="secondary">
                <Link href={queueHref}>{hasPending ? "Review case" : "View case"}</Link>
              </StaffButton>
            ),
          }
        : {})}
      label="Source of funds cases"
      columns={columns}
      data={rows.slice(0, CASES_SHOWN)}
      getRowId={(row) => row.id}
      defaultSort={{ columnId: "opened", direction: "desc" }}
      empty={{
        title: "No source of funds cases",
        description: "A case appears here if this client's buying needs a source of funds check.",
      }}
      {...(cases.length > CASES_SHOWN
        ? {
            footer: (
              <>
                Showing {CASES_SHOWN} of {cases.length} cases.{" "}
                <Link href={buildSofListHref("pending")} className="underline underline-offset-2">
                  Review cases
                </Link>
              </>
            ),
          }
        : {})}
    />
  );
}
