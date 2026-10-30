"use client";

import {
  ConsolePanel,
  PanelHeading,
} from "@/features/saleroom/components/clerk-console/console-panel";
import { useClerkBidEntry } from "@/features/saleroom/hooks/use-clerk-bid-entry";
import { formatSaleroomMoney } from "@/features/saleroom/lib/format-saleroom-money";
import type { ClerkLotLiveBidState } from "@/hooks/use-clerk-lot-live-price";
import { staffRunwayLotStatus } from "@/lib/admin/staff-kit-status";
import type {
  AdminPaddleRosterEntry,
  AdminTelephoneBookingRow,
} from "@/lib/data/http/admin.server";
import { PLATFORM_DEFAULT_CURRENCY, lotChargeCurrency } from "@/lib/money/currency";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import { formatLotRunListLabel } from "@/lib/saleroom/sort-lots-for-run-list";
import { deriveReserveStatus } from "@auction/domain";
import { EnumSelect, Field, Notice, StaffButton, StatusBadge, TextInput } from "@auction/staff-ui";
import type { Lot } from "@auction/types";
import { type ReactNode, useEffect, useRef } from "react";

type Props = {
  saleId: string;
  currentLotId: string | null;
  lots: Lot[];
  telephoneBookings: AdminTelephoneBookingRow[];
  paddleRoster?: AdminPaddleRosterEntry[];
  liveBid: ClerkLotLiveBidState;
  nextLot?: Lot | null;
  sessionLive?: boolean;
  sessionStatus?: PublicSaleroomSessionStatus["status"];
  betweenLots?: boolean;
  /** The lot actions (advance, hammer, pass), docked under the bid form. */
  renderDock?: (state: { hammerPrimary: boolean }) => ReactNode;
};

const INCREMENT_MULTIPLIERS = [1, 2, 5] as const;

function incrementChipLabel(index: number, amount: number, currency: string) {
  const formatted = formatSaleroomMoney(amount, currency);
  const multiplier = INCREMENT_MULTIPLIERS[index] ?? index + 1;
  const spoken =
    index === 0 ? `Minimum bid ${formatted}` : `${multiplier} increments up, ${formatted}`;
  return { spoken, short: index === 0 ? "Min" : `+${multiplier}`, formatted };
}

/** The amounts a clerk fills in most: the minimum bid, then two and five increments above. */
function QuickAmounts({
  amounts,
  currency,
  disabled,
  onPick,
  prefix,
}: {
  amounts: readonly number[];
  currency: string;
  disabled: boolean;
  onPick: (amount: number) => void;
  prefix: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-staff-xs text-staff-muted">
        Quick amounts: minimum bid, then 2 and 5 increments up
      </p>
      <div className="flex flex-wrap gap-2">
        {amounts.map((amount, index) => {
          const chip = incrementChipLabel(index, amount, currency);
          return (
            <StaffButton
              key={`${prefix}-${amount}`}
              variant="secondary"
              size="lg"
              className="tabular-nums"
              aria-label={chip.spoken}
              disabled={disabled}
              onClick={() => onPick(amount)}
            >
              <span className="font-normal text-staff-muted">{chip.short}</span>
              {chip.formatted}
            </StaffButton>
          );
        })}
      </div>
    </div>
  );
}

function currencyMark(currency: string): string {
  return currency.toUpperCase() === "GBP" ? "£" : currency.toUpperCase();
}

export function LotOnBlockPanel({
  saleId,
  currentLotId,
  lots,
  telephoneBookings,
  paddleRoster = [],
  liveBid,
  nextLot = null,
  sessionLive = false,
  sessionStatus,
  betweenLots = false,
  renderDock,
}: Props) {
  const paddleInputRef = useRef<HTMLInputElement>(null);
  const currentLot = lots.find((l) => l.id === currentLotId) ?? null;
  const lotCurrency = currentLot ? lotChargeCurrency(currentLot) : PLATFORM_DEFAULT_CURRENCY;

  const bidEntry = useClerkBidEntry<AdminPaddleRosterEntry>({
    saleId,
    currentLotId: currentLotId ?? "",
    liveCurrentPrice: liveBid.currentPrice,
    minBidIncrement: currentLot?.minBidIncrement ?? "0.01",
    telephoneBookings,
    paddleRoster,
  });

  const isPaused = sessionStatus === "paused";
  const blockStatus = staffRunwayLotStatus("on_block");
  const biddingDisabled = isPaused || bidEntry.pending;

  useEffect(() => {
    if (currentLotId) {
      paddleInputRef.current?.focus();
    }
  }, [currentLotId]);

  if (betweenLots && sessionLive) {
    return (
      <ConsolePanel className="flex flex-col gap-4">
        <PanelHeading>Lot on block</PanelHeading>
        <p className="text-staff-sm text-staff-muted">
          Nothing is on the block. Bring the next lot up below.
        </p>
        {nextLot ? (
          <div className="rounded-staff-sm border border-staff-line-subtle bg-staff-sunken p-4">
            <p className="text-staff-xs text-staff-muted">Up next</p>
            <p className="mt-1 text-staff-lg font-semibold text-staff-fg">
              {formatLotRunListLabel(nextLot)}
            </p>
          </div>
        ) : null}
        {renderDock?.({ hammerPrimary: false })}
      </ConsolePanel>
    );
  }

  if (!currentLotId || !currentLot) {
    return (
      <ConsolePanel>
        <PanelHeading>Lot on block</PanelHeading>
        <p className="mt-2 text-staff-sm text-staff-muted">
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

  const reserveMet =
    currentLot.reservePrice != null && currentLot.reservePrice !== ""
      ? deriveReserveStatus(liveBid.currentPrice, currentLot.reservePrice).kind === "met"
      : null;

  // One primary action at a time: Place paddle bid while a bid is being entered, Hammer once
  // the form is empty and the reserve is met (no reserve counts as met once there is a bid).
  const enteringPaddleBid =
    bidEntry.state.paddleNumber.trim() !== "" || bidEntry.state.paddleAmount.trim() !== "";
  const enteringAnyBid = enteringPaddleBid || bidEntry.state.telephoneAmount.trim() !== "";
  const reserveSatisfied = reserveMet ?? (liveBid.bidCount ?? 0) > 0;
  const hammerPrimary = !enteringAnyBid && reserveSatisfied;

  return (
    <ConsolePanel className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PanelHeading>Lot on block</PanelHeading>
          {blockStatus ? (
            // Nothing is happening on the floor while the session is paused, so no pulse.
            <StatusBadge
              tone={isPaused ? "warning" : blockStatus.tone}
              live={!isPaused && (blockStatus.live ?? false)}
            >
              {blockStatus.label}
            </StatusBadge>
          ) : null}
        </div>
        <p className="text-staff-sm font-medium text-staff-fg">
          {formatLotRunListLabel(currentLot)}
        </p>
        <p className="font-staff-display text-staff-xl font-semibold text-staff-fg tabular-nums">
          {formatSaleroomMoney(liveBid.currentPrice, lotCurrency)}
        </p>
        <p className="text-staff-sm text-staff-muted tabular-nums">
          Next bid from {formatSaleroomMoney(bidEntry.incrementOptions[0] ?? 0, lotCurrency)}
          {liveBid.bidCount != null
            ? ` · ${liveBid.bidCount} ${liveBid.bidCount === 1 ? "bid" : "bids"}`
            : null}
        </p>
        {liveBid.leaderLabel ? (
          <p className="text-staff-sm text-staff-fg">
            Leading: <span className="font-medium">{liveBid.leaderLabel}</span>
            {liveBid.leaderAmount ? (
              <span className="text-staff-muted tabular-nums">
                {" "}
                at {formatSaleroomMoney(liveBid.leaderAmount, lotCurrency)}
              </span>
            ) : null}
          </p>
        ) : null}
        <p className="text-staff-sm text-staff-muted tabular-nums">
          {reserveMet === null
            ? "No reserve"
            : `Reserve ${formatSaleroomMoney(currentLot.reservePrice, lotCurrency)} · ${
                reserveMet ? "met" : "not met"
              }`}
        </p>
      </div>

      {isPaused ? <Notice tone="warning" title="Session paused — resume to place bids." /> : null}

      <div className="flex flex-col gap-3">
        <ConsoleGroupTitle>Paddle bid</ConsoleGroupTitle>
        <div className="flex flex-wrap items-start gap-3">
          <Field
            label="Paddle number"
            id={`paddle-num-${saleId}`}
            error={bidEntry.paddleRegistrationError}
            disabled={biddingDisabled}
            className="w-32"
          >
            <TextInput
              ref={paddleInputRef}
              size="lg"
              value={bidEntry.state.paddleNumber}
              onChange={(e) => bidEntry.setPaddleNumber(e.target.value)}
              onKeyDown={onPaddleKeyDown}
              placeholder="e.g. 142"
              className="tabular-nums"
              autoComplete="off"
              inputMode="numeric"
            />
            {bidEntry.registeredPaddle && !bidEntry.paddleRegistrationError ? (
              <p className="text-staff-xs text-staff-muted">
                {bidEntry.registeredPaddle.displayName ?? "Checked-in bidder"}
              </p>
            ) : null}
          </Field>
          <Field
            label="Amount"
            id={`paddle-bid-amount-${saleId}`}
            disabled={biddingDisabled}
            className="min-w-40 flex-1"
          >
            <TextInput
              size="lg"
              value={bidEntry.state.paddleAmount}
              onChange={(e) => bidEntry.setPaddleAmount(e.target.value)}
              onKeyDown={onPaddleKeyDown}
              leading={<span className="text-staff-muted">{currencyMark(lotCurrency)}</span>}
              className="tabular-nums"
              inputMode="decimal"
              autoComplete="off"
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StaffButton
            variant={enteringPaddleBid ? "primary" : "secondary"}
            size="lg"
            disabled={!bidEntry.canPlacePaddleBid || isPaused}
            loading={bidEntry.pending}
            onClick={bidEntry.placePaddleBid}
          >
            {bidEntry.pending ? "Placing…" : "Place paddle bid"}
          </StaffButton>
        </div>
        <QuickAmounts
          amounts={bidEntry.incrementOptions}
          currency={lotCurrency}
          disabled={biddingDisabled}
          onPick={(amount) => bidEntry.applyIncrement(amount, "paddle")}
          prefix="paddle"
        />
        {bidEntry.registeredPaddle?.hasActiveSelfServiceSession ? (
          <Notice
            tone="warning"
            title={`Paddle ${bidEntry.registeredPaddle.paddleNumber} has recent online activity`}
          >
            {bidEntry.registeredPaddle.displayName ?? "This bidder"} used self-service bidding
            recently. Confirm they are not also bidding online.
          </Notice>
        ) : null}
        {bidEntry.registeredPaddle?.bidLimit ? (
          <p className="text-staff-sm text-staff-muted tabular-nums">
            Authorised limit {formatSaleroomMoney(bidEntry.registeredPaddle.bidLimit, lotCurrency)}
          </p>
        ) : null}
      </div>

      {renderDock?.({ hammerPrimary })}

      {bidEntry.inProgressBookings.length === 0 ? (
        <p className="text-staff-sm text-staff-muted">No confirmed telephone lines for this lot.</p>
      ) : (
        <div className="flex flex-col gap-3 border-t border-staff-line-subtle pt-4">
          <ConsoleGroupTitle>Telephone bid</ConsoleGroupTitle>
          <Field
            label="Telephone line"
            id={`telephone-booking-${saleId}`}
            disabled={biddingDisabled}
          >
            <EnumSelect
              size="lg"
              value={bidEntry.state.bookingId || null}
              onValueChange={bidEntry.setBookingId}
              placeholder="Choose a line"
              options={bidEntry.inProgressBookings.map((b) => ({
                value: b.id,
                label: b.userName ?? b.userEmail ?? "Unnamed bidder",
              }))}
            />
          </Field>
          <Field label="Amount" id={`telephone-bid-amount-${saleId}`} disabled={biddingDisabled}>
            <TextInput
              size="lg"
              value={bidEntry.state.telephoneAmount}
              onChange={(e) => bidEntry.setTelephoneAmount(e.target.value)}
              leading={<span className="text-staff-muted">{currencyMark(lotCurrency)}</span>}
              className="tabular-nums"
              inputMode="decimal"
              autoComplete="off"
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <StaffButton
              variant="secondary"
              size="lg"
              disabled={!bidEntry.canPlaceTelephoneBid || isPaused}
              loading={bidEntry.pending}
              onClick={bidEntry.placeTelephoneBid}
            >
              {bidEntry.pending ? "Placing…" : "Place telephone bid"}
            </StaffButton>
          </div>
          <QuickAmounts
            amounts={bidEntry.incrementOptions}
            currency={lotCurrency}
            disabled={biddingDisabled}
            onPick={(amount) => bidEntry.applyIncrement(amount, "telephone")}
            prefix="telephone"
          />
        </div>
      )}
    </ConsolePanel>
  );
}

function ConsoleGroupTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-staff-sm font-semibold text-staff-fg">{children}</h3>;
}
