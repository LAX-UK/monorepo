"use client";

import { minNextBidAmount, useClerkLotLiveBidState } from "@/hooks/use-clerk-lot-live-price";
import {
  adminPaddlePlaceBidResultAction,
  adminTelephonePlaceBidResultAction,
} from "@/lib/actions/admin";
import type {
  AdminPaddleRosterEntry,
  AdminTelephoneBookingRow,
} from "@/lib/data/http/admin.server";
import { formatLotRunListLabel } from "@/lib/saleroom/sort-lots-for-run-list";
import { formatMoney } from "@/lib/ui/format";
import { notify } from "@/lib/ui/notify";
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
import { useMemo, useState, useTransition } from "react";

type Props = {
  saleId: string;
  currentLotId: string | null;
  lots: Lot[];
  telephoneBookings: AdminTelephoneBookingRow[];
  paddleRoster?: AdminPaddleRosterEntry[];
};

export function LotOnBlockPanel({
  saleId,
  currentLotId,
  lots,
  telephoneBookings,
  paddleRoster = [],
}: Props) {
  const [amount, setAmount] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [paddleNumber, setPaddleNumber] = useState("");
  const [pending, startTransition] = useTransition();

  const currentLot = lots.find((l) => l.id === currentLotId) ?? null;
  const liveBid = useClerkLotLiveBidState(
    currentLotId,
    currentLot?.currentPrice ?? "0.00",
    paddleRoster,
  );
  const liveCurrentPrice = liveBid.currentPrice;
  const minNextBid = currentLot
    ? minNextBidAmount(liveCurrentPrice, currentLot.minBidIncrement)
    : null;

  const inProgressBookings = useMemo(() => {
    if (!currentLotId) return [];
    return telephoneBookings.filter((b) => {
      if (b.status !== "in_progress" && b.status !== "confirmed") return false;
      return b.lotIds.length === 0 || b.lotIds.includes(currentLotId);
    });
  }, [telephoneBookings, currentLotId]);

  const selectedBooking = inProgressBookings.find((b) => b.id === bookingId) ?? null;

  const parsedPaddle = Number.parseInt(paddleNumber, 10);
  const matchedPaddle = useMemo(() => {
    if (!Number.isInteger(parsedPaddle)) return null;
    return paddleRoster.find((p) => p.paddleNumber === parsedPaddle) ?? null;
  }, [paddleRoster, parsedPaddle]);

  if (!currentLotId || !currentLot) {
    return (
      <div className="rounded-lg border border-outline-variant/25 p-4">
        <h2 className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Lot on block
        </h2>
        <p className="mt-2 font-body text-sm text-secondary">
          Advance a lot to the block before placing telephone or paddle bids.
        </p>
      </div>
    );
  }

  const validateBidAmount = (parsedAmount: number): string | null => {
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return "Enter a valid bid amount";
    }
    if (minNextBid != null && parsedAmount + 1e-9 < minNextBid) {
      return `Bid must be at least ${formatMoney(minNextBid.toFixed(2))} (current ${formatMoney(liveCurrentPrice)} + increment)`;
    }
    return null;
  };

  const onPlaceTelephoneBid = () => {
    if (!selectedBooking) {
      notify.error("Select a telephone booking");
      return;
    }
    const parsedAmount = Number.parseFloat(amount);
    const amountError = validateBidAmount(parsedAmount);
    if (amountError) {
      notify.error(amountError);
      return;
    }
    startTransition(async () => {
      const result = await adminTelephonePlaceBidResultAction({
        lotId: currentLotId,
        buyerUserId: selectedBooking.userId,
        buyerLegalEntityId: selectedBooking.buyerLegalEntityId,
        amount: parsedAmount,
        telephoneBookingId: selectedBooking.id,
      });
      if (!result.ok) {
        notify.error(result.error);
        return;
      }
      notify.success("Telephone bid placed");
      setAmount("");
    });
  };

  const onPlacePaddleBid = () => {
    if (!Number.isInteger(parsedPaddle) || parsedPaddle < 100) {
      notify.error("Enter a valid paddle number (≥100)");
      return;
    }
    const parsedAmount = Number.parseFloat(amount);
    const amountError = validateBidAmount(parsedAmount);
    if (amountError) {
      notify.error(amountError);
      return;
    }
    startTransition(async () => {
      const result = await adminPaddlePlaceBidResultAction({
        saleId,
        lotId: currentLotId,
        paddleNumber: parsedPaddle,
        amount: parsedAmount,
      });
      if (!result.ok) {
        notify.error(result.error);
        return;
      }
      notify.success(`Paddle ${parsedPaddle} bid placed`);
      setAmount("");
    });
  };

  const onPaddleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onPlacePaddleBid();
    }
  };

  return (
    <div className="rounded-lg border border-outline-variant/25 p-4 space-y-6">
      <div>
        <h2 className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Lot on block
        </h2>
        <p className="mt-2 font-body text-sm text-foreground">
          {formatLotRunListLabel(currentLot)}
        </p>
        <p className="font-body text-xs text-secondary tabular-nums">
          Current {formatMoney(liveCurrentPrice)}
          {minNextBid != null ? (
            <span className="ml-2">· Min next {formatMoney(minNextBid.toFixed(2))}</span>
          ) : null}
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
              id={`paddle-num-${saleId}`}
              value={paddleNumber}
              onChange={(e) => setPaddleNumber(e.target.value)}
              onKeyDown={onPaddleKeyDown}
              placeholder="142"
              className="w-24 font-body text-sm tabular-nums"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1 min-w-[120px] flex-1">
            <Label htmlFor={`paddle-bid-amount-${saleId}`}>Amount</Label>
            <Input
              id={`paddle-bid-amount-${saleId}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={onPaddleKeyDown}
              placeholder="Hammer bid"
              className="font-body text-sm"
            />
          </div>
          <Button type="button" disabled={pending} onClick={onPlacePaddleBid}>
            {pending ? "Placing…" : "Place paddle bid"}
          </Button>
        </div>
        {matchedPaddle?.hasActiveSelfServiceSession ? (
          <Alert variant="default" className="py-2">
            <AlertDescription className="font-body text-xs">
              Warning: paddle {matchedPaddle.paddleNumber} ({matchedPaddle.displayName}) has recent
              self-service activity — confirm the bidder is not also bidding online.
            </AlertDescription>
          </Alert>
        ) : null}
        {matchedPaddle?.bidLimit ? (
          <p className="font-body text-xs text-secondary">
            Authorised limit: {formatMoney(matchedPaddle.bidLimit)}
          </p>
        ) : null}
      </div>

      {inProgressBookings.length === 0 ? (
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
            <Select value={bookingId} onValueChange={setBookingId}>
              <SelectTrigger id={`telephone-booking-${saleId}`} className="font-body text-sm">
                <SelectValue placeholder="Select booking" />
              </SelectTrigger>
              <SelectContent>
                {inProgressBookings.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.userName ?? b.userEmail ?? b.userId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" disabled={pending} onClick={onPlaceTelephoneBid}>
            {pending ? "Placing…" : "Place telephone bid"}
          </Button>
        </div>
      )}
    </div>
  );
}
