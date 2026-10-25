"use client";

import { stopEditionAlert } from "@/app/actions/artwork-interest.actions";
import { ShopMediaImage } from "@/components/media/shop-media-image";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import { ShopNotice } from "@/components/shop-notice";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import { FOCUS_RING } from "@auction/branding";
import type { EditionAlert } from "@auction/shop-contracts";
import { cn } from "@auction/ui";
import Link from "next/link";
import { useState, useTransition } from "react";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

function AlertRow({ alert }: { alert: EditionAlert }) {
  const [stopped, setStopped] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const href = `/artworks/${encodeURIComponent(alert.artworkSlug)}`;

  return (
    <li className="shop-alerts__row">
      <div className="shop-alerts__thumb">
        <ShopMediaImage
          src={alert.imageUrl}
          alt=""
          label={SHOP_MEDIA_LABELS.artwork}
          sizes="64px"
          className="absolute inset-0 size-full"
        />
      </div>
      <div className="min-w-0">
        <p className="shop-alerts__title">
          <Link href={href} className={cn("shop-inline-link", FOCUS_RING)}>
            {alert.artworkTitle}
          </Link>
        </p>
        <p className="shop-alerts__meta">
          {alert.artistName} · Asked on {DATE.format(new Date(alert.createdAt))}
        </p>
        {failure ? (
          <ShopNotice tone="error" className="mt-2">
            {failure}
          </ShopNotice>
        ) : null}
      </div>
      <output aria-live="polite">
        {stopped ? (
          <p className="shop-alerts__stopped">Stopped</p>
        ) : (
          <ShopCommerceButton
            type="button"
            variant="outline"
            scale="standard"
            disabled={pending}
            aria-busy={pending || undefined}
            aria-label={`Stop the alert for ${alert.artworkTitle}`}
            onClick={() => {
              setFailure(null);
              startTransition(async () => {
                const result = await stopEditionAlert(alert.id);
                if (result.ok) setStopped(true);
                else setFailure(result.message);
              });
            }}
          >
            {pending ? "Stopping…" : "Stop"}
          </ShopCommerceButton>
        )}
      </output>
    </li>
  );
}

/** Waiting edition alerts in Your orders, each with a way to stop it. */
export function ShopEditionAlertList({ alerts }: { alerts: EditionAlert[] }) {
  return (
    <ul className="shop-alerts__list">
      {alerts.map((alert) => (
        <AlertRow key={alert.id} alert={alert} />
      ))}
    </ul>
  );
}
