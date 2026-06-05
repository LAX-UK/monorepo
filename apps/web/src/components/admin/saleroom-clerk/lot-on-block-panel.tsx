"use client";

import { adminTelephonePlaceBidResultAction } from "@/lib/actions/admin";
import type { AdminTelephoneBookingRow } from "@/lib/data/http/admin.server";
import type { AdminSaleroomSessionSnapshot } from "@/lib/data/http/admin.server";
import { formatMoney } from "@/lib/ui/format";
import { notify } from "@/lib/ui/notify";
import type { Lot } from "@auction/types";
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
  initial: AdminSaleroomSessionSnapshot;
  lots: Lot[];
  telephoneBookings: AdminTelephoneBookingRow[];
};

export function LotOnBlockPanel({ saleId, initial, lots, telephoneBookings }: Props) {
  const [amount, setAmount] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [pending, startTransition] = useTransition();

  const currentLotId = initial.session?.currentLotId ?? null;
  const currentLot = lots.find((l) => l.id === currentLotId) ?? null;

  const inProgressBookings = useMemo(() => {
    if (!currentLotId) return [];
    return telephoneBookings.filter((b) => {
      if (b.status !== "in_progress" && b.status !== "confirmed") return false;
      return b.lotIds.length === 0 || b.lotIds.includes(currentLotId);
    });
  }, [telephoneBookings, currentLotId]);

  const selectedBooking = inProgressBookings.find((b) => b.id === bookingId) ?? null;

  if (!currentLotId || !currentLot) {
    return (
      <div className="rounded-lg border border-outline-variant/25 p-4">
        <h2 className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Lot on block
        </h2>
        <p className="mt-2 font-body text-sm text-secondary">
          Advance a lot to the block before placing telephone bids.
        </p>
      </div>
    );
  }

  const onPlaceBid = () => {
    if (!selectedBooking) {
      notify.error("Select a telephone booking");
      return;
    }
    const parsedAmount = Number.parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      notify.error("Enter a valid bid amount");
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

  return (
    <div className="rounded-lg border border-outline-variant/25 p-4 space-y-4">
      <div>
        <h2 className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Lot on block
        </h2>
        <p className="mt-2 font-body text-sm text-foreground">
          {currentLot.title?.trim() || currentLot.id}
        </p>
        <p className="font-body text-xs text-secondary tabular-nums">
          Current {formatMoney(currentLot.currentPrice)}
        </p>
      </div>

      {inProgressBookings.length === 0 ? (
        <p className="font-body text-sm text-secondary">
          No confirmed telephone lines available for bidding.
        </p>
      ) : (
        <div className="space-y-3">
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
          <div className="space-y-1">
            <Label htmlFor={`telephone-bid-amount-${saleId}`}>Bid amount</Label>
            <Input
              id={`telephone-bid-amount-${saleId}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Hammer bid"
              className="font-body text-sm"
            />
          </div>
          <Button type="button" disabled={pending} onClick={onPlaceBid}>
            {pending ? "Placing…" : "Place telephone bid"}
          </Button>
        </div>
      )}
    </div>
  );
}
