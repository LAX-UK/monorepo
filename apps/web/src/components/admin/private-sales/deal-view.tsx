"use client";

import { enquiryHref } from "@/lib/admin/enquiries/enquiries-search";
import { DEALS_PATH, DEAL_ACTION_COPY } from "@/lib/admin/private-sales/private-sales.vm";
import type { DealRecord } from "@/lib/data/http/admin-private-sales.schema";
import { copyToClipboard } from "@/lib/ui/copy-to-clipboard";
import { notify } from "@/lib/ui/notify";
import {
  DetailPage,
  MetaItem,
  Notice,
  OverflowMenu,
  Section,
  StaffBreadcrumbs,
  StaffButton,
  type StaffLinkComponent,
  Timeline,
  formatStaffMoney,
} from "@auction/staff-ui";
import { Copy, PencilLine, UserRoundPlus } from "@auction/staff-ui/icons";
import type { StaffDealAction } from "@auction/validators";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { DealActionDialog } from "./deal-action-dialog";
import { DealArtworkDialog, type DealArtworkMode } from "./deal-artwork-dialog";
import { DealArtworkSection } from "./deal-artwork-section";
import { DealStageBadge } from "./deal-cells";
import {
  ClosedNotice,
  DocumentsSection,
  MoneySection,
  PartiesSection,
  PolicyNotice,
  TermsSection,
  dealTimeline,
} from "./deal-sections";
import { DealTermsDialog } from "./deal-terms-dialog";
import { NameBuyerDialog } from "./name-buyer-dialog";
import { RemoveDealArtworkDialog } from "./remove-deal-artwork-dialog";

const NextLink: StaffLinkComponent = Link;

/** The next step in a deal's life, in the order they happen; the first one on offer leads. */
const FORWARD: readonly StaffDealAction[] = [
  "open_offer",
  "agree",
  "issue_invoice",
  "release",
  "clear",
];

type Dialog =
  | { kind: "action"; action: StaffDealAction }
  | { kind: "terms" }
  | { kind: "buyer" }
  | { kind: "artwork"; mode: DealArtworkMode }
  | { kind: "remove_artwork" };

/**
 * One private sale on the staff record page: its stage and the one next move, then the money, the
 * terms, the documents, both parties with their checks, and the history. A move that is off says
 * why, in words, and stays off until the reasons are gone; the checks are read from the existing
 * records and decided in Compliance, never here.
 */
export function DealView({ deal }: { deal: DealRecord }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const blockersId = useId();
  const reload = () => router.refresh();

  const offered = new Map(deal.actions.map((a) => [a.action, a]));
  const next = FORWARD.find((action) => offered.has(action));
  const nextState = next ? offered.get(next) : undefined;
  const blocked = nextState && nextState.blockers.length > 0;
  const canEdit = deal.editableTerms.length > 0;
  const canWorkOnArtwork = deal.artworkAccess.canLink || deal.artworkAccess.canChange;
  const readOnly = deal.actions.length === 0 && !canEdit && !deal.canNameBuyer && !canWorkOnArtwork;

  const overflowActions = [
    ...(["clear", "record_bank_transfer", "refund", "record_bank_refund", "cancel"] as const)
      .filter((action) => offered.has(action) && action !== next)
      .map((action) => {
        const state = offered.get(action);
        const reason = state?.blockers[0]?.message;
        return {
          id: action,
          label: DEAL_ACTION_COPY[action].label,
          ...(action === "cancel" || action === "refund" ? { tone: "danger" as const } : {}),
          ...(reason ? { disabled: true, disabledReason: reason } : {}),
          onSelect: () => setDialog({ kind: "action", action }),
        };
      }),
  ];

  const primary = next ? (
    <StaffButton
      variant="primary"
      disabled={Boolean(blocked)}
      {...(blocked ? { "aria-describedby": blockersId } : {})}
      onClick={() => setDialog({ kind: "action", action: next })}
    >
      {DEAL_ACTION_COPY[next].label}
    </StaffButton>
  ) : undefined;

  const secondary = (
    <>
      {deal.canNameBuyer ? (
        <StaffButton
          variant="secondary"
          icon={<UserRoundPlus aria-hidden />}
          onClick={() => setDialog({ kind: "buyer" })}
        >
          {deal.buyer ? "Change buyer" : "Name the buyer"}
        </StaffButton>
      ) : null}
      {canEdit ? (
        <StaffButton
          variant="secondary"
          icon={<PencilLine aria-hidden />}
          onClick={() => setDialog({ kind: "terms" })}
        >
          Edit terms
        </StaffButton>
      ) : null}
    </>
  );

  const notice = (
    <div className="flex flex-col gap-3">
      <ClosedNotice deal={deal} />
      <PolicyNotice deal={deal} />
      {blocked && next ? (
        <Notice tone="info" title={`Before you can ${DEAL_ACTION_COPY[next].label.toLowerCase()}`}>
          <ul id={blockersId} className="m-0 list-disc pl-5">
            {nextState.blockers.map((blocker) => (
              <li key={`${blocker.code}-${blocker.party ?? ""}`}>{blocker.message}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
    </div>
  );
  const hasNotice = deal.stage === "cancelled" || deal.policy.gaps.length > 0 || Boolean(blocked);

  return (
    <>
      <DetailPage
        breadcrumbs={
          <StaffBreadcrumbs
            Link={NextLink}
            items={[{ label: "Private sales", href: DEALS_PATH }, { label: deal.reference }]}
          />
        }
        title={`${deal.reference} · ${deal.work.title}`}
        status={<DealStageBadge stage={deal.stage} />}
        meta={
          <>
            <MetaItem label="Work">{deal.work.reference}</MetaItem>
            {deal.artwork ? <MetaItem label="Stock code">{deal.artwork.stockCode}</MetaItem> : null}
            {deal.priceMinor !== null ? (
              <MetaItem label="Price">{formatStaffMoney(deal.priceMinor)}</MetaItem>
            ) : null}
            <MetaItem label="Seller">{deal.seller.displayName}</MetaItem>
            {deal.buyer ? <MetaItem label="Buyer">{deal.buyer.displayName}</MetaItem> : null}
            {deal.sourceEnquiryReference ? (
              <MetaItem label="From">
                <Link href={enquiryHref(deal.sourceEnquiryReference)}>
                  {deal.sourceEnquiryReference}
                </Link>
              </MetaItem>
            ) : null}
          </>
        }
        access={readOnly ? "read-only" : "full"}
        resource="Private sales"
        {...(primary ? { primaryAction: primary } : {})}
        secondaryActions={secondary}
        overflow={
          <OverflowMenu
            label="More private sale actions"
            Link={NextLink}
            actions={[
              {
                id: "copy-reference",
                label: "Copy reference",
                icon: Copy,
                onSelect: () => copyToClipboard(deal.reference, "Reference"),
              },
              { id: "back", label: "Back to the list", href: DEALS_PATH },
              ...overflowActions,
            ]}
          />
        }
        {...(hasNotice ? { notice } : {})}
        rail={
          <>
            <DealArtworkSection
              deal={deal}
              onLink={() => setDialog({ kind: "artwork", mode: "link" })}
              onChange={() => setDialog({ kind: "artwork", mode: "change" })}
              onRemove={() => setDialog({ kind: "remove_artwork" })}
            />
            <PartiesSection deal={deal} />
            <Section id="history" title="History" description="Each stage the deal has been in.">
              <Timeline label="Private sale history" events={dealTimeline(deal)} />
            </Section>
          </>
        }
        railLabel="Artwork, parties, checks and history"
      >
        <MoneySection deal={deal} />
        <TermsSection deal={deal} />
        <DocumentsSection deal={deal} />
      </DetailPage>

      {dialog?.kind === "action" ? (
        <DealActionDialog
          open
          onOpenChange={(open) => setDialog(open ? dialog : null)}
          deal={deal}
          action={dialog.action}
          onReload={reload}
          onDone={(action) => {
            notify.success(`${DEAL_ACTION_COPY[action].done} · ${deal.reference}`);
            reload();
          }}
        />
      ) : null}
      <DealTermsDialog
        open={dialog?.kind === "terms"}
        onOpenChange={(open) => setDialog(open ? { kind: "terms" } : null)}
        deal={deal}
        onReload={reload}
        onDone={() => {
          notify.success(`Terms saved · ${deal.reference}`);
          reload();
        }}
      />
      {dialog?.kind === "artwork" ? (
        <DealArtworkDialog
          open
          onOpenChange={(open) => setDialog(open ? dialog : null)}
          mode={dialog.mode}
          deal={deal}
          onReload={reload}
          onDone={(mode) => {
            notify.success(
              `${mode === "link" ? "Artwork held" : "Artwork changed"} · ${deal.reference}`,
            );
            reload();
          }}
        />
      ) : null}
      <RemoveDealArtworkDialog
        open={dialog?.kind === "remove_artwork"}
        onOpenChange={(open) => setDialog(open ? { kind: "remove_artwork" } : null)}
        deal={deal}
        onReload={reload}
        onDone={() => {
          notify.success(`Artwork removed · ${deal.reference}`);
          reload();
        }}
      />
      <NameBuyerDialog
        open={dialog?.kind === "buyer"}
        onOpenChange={(open) => setDialog(open ? { kind: "buyer" } : null)}
        deal={deal}
        onReload={reload}
        onDone={() => {
          notify.success(`Buyer named · ${deal.reference}`);
          reload();
        }}
      />
    </>
  );
}
