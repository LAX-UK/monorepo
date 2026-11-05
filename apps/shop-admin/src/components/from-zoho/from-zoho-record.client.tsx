"use client";

import { ConflictCard } from "@/components/from-zoho/conflict-card.client";
import {
  useCanOfferOnLaxArt,
  useOfferOnLaxArt,
} from "@/components/from-zoho/use-offer-on-lax-art.client";
import { whereItIsLine } from "@/server/domain/where-it-is.vm";
import {
  CONFLICT_FIELD_LABEL,
  RESOLUTION_LABEL,
  ZOHO_QUEUE_PATH,
  buildRegisterTimeline,
  kindLabel,
  laxArtOfferAvailability,
  missingSummary,
  presentConflictValue,
} from "@/server/domain/zoho-register.vm";
import type { AdminRegisterDetail } from "@auction/shop-contracts";
import {
  DetailPage,
  KeyValueList,
  MetaItem,
  Notice,
  type OverflowAction,
  OverflowMenu,
  Section,
  StaffBreadcrumbs,
  StaffButton,
  StaffDate,
  type StaffLinkComponent,
  Timeline,
  WhereItIsChip,
  WhereItIsSection,
  toast,
} from "@auction/staff-ui";
import { Copy, ExternalLink, Globe, MoveRight } from "@auction/staff-ui/icons";
import Link from "next/link";

const NextLink: StaffLinkComponent = Link;

const imagesLine = (count: number) =>
  count === 0 ? "None yet" : `${count} ${count === 1 ? "image" : "images"}`;

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error(`Could not copy the ${what.toLowerCase()}`);
  }
}

/**
 * One artwork that came in from Zoho. Where it is comes first, because it is what staff come to
 * act on: they offer the artwork on lax.art from here, which makes a draft and opens it. The
 * catalogue details are read-only, because Zoho owns them: "Edit in Zoho" opens the Product.
 * Conflicts sit before everything else, since they are the one thing that needs a person; decided
 * ones stay below, and the rail holds the history.
 */
export function FromZohoRecord({
  detail,
  zohoUrl,
}: {
  detail: AdminRegisterDetail;
  /** The Product's page in Zoho; null when no CRM address is set. */
  zohoUrl: string | null;
}) {
  const open = detail.conflicts.filter((conflict) => conflict.status === "open");
  const decided = detail.conflicts.filter((conflict) => conflict.status === "resolved");
  const missing = missingSummary(detail.missing);
  const timeline = buildRegisterTimeline(detail.events);

  const canOffer = useCanOfferOnLaxArt();
  const offerOnLaxArt = useOfferOnLaxArt({ registerId: detail.registerId, title: detail.title });
  const availability = laxArtOfferAvailability(detail);
  const isPrint = detail.kind !== "original";
  const line = whereItIsLine(detail.whereItIs, {
    isPrint,
    draftCreatedAt: detail.laxArt?.createdAt ?? null,
  });
  // Zoho's own Sold or Reserved: the place says "Not offered", so the notice says why not.
  const heldByZoho =
    availability.kind === "blocked" &&
    (detail.whereItIs.key === "not_offered" || detail.whereItIs.key === "withdrawn");

  const offerButton = (variant: "primary" | "secondary") =>
    availability.kind === "offer" ? (
      <StaffButton variant={variant} icon={<Globe aria-hidden />} onClick={offerOnLaxArt.start}>
        Offer on lax.art…
      </StaffButton>
    ) : availability.kind === "blocked" ? (
      <StaffButton
        variant={variant}
        icon={<Globe aria-hidden />}
        disabledReason={availability.reason}
      >
        Offer on lax.art…
      </StaffButton>
    ) : null;
  const openButton = (variant: "primary" | "secondary") =>
    availability.kind === "open" ? (
      <StaffButton variant={variant} icon={<MoveRight aria-hidden />} asChild>
        <Link href={availability.href}>Open on lax.art</Link>
      </StaffButton>
    ) : null;

  const copyActions: OverflowAction[] = [
    {
      id: "copy-stock-code",
      label: "Copy stock code",
      icon: Copy,
      onSelect: () => void copy(detail.stockCode, "Stock code"),
    },
    {
      id: "copy-zoho-product",
      label: "Copy Zoho product id",
      icon: Copy,
      onSelect: () => void copy(detail.zohoProductId, "Zoho product id"),
    },
  ];

  return (
    <>
      <DetailPage
        breadcrumbs={
          <StaffBreadcrumbs
            Link={NextLink}
            items={[{ label: "From Zoho", href: ZOHO_QUEUE_PATH }, { label: detail.title }]}
          />
        }
        title={detail.title}
        status={isPrint ? undefined : <WhereItIsChip chip={detail.whereItIs.chip} />}
        meta={
          <>
            <MetaItem label="Stock code">{detail.stockCode}</MetaItem>
            <MetaItem label="Artist">{detail.artistName}</MetaItem>
            <MetaItem label="Zoho last edited">
              <StaffDate value={detail.zohoModifiedAt} />
            </MetaItem>
          </>
        }
        primaryAction={
          canOffer
            ? availability.kind === "open"
              ? openButton("primary")
              : offerButton("primary")
            : null
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
        overflow={<OverflowMenu actions={copyActions} />}
        editRequires="artwork_register.review"
        resource="this artwork"
        notice={
          missing || heldByZoho ? (
            <div className="flex flex-col gap-3">
              {heldByZoho && availability.kind === "blocked" ? (
                <Notice tone="warning" title="This artwork can't go on lax.art yet">
                  {availability.reason}
                </Notice>
              ) : null}
              {missing ? (
                <Notice tone="warning" title={missing}>
                  Add what is missing in Zoho. It arrives here by itself.
                </Notice>
              ) : null}
            </div>
          ) : null
        }
        rail={
          <Section title="History">
            <Timeline label="Artwork history" events={timeline} />
          </Section>
        }
        railLabel="History"
      >
        {open.map((conflict) => (
          <ConflictCard key={conflict.conflictId} conflict={conflict} />
        ))}

        <WhereItIsSection
          chip={detail.whereItIs.chip}
          lead={line.lead}
          {...(line.trail ? { trail: line.trail } : {})}
          {...(line.note ? { note: line.note } : {})}
          actions={
            canOffer ? (
              <>
                {offerButton("secondary")}
                {openButton("secondary")}
              </>
            ) : undefined
          }
        />

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
                    In Zoho: {presentConflictValue(conflict.field, conflict.zohoValue) ?? "Empty"} ·
                    In LAX: {presentConflictValue(conflict.field, conflict.laxValue) ?? "Empty"}
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
      {offerOnLaxArt.dialog}
    </>
  );
}
