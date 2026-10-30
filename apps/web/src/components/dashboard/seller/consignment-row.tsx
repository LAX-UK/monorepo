"use client";

import { MediaImage } from "@/components/ui/media-image";
import type { ConsignmentRecord } from "@/lib/seller/consignment-records";
import { CONSIGNMENT_STATUS } from "@/lib/seller/consignment-status";
import { notify } from "@/lib/ui/notify";
import {
  InlineActionMenu,
  type InlineActionMenuItem,
  RecordRow,
  RecordRowMedia,
} from "@auction/ui";
import { Button, ButtonLink, StatusBadge } from "@auction/ui/lax";
import Link from "next/link";
import { useRouter } from "next/navigation";

async function copyReference(reference: string) {
  try {
    await navigator.clipboard.writeText(reference);
    notify.success("Reference copied");
  } catch {
    notify.error("We couldn't copy the reference");
  }
}

/** The step a row offers, or why it is held. */
export type ConsignmentRowStep = {
  label: string;
  href: string;
  /** Set while the account's state holds the step; the button stays, disabled, with the reason. */
  blockedReason: string | null;
};

/**
 * One consignment as a row: the work, its reference and who sent it, the date that matters now
 * and its estimate (or hammer), where it stands, and at most one step. The row opens the
 * consignment.
 */
export function ConsignmentRow({
  record,
  step,
}: {
  record: ConsignmentRecord;
  step: ConsignmentRowStep | null;
}) {
  const router = useRouter();
  const status = CONSIGNMENT_STATUS[record.status];
  const menu: InlineActionMenuItem[] = [
    { type: "item", label: "View consignment", onSelect: () => router.push(record.href) },
    ...(record.agreementHref
      ? [
          {
            type: "item" as const,
            label: "Download agreement (PDF)",
            onSelect: () => window.location.assign(record.agreementHref ?? ""),
          },
        ]
      : []),
    ...(record.lotHref && record.lotHref !== record.href
      ? [
          {
            type: "item" as const,
            label: "View lot",
            onSelect: () => router.push(record.lotHref ?? ""),
          },
        ]
      : []),
    ...(record.reference
      ? [
          { type: "separator" as const },
          {
            type: "item" as const,
            label: "Copy reference",
            onSelect: () => void copyReference(record.reference ?? ""),
          },
        ]
      : []),
  ];
  return (
    <RecordRow
      aria-label={`${record.title}, ${status.label}`}
      href={record.href}
      linkAs={Link}
      leading={
        <RecordRowMedia>
          <MediaImage src={record.image} alt="" sizes="48px" />
        </RecordRowMedia>
      }
      title={record.title}
      meta={[record.reference, record.sentBy ? `sent by ${record.sentBy}` : null, record.saleTitle]}
      figures={[
        {
          id: "moment",
          value: record.moment.value,
          label: record.moment.label,
          labelFirst: true,
        },
        record.price
          ? { id: "price", value: record.price.value, label: record.price.label }
          : { id: "price", value: "—", label: "estimate" },
      ]}
      aligned
      status={
        <StatusBadge tone={status.tone} shape={status.shape}>
          {status.label}
        </StatusBadge>
      }
      action={
        step ? (
          step.blockedReason ? (
            <Button size="sm" disabledReason={step.blockedReason}>
              {step.label}
            </Button>
          ) : (
            <ButtonLink
              href={step.href}
              Link={Link}
              size="sm"
              // Row steps are secondary: a list never holds the page's one primary action.
              variant="secondary"
              aria-label={`${step.label}, ${record.title}`}
            >
              {step.label}
            </ButtonLink>
          )
        ) : null
      }
      menu={<InlineActionMenu label={`More for ${record.title}`} items={menu} />}
    />
  );
}
