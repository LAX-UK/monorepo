"use client";

import { ConfirmActionButton } from "@/components/dashboard/confirm-action-button";
import type { FormerMemberOpenBidRow } from "@/lib/data/http/organisation-membership.types";
import { cancelFormerMemberBidAction } from "@/lib/legal-entity/organisation-membership.actions";
import { formatDateTimeShort, formatMoney } from "@/lib/ui/format";
import { notify } from "@/lib/ui/notify";
import { Surface } from "@auction/ui/components/surface";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  legalEntityId: string;
  entityName: string;
  bids: readonly FormerMemberOpenBidRow[];
};

const KIND_LABEL: Record<FormerMemberOpenBidRow["kind"], string> = {
  auto_bid: "Automatic bid",
  absentee: "Absentee bid",
};

function lotName(bid: FormerMemberOpenBidRow): string {
  return bid.lotNumber != null ? `Lot ${bid.lotNumber} · ${bid.lotTitle}` : bid.lotTitle;
}

function BidRow({
  bid,
  legalEntityId,
  entityName,
  onError,
}: {
  bid: FormerMemberOpenBidRow;
  legalEntityId: string;
  entityName: string;
  onError: (message: string) => void;
}) {
  const router = useRouter();
  const kind = KIND_LABEL[bid.kind].toLowerCase();
  return (
    <li
      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
      data-testid={`former-member-bid-${bid.id}`}
    >
      <div className="min-w-0 space-y-0.5">
        <p className="truncate font-body text-sm font-semibold text-on-surface">{lotName(bid)}</p>
        <p className="font-body text-sm text-on-surface-variant">
          {KIND_LABEL[bid.kind]} up to {formatMoney(bid.maxAmount)} · by {bid.memberName}
        </p>
        <p className="font-body text-xs text-on-surface-variant">
          Lot closes {formatDateTimeShort(bid.endsAt)}
        </p>
      </div>
      <ConfirmActionButton
        variant="outline"
        size="sm"
        className="min-h-11 shrink-0 self-start text-error hover:text-error sm:min-h-9 sm:self-center"
        confirmTitle="Cancel this bid?"
        confirmBody={`${bid.memberName}'s ${kind} on "${bid.lotTitle}" will stop bidding for ${entityName}. Bids already placed stay in the sale. We'll email ${bid.memberName} to say it was cancelled.`}
        confirmLabel="Cancel bid"
        onConfirmed={async () => {
          const result = await cancelFormerMemberBidAction(legalEntityId, {
            kind: bid.kind,
            id: bid.id,
            memberUserId: bid.memberUserId,
          });
          if (!result.ok) {
            onError(result.error);
            return;
          }
          notify.success("Bid cancelled");
          router.refresh();
        }}
      >
        Cancel bid
      </ConfirmActionButton>
    </li>
  );
}

/**
 * Bids that people who left the organisation placed for it and that can still act: automatic
 * bids on live lots and absentee bids waiting for their sale. Removal leaves them standing; owners
 * and admins decide here, one at a time.
 */
export function FormerMemberBidsSection({ legalEntityId, entityName, bids }: Props) {
  const [error, setError] = useState<string | null>(null);
  if (bids.length === 0) return null;
  return (
    <Surface
      id="former-member-bids"
      variant="section"
      padding="none"
      className="scroll-mt-24 overflow-hidden p-0 sm:p-0"
      aria-labelledby="former-member-bids-heading"
    >
      <div className="space-y-1 p-4 sm:px-5 sm:pt-5">
        <h3
          id="former-member-bids-heading"
          className="font-headline text-base font-semibold text-on-surface"
        >
          Open bids from former members
        </h3>
        <p className="font-body text-sm text-on-surface-variant">
          These people no longer belong to {entityName}, but bids they placed for it can still bid.
          Keep them, or cancel any you don&apos;t want.
        </p>
        {error ? (
          <p role="alert" className="pt-1 font-body text-sm text-error">
            {error}
          </p>
        ) : null}
      </div>
      <ul className="divide-y divide-border-hairline border-t border-border-hairline">
        {bids.map((bid) => (
          <BidRow
            key={`${bid.kind}:${bid.id}:${bid.memberUserId}`}
            bid={bid}
            legalEntityId={legalEntityId}
            entityName={entityName}
            onError={setError}
          />
        ))}
      </ul>
    </Surface>
  );
}
