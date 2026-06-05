"use client";

import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import {
  cancelTelephoneBooking,
  fetchTelephoneBookingDetail,
  requestTelephoneBookingLimitIncrease,
} from "@/lib/telephone/telephone-booking-api";
import type { TelephoneBookingDetail } from "@/lib/telephone/telephone-booking-types";
import { telephoneBookingStatusLabel } from "@/lib/telephone/telephone-booking-types";
import { formatDateTime, formatMoney } from "@/lib/ui/format";
import { notify } from "@/lib/ui/notify";
import { Badge } from "@auction/ui/components/badge";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

const LIVE_POLL_MS = 10_000;

type Props = {
  bookingId: string;
};

function shouldPollBooking(status: TelephoneBookingDetail["status"]): boolean {
  return status === "confirmed" || status === "in_progress";
}

export function TelephoneBidDetailContent({ bookingId }: Props) {
  const router = useRouter();
  const [booking, setBooking] = useState<TelephoneBookingDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [limitAmount, setLimitAmount] = useState("");
  const [pending, startTransition] = useTransition();

  const loadDetail = useCallback(async () => {
    const detail = await fetchTelephoneBookingDetail(bookingId);
    if (!detail) {
      setLoadError("Booking not found or you do not have access.");
      return null;
    }
    setLoadError(null);
    setBooking(detail);
    return detail;
  }, [bookingId]);

  useEffect(() => {
    let cancelled = false;
    void loadDetail().then((detail) => {
      if (cancelled && detail) return;
    });
    return () => {
      cancelled = true;
    };
  }, [loadDetail]);

  useEffect(() => {
    if (!booking || !shouldPollBooking(booking.status)) return;
    const id = window.setInterval(() => {
      void loadDetail();
    }, LIVE_POLL_MS);
    return () => window.clearInterval(id);
  }, [booking, loadDetail]);

  if (loadError) {
    return (
      <DashboardSliceErrorAlert
        failure={{
          slice: "telephoneBids",
          code: null,
          status: 404,
          title: "Could not load booking",
          message: loadError,
          actions: [{ kind: "navigate", label: "Back to list", href: "/dashboard/telephone-bids" }],
        }}
      />
    );
  }

  if (!booking) {
    return <p className="font-body text-sm text-on-surface-variant">Loading booking…</p>;
  }

  const canRequestIncrease =
    (booking.status === "confirmed" || booking.status === "in_progress") &&
    booking.limitIncreaseRequestedAt == null;
  const canCancel = booking.status === "requested";
  const linkedBids = booking.linkedBids ?? [];
  const isLive = shouldPollBooking(booking.status);

  const onLimitIncrease = () => {
    const amount = Number.parseFloat(limitAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      notify.error("Enter a valid amount");
      return;
    }
    startTransition(async () => {
      const result = await requestTelephoneBookingLimitIncrease(bookingId, amount);
      if (!result.ok) {
        notify.error(result.message);
        return;
      }
      setBooking((prev) => (prev ? { ...prev, ...result.booking } : prev));
      setLimitAmount("");
      notify.success("Limit increase requested");
      router.refresh();
    });
  };

  const onCancel = () => {
    startTransition(async () => {
      const result = await cancelTelephoneBooking(bookingId);
      if (!result.ok) {
        notify.error(result.message);
        return;
      }
      setBooking((prev) => (prev ? { ...prev, ...result.booking } : prev));
      notify.success("Booking cancelled");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border-hairline bg-surface-container-lowest p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-headline text-lg font-semibold text-on-surface">
              {booking.saleTitle ?? "Onsite sale"}
            </p>
            <p className="mt-1 font-body text-sm text-on-surface-variant">
              Requested {formatDateTime(booking.createdAt)}
            </p>
            {isLive ? (
              <p className="mt-1 font-body text-xs text-on-surface-variant">
                Standing refreshes every 10 seconds while your line is active.
              </p>
            ) : null}
          </div>
          <Badge variant="secondary">{telephoneBookingStatusLabel(booking.status)}</Badge>
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2 font-body text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-on-surface-variant">Phone</dt>
            <dd className="mt-1 text-on-surface">{booking.phoneE164}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-on-surface-variant">
              Authorized max
            </dt>
            <dd className="mt-1 text-on-surface">
              {booking.authorizedMax ? formatMoney(booking.authorizedMax) : "Not set"}
            </dd>
          </div>
          {booking.limitIncreaseRequestedAt ? (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wider text-on-surface-variant">
                Limit increase pending
              </dt>
              <dd className="mt-1 text-on-surface">
                {booking.limitIncreaseAmount
                  ? formatMoney(booking.limitIncreaseAmount)
                  : "Awaiting staff approval"}
              </dd>
            </div>
          ) : null}
          {booking.buyerNotes ? (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wider text-on-surface-variant">
                Your notes
              </dt>
              <dd className="mt-1 text-on-surface">{booking.buyerNotes}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <div className="rounded-xl border border-border-hairline bg-surface-container-lowest p-6">
        <h2 className="font-headline text-base font-semibold text-on-surface">
          Bids on your behalf
        </h2>
        {linkedBids.length === 0 ? (
          <p className="mt-3 font-body text-sm text-on-surface-variant">
            No telephone bids placed yet. Your clerk will bid for you during the live call.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border-hairline">
            {linkedBids.map((bid) => (
              <li key={bid.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-body text-sm text-on-surface tabular-nums">
                    {formatMoney(bid.amount)}
                  </p>
                  <p className="font-body text-xs text-on-surface-variant">
                    {formatDateTime(bid.createdAt)}
                  </p>
                </div>
                <Badge variant={bid.isWinning ? "default" : "secondary"}>
                  {bid.isWinning ? "Winning" : "Outbid"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canRequestIncrease ? (
        <div className="rounded-xl border border-border-hairline bg-surface-container-lowest p-6 space-y-3">
          <h2 className="font-headline text-base font-semibold text-on-surface">
            Request limit increase
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="limit-increase-amount">New authorized maximum</Label>
              <Input
                id="limit-increase-amount"
                value={limitAmount}
                onChange={(e) => setLimitAmount(e.target.value)}
                placeholder="e.g. 10000"
                className="w-48"
              />
            </div>
            <Button type="button" disabled={pending} onClick={onLimitIncrease}>
              {pending ? "Submitting…" : "Request increase"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/telephone-bids">Back to list</Link>
        </Button>
        {canCancel ? (
          <Button variant="secondary" size="sm" disabled={pending} onClick={onCancel}>
            Cancel booking
          </Button>
        ) : null}
      </div>
    </div>
  );
}
