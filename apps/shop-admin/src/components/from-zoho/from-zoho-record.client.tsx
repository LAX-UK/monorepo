"use client";

import { ConflictCard } from "@/components/from-zoho/conflict-card.client";
import {
  CONFLICT_FIELD_LABEL,
  RESOLUTION_LABEL,
  ZOHO_QUEUE_PATH,
  buildRegisterTimeline,
  kindLabel,
  missingSummary,
  presentConflictValue,
  presentOfferState,
} from "@/server/domain/zoho-register.vm";
import type { AdminRegisterDetail } from "@auction/shop-contracts";
import {
  DetailPage,
  KeyValueList,
  MetaItem,
  Notice,
  Section,
  StaffBreadcrumbs,
  StaffButton,
  StaffDate,
  type StaffLinkComponent,
  StatusBadge,
  Timeline,
} from "@auction/staff-ui";
import { ExternalLink } from "@auction/staff-ui/icons";
import Link from "next/link";

const NextLink: StaffLinkComponent = Link;

const imagesLine = (count: number) =>
  count === 0 ? "None yet" : `${count} ${count === 1 ? "image" : "images"}`;

/**
 * One artwork that came in from Zoho. The catalogue details are read-only here, because Zoho
 * owns them: "Edit in Zoho" opens the Product. Conflicts sit first, since they are the one thing
 * that needs a person; decided ones stay below, and the rail holds the history.
 */
export function FromZohoRecord({
  detail,
  zohoUrl,
}: {
  detail: AdminRegisterDetail;
  /** The Product's page in Zoho; null when no CRM address is set. */
  zohoUrl: string | null;
}) {
  const offer = presentOfferState(detail.offerState);
  const open = detail.conflicts.filter((conflict) => conflict.status === "open");
  const decided = detail.conflicts.filter((conflict) => conflict.status === "resolved");
  const missing = missingSummary(detail.missing);

  return (
    <DetailPage
      breadcrumbs={
        <StaffBreadcrumbs
          Link={NextLink}
          items={[{ label: "From Zoho", href: ZOHO_QUEUE_PATH }, { label: detail.title }]}
        />
      }
      title={detail.title}
      status={<StatusBadge tone={offer.tone}>{offer.label}</StatusBadge>}
      meta={
        <>
          <MetaItem label="Stock code">{detail.stockCode}</MetaItem>
          <MetaItem label="Artist">{detail.artistName}</MetaItem>
          <MetaItem label="Zoho last edited">
            <StaffDate value={detail.zohoModifiedAt} />
          </MetaItem>
        </>
      }
      secondaryActions={
        zohoUrl ? (
          <StaffButton asChild variant="secondary" icon={<ExternalLink aria-hidden />}>
            <a href={zohoUrl} target="_blank" rel="noopener noreferrer">
              Edit in Zoho
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </StaffButton>
        ) : null
      }
      editRequires="artwork_register.review"
      resource="this artwork"
      notice={
        missing ? (
          <Notice tone="warning" title={missing}>
            Add what is missing in Zoho. It arrives here by itself.
          </Notice>
        ) : null
      }
      rail={
        <Section title="History">
          <Timeline label="Artwork history" events={buildRegisterTimeline(detail.events)} />
        </Section>
      }
      railLabel="History"
    >
      {open.map((conflict) => (
        <ConflictCard key={conflict.conflictId} conflict={conflict} />
      ))}

      <Section title="Catalogue" description="Edited in Zoho and kept up to date here.">
        <KeyValueList
          items={[
            { label: "Title", value: detail.title },
            { label: "Artist", value: `${detail.artistName} (${detail.artistCode})` },
            { label: "Original or print", value: kindLabel(detail.kind) },
            { label: "Stock code", value: detail.stockCode, copyValue: detail.stockCode },
            { label: "Medium", value: detail.medium },
            { label: "Size", value: detail.dimensions },
            { label: "Year", value: detail.year === null ? null : String(detail.year) },
            { label: "Images", value: imagesLine(detail.imageCount) },
            { label: "Status in Zoho", value: detail.catalogueStatus },
            {
              label: "Zoho product",
              value: detail.zohoProductId,
              copyValue: detail.zohoProductId,
            },
          ]}
        />
      </Section>

      {decided.length > 0 ? (
        <Section title="Decided" bodyClassName="p-0">
          <ul className="divide-y divide-staff-line-subtle">
            {decided.map((conflict) => (
              <li key={conflict.conflictId} className="flex flex-col gap-0.5 px-4 py-3">
                <p className="text-staff-sm font-medium text-staff-fg">
                  {CONFLICT_FIELD_LABEL[conflict.field]}:{" "}
                  {conflict.resolution ? RESOLUTION_LABEL[conflict.resolution] : "Decided"}
                </p>
                <p className="text-staff-xs text-staff-muted">
                  Zoho had {presentConflictValue(conflict.field, conflict.zohoValue) ?? "nothing"},
                  LAX had {presentConflictValue(conflict.field, conflict.laxValue) ?? "nothing"}
                  {conflict.resolvedAt ? (
                    <>
                      {" · "}
                      <StaffDate value={conflict.resolvedAt} />
                    </>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </DetailPage>
  );
}
