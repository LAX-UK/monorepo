"use client";

import { RelatedRecordsSection } from "@/components/admin/people/related-records-section";
import { staffIdentitySessionStatus, staffStatus } from "@/lib/admin/staff-kit-status";
import type { AdminKycSessionRow } from "@/lib/data/http/admin.server";
import type { AdminAmlScreeningRow } from "@/lib/data/http/compliance.server";
import {
  type DataColumn,
  DetailPanel,
  EmptyValue,
  type KeyValueItem,
  KeyValueList,
  StaffButton,
  StaffDate,
  StatusBadge,
} from "@auction/staff-ui";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const VERIFF_STATION_BASE =
  process.env.NEXT_PUBLIC_VERIFF_STATION_URL ?? "https://station.veriff.com";

const LINK = "underline underline-offset-2";

function verificationHref(session: AdminKycSessionRow): string {
  return `${VERIFF_STATION_BASE}/verifications/${session.providerSessionId}`;
}

function screeningLabel(screening: AdminAmlScreeningRow): string {
  return `${staffStatus("amlMatch", screening.matchStatus).label}${
    screening.reviewStatus === "pending" ? ", awaiting review" : ""
  }`;
}

function detailItems(
  session: AdminKycSessionRow,
  screening: AdminAmlScreeningRow | null,
): KeyValueItem[] {
  const nationality = [session.verifiedNationality, session.verifiedCitizenship]
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
    .join(", ");
  const idNumber = session.verifiedIdNumber
    ? session.verifiedIdNumber
    : session.verifiedIdNumberLast4
      ? `ending ${session.verifiedIdNumberLast4}`
      : null;
  const document = session.verifiedIdCountry
    ? [
        session.verifiedIdType ?? "ID",
        session.verifiedIdCountry,
        session.verifiedDocState ? `(${session.verifiedDocState})` : null,
        idNumber,
      ]
        .filter(Boolean)
        .join(" ")
    : null;
  const risk = [
    session.decisionRiskScore ? `Score ${session.decisionRiskScore}` : null,
    session.decisionIpCountry ? `IP in ${session.decisionIpCountry}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return [
    {
      label: "Verification result",
      value: session.decisionReasonLabel
        ? `${session.decisionReasonLabel}${session.decisionReasonCode != null ? ` (code ${session.decisionReasonCode})` : ""}`
        : null,
    },
    {
      label: "Verified name",
      value:
        [session.verifiedFirstName, session.verifiedLastName].filter(Boolean).join(" ") || null,
    },
    { label: "Date of birth", value: session.verifiedDateOfBirth },
    { label: "Document", value: document },
    {
      label: "Document valid",
      value:
        session.verifiedIdValidFrom || session.verifiedIdExpiry
          ? `${session.verifiedIdValidFrom ?? "—"} to ${session.verifiedIdExpiry ?? "—"}`
          : null,
    },
    { label: "Nationality", value: nationality || null },
    { label: "Gender", value: session.verifiedGender },
    { label: "Place of birth", value: session.verifiedPlaceOfBirth },
    { label: "Risk signals", value: risk || null },
    {
      label: "Watchlist screening",
      value: screening ? (
        <Link
          href={`/admin/compliance/aml?screening=${encodeURIComponent(screening.id)}`}
          className={LINK}
        >
          {screeningLabel(screening)}
        </Link>
      ) : null,
    },
    {
      label: "Veriff session ID",
      value: session.providerSessionId,
      copyValue: session.providerSessionId,
    },
  ];
}

/**
 * The identity checks (Veriff sessions) this client has been through, newest first. Selecting a
 * check opens what was verified, so personal details are not on the page until someone asks.
 */
export function AdminUserKycHistoryPanel({
  sessions,
  currentKycSessionId,
  amlScreeningBySessionId = {},
}: {
  sessions: AdminKycSessionRow[];
  currentKycSessionId?: string | null;
  amlScreeningBySessionId?: Record<string, AdminAmlScreeningRow>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = sessions.find((session) => session.id === openId) ?? null;
  const isCurrent = (session: AdminKycSessionRow) =>
    currentKycSessionId === session.providerSessionId;

  const columns: DataColumn<AdminKycSessionRow>[] = [
    {
      id: "result",
      header: "Result",
      width: "240px",
      mobile: "title",
      truncate: false,
      cell: (session) => {
        const status = staffIdentitySessionStatus(session.status);
        return (
          <span className="flex flex-wrap items-center gap-1.5">
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            {isCurrent(session) ? <StatusBadge tone="info">Current</StatusBadge> : null}
          </span>
        );
      },
    },
    {
      id: "started",
      header: "Started",
      numeric: true,
      sortable: true,
      defaultSortDirection: "desc",
      mobile: "meta",
      sortValue: (session) => Date.parse(session.createdAt),
      cell: (session) => <StaffDate value={session.createdAt} withTime />,
    },
    {
      id: "decided",
      header: "Decided",
      numeric: true,
      sortable: true,
      defaultSortDirection: "desc",
      hideBelow: "md",
      mobile: "hidden",
      sortValue: (session) => (session.decisionAt ? Date.parse(session.decisionAt) : null),
      cell: (session) => <StaffDate value={session.decisionAt} withTime />,
    },
    {
      id: "watchlist",
      header: "Watchlist",
      hideBelow: "lg",
      mobile: "hidden",
      cell: (session) => {
        const screening = amlScreeningBySessionId[session.providerSessionId];
        return screening ? (
          <span className="text-staff-muted">{screeningLabel(screening)}</span>
        ) : (
          <EmptyValue />
        );
      },
    },
    {
      id: "details",
      header: "Details",
      headerHidden: true,
      width: "128px",
      truncate: false,
      mobile: "actions",
      cell: (session) => (
        <div className="flex justify-end">
          <StaffButton size="sm" variant="ghost" onClick={() => setOpenId(session.id)}>
            View details
          </StaffButton>
        </div>
      ),
    },
  ];

  const openStatus = open ? staffIdentitySessionStatus(open.status) : null;

  return (
    <>
      <RelatedRecordsSection
        id="kyc-history"
        title="Identity checks"
        description="Each time this client has been through identity verification."
        label="Identity checks"
        columns={columns}
        data={sessions}
        getRowId={(session) => session.id}
        defaultSort={{ columnId: "started", direction: "desc" }}
        onRowOpen={(session) => setOpenId(session.id)}
        empty={{
          title: "No identity checks yet",
          description: "Checks appear here once the client starts verifying their identity.",
        }}
      />
      <DetailPanel
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) setOpenId(null);
        }}
        title="Identity check"
        {...(open ? { description: <StaffDate value={open.createdAt} withTime /> } : {})}
        status={
          open && openStatus ? (
            <StatusBadge tone={openStatus.tone}>{openStatus.label}</StatusBadge>
          ) : null
        }
        footer={
          open ? (
            <StaffButton asChild variant="secondary" icon={<ExternalLink aria-hidden />}>
              <a href={verificationHref(open)} target="_blank" rel="noopener noreferrer">
                Open in Veriff
              </a>
            </StaffButton>
          ) : null
        }
      >
        {open ? (
          <KeyValueList
            items={detailItems(open, amlScreeningBySessionId[open.providerSessionId] ?? null)}
          />
        ) : null}
      </DetailPanel>
    </>
  );
}
