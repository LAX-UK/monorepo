"use client";

import { AuditTimeline } from "@/components/admin/audit/audit-timeline";
import { ExportButton } from "@/components/exports/export-button";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import {
  type SubmissionDetailRow,
  buildSubmissionOverviewViewModel,
} from "@/lib/data/view-models/submission-overview.vm";
import { resolveMediaSrc } from "@/lib/media/resolve-media-src";
import {
  DetailColumns,
  IssueList,
  type KeyValueItem,
  KeyValueList,
  Notice,
  RecordImage,
  Section,
  StaffDate,
  type StaffLinkComponent,
  StaffMoney,
  StatGrid,
  TextLink,
  parsePoundsToPence,
} from "@auction/staff-ui";
import type { ItemSubmission } from "@auction/types";
import Link from "next/link";
import { useMemo } from "react";

const NextLink: StaffLinkComponent = Link;

type Props = {
  submissionId: string;
  submission: ItemSubmission;
  documentCount: number;
  avgQueueAgeDays?: number | null;
  categories?: { id: string; name: string }[];
  activityEvents?: readonly AdminDomainEventRow[];
};

function pence(amount: string | null | undefined): number | null {
  if (!amount?.trim()) return null;
  const parsed = parsePoundsToPence(amount);
  return parsed.ok ? parsed.pence : null;
}

function toItems(rows: SubmissionDetailRow[]): KeyValueItem[] {
  return rows.map((row) => ({
    label: row.label,
    value: row.value ? <span className="whitespace-pre-line">{row.value}</span> : null,
  }));
}

/**
 * The submission at a glance: how long it has waited and its documents, what is missing or waiting
 * on staff, the work as the seller described it, its pictures and price; recent activity and the
 * record's dates in the rail.
 */
export function SubmissionOverviewTab({
  submissionId,
  submission: s,
  documentCount,
  avgQueueAgeDays = null,
  categories = [],
  activityEvents = [],
}: Props) {
  const vm = useMemo(
    () =>
      buildSubmissionOverviewViewModel({
        submissionId,
        submission: s,
        documentCount,
        avgQueueAgeDays,
        categories,
      }),
    [submissionId, s, documentCount, avgQueueAgeDays, categories],
  );

  const rail = (
    <>
      <Section
        title="Activity"
        action={
          <ExportButton
            entityType="domain-events"
            filters={{ aggregateType: "submission", aggregateId: submissionId }}
          />
        }
      >
        <AuditTimeline
          label="Submission activity"
          events={activityEvents}
          empty="No activity recorded yet."
        />
      </Section>
      <Section title="Record">
        <KeyValueList
          items={[
            { label: "Submission ID", value: s.id, copyValue: s.id },
            { label: "Submitted", value: <StaffDate value={s.createdAt} withTime /> },
            { label: "Updated", value: <StaffDate value={s.updatedAt} withTime /> },
            ...(s.reviewedAt
              ? [{ label: "Reviewed", value: <StaffDate value={s.reviewedAt} withTime /> }]
              : []),
            ...(s.reviewNotes?.trim()
              ? [
                  {
                    label: "Review notes",
                    value: <span className="whitespace-pre-line">{s.reviewNotes}</span>,
                  },
                ]
              : []),
          ]}
        />
      </Section>
    </>
  );

  return (
    <DetailColumns rail={rail} railLabel="Submission activity">
      {s.status === "rejected" && s.rejectionReason?.trim() ? (
        <Notice tone="danger" title="Rejected">
          {s.rejectionReason}
        </Notice>
      ) : null}
      <StatGrid
        label="Submission numbers"
        className="grid-cols-2 md:grid-cols-2"
        items={vm.stats}
      />
      <IssueList Link={NextLink} items={vm.issues} allClear={null} />
      <Section title="The work" description="As the seller described it.">
        <KeyValueList items={toItems(vm.artworkRows)} />
      </Section>
      <Section title="Size and signature">
        <KeyValueList items={toItems(vm.dimensionRows)} />
      </Section>
      <Section title="Price" description="What the seller is asking.">
        <KeyValueList
          items={[
            {
              label: "Asking price",
              value: <StaffMoney minor={pence(s.askingPrice)} />,
              numeric: true,
            },
            {
              label: "Reserve",
              value: <StaffMoney minor={pence(s.reservePrice)} />,
              numeric: true,
            },
          ]}
        />
      </Section>
      <Section
        title="Images"
        description={
          s.images.length > 0
            ? `${s.images.length} ${s.images.length === 1 ? "image" : "images"} supplied.`
            : undefined
        }
      >
        {s.images.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {s.images.map((src, index) => (
              <li key={src}>
                <TextLink href={src} external className="mb-1">
                  Image {index + 1}
                </TextLink>
                <RecordImage
                  src={resolveMediaSrc(src) ?? src}
                  alt={`${s.title}, image ${index + 1}`}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-staff-sm text-staff-muted">The seller supplied no images.</p>
        )}
      </Section>
      {s.submitterNotes?.trim() ? (
        <Section title="Seller notes">
          <p className="whitespace-pre-line text-staff-sm text-staff-fg">{s.submitterNotes}</p>
        </Section>
      ) : null}
      {categories.length > 0 ? (
        <Section title="Categories">
          <ul className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <li key={category.id}>
                <TextLink Link={NextLink} href={`/admin/categories/${category.id}`}>
                  {category.name}
                </TextLink>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </DetailColumns>
  );
}
