"use client";

import type { LotFulfilmentSnapshot } from "@/lib/data/http/payments.server";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

function headlineForFulfilment(f: LotFulfilmentSnapshot | null): {
  label: string;
  detail: string | null;
} {
  if (!f) {
    return {
      label: "Payment & fulfilment",
      detail:
        "When you pay, this strip updates automatically with collection or shipping progress.",
    };
  }
  switch (f.status) {
    case "awaiting_payment":
      return {
        label: "Awaiting payment",
        detail: "Complete checkout below when your invoice is ready.",
      };
    case "awaiting_release":
      return {
        label: "Paid — awaiting release",
        detail: "Operations will release the lot after payment is confirmed.",
      };
    case "released":
      return {
        label: "Released",
        detail:
          f.fulfilmentMethod === "shipping"
            ? "Shipping will be arranged next."
            : f.fulfilmentMethod === "collection"
              ? "You will be notified when the lot is ready to collect."
              : "Logistics will be confirmed shortly.",
      };
    case "ready_for_collection":
      return {
        label: "Ready for collection",
        detail: "Arrange pickup with the team when advised.",
      };
    case "in_transit": {
      const bits = [f.shippingCarrier, f.trackingNumber].filter(Boolean).join(" · ");
      return {
        label: "In transit",
        detail: bits || "Your shipment is on the way.",
      };
    }
    case "delivered":
      return {
        label: "Delivered",
        detail:
          f.fulfilmentMethod === "collection" && (f.collectedBy || f.collectedAt)
            ? [
                f.collectedBy ? `Collected by ${f.collectedBy}` : null,
                f.collectedAt ? new Date(f.collectedAt).toLocaleString() : null,
              ]
                .filter(Boolean)
                .join(" · ") || null
            : "Thank you — this lot is complete.",
      };
    case "cancelled":
      return { label: "Fulfilment cancelled", detail: "Contact support if this is unexpected." };
    default:
      return { label: f.status.replaceAll("_", " "), detail: null };
  }
}

type Props = {
  fulfilment: LotFulfilmentSnapshot | null;
  /** Lot id to poll; when omitted, the strip is static. */
  lotId?: string;
};

const TERMINAL_STATUSES = new Set(["delivered", "cancelled"]);

const POLL_INTERVAL_MS = 8000;
/** Stop polling after this many minutes of foreground time to avoid runaway loops. */
const POLL_TIMEOUT_MS = 30 * 60 * 1000;

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
}

async function fetchFulfilment(lotId: string): Promise<LotFulfilmentSnapshot | null> {
  const res = await fetch(`${apiBase()}/payments/me/lot/${encodeURIComponent(lotId)}/fulfilment`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { data: LotFulfilmentSnapshot | null };
  return body.data ?? null;
}

export function LotCheckoutFulfilmentStrip({ fulfilment, lotId }: Props) {
  const [snapshot, setSnapshot] = useState<LotFulfilmentSnapshot | null>(fulfilment);
  const [polling, setPolling] = useState(false);
  const startedAtRef = useRef<number>(Date.now());

  const tick = useCallback(async () => {
    if (!lotId) return;
    setPolling(true);
    try {
      const next = await fetchFulfilment(lotId);
      setSnapshot(next);
    } catch {
      /* swallow — the strip falls back to the last known snapshot. */
    } finally {
      setPolling(false);
    }
  }, [lotId]);

  useEffect(() => {
    if (!lotId) return;
    if (snapshot?.status && TERMINAL_STATUSES.has(snapshot.status)) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      if (Date.now() - startedAtRef.current > POLL_TIMEOUT_MS) {
        window.clearInterval(id);
        return;
      }
      void tick();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [lotId, snapshot?.status, tick]);

  const { label, detail } = headlineForFulfilment(snapshot);
  return (
    <div className="mb-8 flex flex-col gap-1 lg:mb-10" aria-live="polite">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
        <span className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary">
          {label}
        </span>
        {polling ? (
          <Loader2 className="size-3 animate-spin text-on-surface-variant" aria-hidden />
        ) : null}
      </div>
      {detail ? (
        <p className="pl-4 font-body text-xs leading-relaxed text-on-surface-variant">{detail}</p>
      ) : null}
    </div>
  );
}
