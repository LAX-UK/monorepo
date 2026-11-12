"use client";

import { markDealArtworkSoldAction } from "@/lib/actions/admin/admin-private-sales";
import {
  MARK_SOLD_SUCCESS,
  settlementNotice,
} from "@/lib/admin/private-sales/settlement-follow-up.vm";
import type { DealRecord } from "@/lib/data/http/admin-private-sales.schema";
import { notify } from "@/lib/ui/notify";
import {
  Notice,
  StaffButton,
  StaffButtonLink,
  type StaffLinkComponent,
  formatStaffDateTime,
} from "@auction/staff-ui";
import { RotateCw } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const NextLink: StaffLinkComponent = Link;

type Props = {
  deal: DealRecord;
  /** The action behind "Try again"; replaced in tests. */
  markSold?: typeof markDealArtworkSoldAction;
};

/**
 * A settled deal whose artwork the register doesn't show as sold. While the register has nothing
 * against it, "Try again" repeats the step (safe to repeat). When it shows the artwork somewhere
 * else the notice turns urgent and names the next step instead: LAX never moves the record then.
 */
export function SettlementFollowUpNotice({ deal, markSold = markDealArtworkSoldAction }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const followUp = deal.settlementFollowUp;
  if (!followUp) return null;

  const view = settlementNotice(deal, followUp, formatStaffDateTime);

  async function tryAgain() {
    setBusy(true);
    setFailure(null);
    const result = await markSold(deal.reference).catch(() => null);
    setBusy(false);
    if (result?.ok) {
      notify.success(MARK_SOLD_SUCCESS(deal.reference));
      router.refresh();
      return;
    }
    setFailure(result ? result.error : "Nothing was changed. Try again in a moment.");
    // The register may now show it elsewhere: reload so the notice says so in its own words.
    if (result?.errorCode === "artwork_unavailable") router.refresh();
  }

  const external = view.link && !view.link.href.startsWith("/");
  return (
    <Notice
      tone={view.tone}
      alert
      title={view.title}
      actions={
        view.canRetry ? (
          <StaffButton
            variant="secondary"
            size="sm"
            icon={<RotateCw aria-hidden />}
            loading={busy}
            onClick={tryAgain}
          >
            Try again
          </StaffButton>
        ) : view.link ? (
          <StaffButtonLink
            variant="secondary"
            size="sm"
            href={view.link.href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : { Link: NextLink })}
          >
            {view.link.label}
          </StaffButtonLink>
        ) : undefined
      }
    >
      <p className="m-0">{view.body}</p>
      {failure ? <p className="m-0 mt-1.5 font-medium">{failure}</p> : null}
    </Notice>
  );
}
