"use client";

import { SaleroomPendingSubmit } from "@/components/admin/saleroom-pending-form";
import {
  ConsolePanel,
  PanelHeading,
} from "@/features/saleroom/components/clerk-console/console-panel";
import { LotOutcomeControls } from "@/features/saleroom/components/clerk-console/lot-outcome-controls";
import { useClerkBidEntry } from "@/features/saleroom/hooks/use-clerk-bid-entry";
import type { ClerkActionPolicy } from "@/features/saleroom/types/clerk-console.types";
import type { ClerkLotLiveBidState } from "@/hooks/use-clerk-lot-live-price";
import { adminSaleroomAdvanceAction } from "@/lib/actions/admin";
import type {
  AdminPaddleRosterEntry,
  AdminTelephoneBookingRow,
} from "@/lib/data/http/admin.server";
import { formatLotRunListLabel } from "@/lib/saleroom/sort-lots-for-run-list";
import { formatMoney } from "@/lib/ui/format";
import type { Lot } from "@auction/types";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { useEffect, useRef } from "react";

type Props = {
  saleId: string;
  currentLotId: string | null;
  lots: Lot[];
  telephoneBookings: AdminTelephoneBookingRow[];
  paddleRoster?: AdminPaddleRosterEntry[];
  liveBid: ClerkLotLiveBidState;
  canHammer?: boolean;
  policy: ClerkActionPolicy;
  nextLot?: Lot | null;
  sessionLive?: boolean;
  betweenLots?: boolean;
  progressLabel?: string;
};

const INCREMENT_MULTIPLIERS = [1, 2, 5] as const;

function incrementChipLabel(index: number, amount: number): string {
  const formatted = formatMoney(amount.toFixed(2));
  if (index === 0) return `Min bid (${formatted})`;
  const multiplier = INCREMENT_MULTIPLIERS[index] ?? index + 1;
  return `+${multiplier} inc (${formatted})`;
}

export function LotOnBlockPanel({
  saleId,
  currentLotId,
  lots,
  telephoneBookings,
  paddleRoster = [],
  liveBid,
  canHammer = false,
  policy,
  nextLot = null,
  sessionLive = false,
  betweenLots = false,
  progressLabel,
}: Props) {
  const paddleInputRef = useRef<HTMLInputElement>(null);
  const currentLot = lots.find((l) => l.id === currentLotId) ?? null;

  const bidEntry = useClerkBidEntry<AdminPaddleRosterEntry>({
    saleId,
    currentLotId: currentLotId ?? "",
    liveCurrentPrice: liveBid.currentPrice,
    minBidIncrement: currentLot?.minBidIncrement ?? "0.01",
    telephoneBookings,
    paddleRoster,
  });

  useEffect(() => {
    if (currentLotId) {
      paddleInputRef.current?.focus();
    }
  }, [currentLotId]);

  if (betweenLots && sessionLive && nextLot && policy.advanceInOnBlock) {
    const advanceFormId = `saleroom-advance-hero-${saleId}`;
    return (
      <ConsolePanel className="space-y-4">
        <PanelHeading>Lot on block</PanelHeading>
        <p className="font-body text-sm text-secondary">
          {progressLabel ?? "Between lots — advance the next lot to continue."}
        </p>
        <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
          <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Up next
          </p>
          <p className="mt-2 font-headline text-lg text-foreground">
            {formatLotRunListLabel(nextLot)}
          </p>
        </div>
        <form id={advanceFormId} action={adminSaleroomAdvanceAction}>
          <input type="hidden" name="saleId" value={saleId} />
          <input type="hidden" name="lotId" value={nextLot.id} />
          <SaleroomPendingSubmit
            formId={advanceFormId}
            pendingLabel="Advancing…"
            variant="default"
            className="min-h-11 w-full"
          >
            Advance next ({formatLotRunListLabel(nextLot)})
          </SaleroomPendingSubmit>
        </form>
      </ConsolePanel>
    );
  }

  if (!currentLotId || !currentLot) {
    return (
      <ConsolePanel>
        <PanelHeading>Lot on block</PanelHeading>
        <p className="mt-2 font-body text-sm text-secondary">
          Advance a lot to the block before placing telephone or paddle bids.
        </p>
      </ConsolePanel>
    );
  }

  const onPaddleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      bidEntry.placePaddleBid();
    }
  };

  return (
    <ConsolePanel className="space-y-6">
      <div>
        <PanelHeading>Lot on block</PanelHeading>
        <p className="mt-2 font-headline text-2xl tabular-nums text-foreground transition-all duration-200">
          {formatMoney(liveBid.currentPrice)}
        </p>
        <p className="font-body text-sm text-foreground">{formatLotRunListLabel(currentLot)}</p>
        <p className="font-body text-xs text-secondary tabular-nums">
          Min next {formatMoney(bidEntry.incrementOptions[0]?.toFixed(2) ?? "0.00")}
          {liveBid.bidCount != null ? (
            <span className="ml-2">
              · {liveBid.bidCount} bid{liveBid.bidCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </p>
        {liveBid.leaderLabel ? (
          <p className="mt-1 font-body text-xs text-on-surface">
            Leading: <span className="font-medium">{liveBid.leaderLabel}</span>
            {liveBid.leaderAmount ? (
              <span className="ml-2 tabular-nums text-secondary">
                at {formatMoney(liveBid.leaderAmount)}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Paddle bid
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor={`paddle-num-${saleId}`}>Paddle #</Label>
            <Input
              ref={paddleInputRef}
              id={`paddle-num-${saleId}`}
              value={bidEntry.state.paddleNumber}
              onChange={(e) => bidEntry.setPaddleNumber(e.target.value)}
              onKeyDown={onPaddleKeyDown}
              placeholder="142"
              className="h-11 w-28 font-body text-base tabular-nums"
              autoComplete="off"
              inputMode="numeric"
              aria-invalid={bidEntry.paddleRegistrationError != null}
              aria-describedby={
                bidEntry.paddleRegistrationError ? `paddle-num-error-${saleId}` : undefined
              }
            />
            {bidEntry.paddleRegistrationError ? (
              <p
                id={`paddle-num-error-${saleId}`}
                className="font-body text-xs text-destructive"
                role="alert"
              >
                {bidEntry.paddleRegistrationError}
              </p>
            ) : null}
            {bidEntry.registeredPaddle && !bidEntry.paddleRegistrationError ? (
              <p className="font-body text-xs text-secondary">
                {bidEntry.registeredPaddle.displayName ?? "Checked-in bidder"}
              </p>
            ) : null}
          </div>
          <div className="min-w-[140px] flex-1 space-y-1">
            <Label htmlFor={`paddle-bid-amount-${saleId}`}>Amount</Label>
            <Input
              id={`paddle-bid-amount-${saleId}`}
              value={bidEntry.state.paddleAmount}
              onChange={(e) => bidEntry.setPaddleAmount(e.target.value)}
              onKeyDown={onPaddleKeyDown}
              placeholder="Hammer bid"
              className="h-11 font-body text-base"
              inputMode="decimal"
            />
          </div>
          <Button
            type="button"
            disabled={!bidEntry.canPlacePaddleBid}
            className="min-h-11"
            onClick={bidEntry.placePaddleBid}
          >
            {bidEntry.pending ? "Placing…" : "Place paddle bid"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {bidEntry.incrementOptions.map((amount, index) => (
            <Button
              key={amount}
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11 tabular-nums"
              onClick={() => bidEntry.applyIncrement(amount, "paddle")}
            >
              {incrementChipLabel(index, amount)}
            </Button>
          ))}
        </div>
        {bidEntry.registeredPaddle?.hasActiveSelfServiceSession ? (
          <Alert variant="default" className="py-2">
            <AlertDescription className="font-body text-xs">
              Warning: paddle {bidEntry.registeredPaddle.paddleNumber} (
              {bidEntry.registeredPaddle.displayName}) has recent self-service activity — confirm
              the bidder is not also bidding online.
            </AlertDescription>
          </Alert>
        ) : null}
        {bidEntry.registeredPaddle?.bidLimit ? (
          <p className="font-body text-xs text-secondary">
            Authorised limit: {formatMoney(bidEntry.registeredPaddle.bidLimit)}
          </p>
        ) : null}
      </div>

      {bidEntry.inProgressBookings.length === 0 ? (
        <p className="font-body text-sm text-secondary">
          No confirmed telephone lines for this lot.
        </p>
      ) : (
        <div className="space-y-3 border-t border-outline-variant/20 pt-4">
          <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Telephone bid
          </p>
          <div className="space-y-1">
            <Label htmlFor={`telephone-booking-${saleId}`}>Telephone line</Label>
            <Select value={bidEntry.state.bookingId} onValueChange={bidEntry.setBookingId}>
              <SelectTrigger id={`telephone-booking-${saleId}`} className="h-11 font-body text-sm">
                <SelectValue placeholder="Select booking" />
              </SelectTrigger>
              <SelectContent>
                {bidEntry.inProgressBookings.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.userName ?? b.userEmail ?? b.userId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[140px] flex-1 space-y-1">
              <Label htmlFor={`telephone-bid-amount-${saleId}`}>Amount</Label>
              <Input
                id={`telephone-bid-amount-${saleId}`}
                value={bidEntry.state.telephoneAmount}
                onChange={(e) => bidEntry.setTelephoneAmount(e.target.value)}
                placeholder="Telephone bid"
                className="h-11 font-body text-base"
                inputMode="decimal"
              />
            </div>
            <Button
              type="button"
              disabled={bidEntry.pending}
              className="min-h-11"
              onClick={bidEntry.placeTelephoneBid}
            >
              {bidEntry.pending ? "Placing…" : "Place telephone bid"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {bidEntry.incrementOptions.map((amount, index) => (
              <Button
                key={`tel-${amount}`}
                type="button"
                size="sm"
                variant="outline"
                className="min-h-11 tabular-nums"
                onClick={() => bidEntry.applyIncrement(amount, "telephone")}
              >
                {incrementChipLabel(index, amount)}
              </Button>
            ))}
          </div>
        </div>
      )}

      {policy.hammerInOnBlock ? (
        <LotOutcomeControls
          saleId={saleId}
          canHammer={canHammer}
          className="hidden border-t border-outline-variant/20 pt-4 lg:block"
        />
      ) : null}
    </ConsolePanel>
  );
}
