"use client";

import { Button } from "@/components/ui/button";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import { TimelineStages } from "@auction/ui";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@auction/ui/components/card";
import { DrawerDetail } from "@auction/ui/components/drawer-detail";
import { StatusBadge } from "@auction/ui/components/status-badge";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

export type PortfolioLotCardVm = {
  id: string;
  title: string;
  image: string | null;
  hammerLabel: string;
  premiumLabel: string;
  totalLabel: string;
  dueLabel: string;
  settlementLabel: string;
  settlementStageIndex: number;
  medium: string | null;
  dimensions: string | null;
  paymentStatus: string | null;
  checkoutHref: string;
};

type Props = {
  items: PortfolioLotCardVm[];
  /**
   * `split` (default) keeps the historical image-left / detail-right card.
   * `stacked` (mockup parity) renders image on top + 3-col hammer/premium/total
   * + a single primary "Complete checkout" CTA. Drawer detail is unchanged.
   */
  variant?: "split" | "stacked";
};

export function PortfolioLotGrid({ items, variant = "split" }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const active = useMemo(() => items.find((i) => i.id === openId) ?? null, [items, openId]);
  const isStacked = variant === "stacked";

  return (
    <>
      <ul className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {items.map((row) => (
          <li key={row.id}>
            <Card
              className={
                isStacked
                  ? "group flex h-full flex-col overflow-hidden border border-outline-variant/15 p-0 shadow-sm transition-colors hover:border-primary/25 hover:bg-surface-container-low/20"
                  : "group grid h-full overflow-hidden border border-outline-variant/15 p-0 shadow-sm transition-colors hover:border-primary/25 hover:bg-surface-container-low/20 sm:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.2fr)]"
              }
            >
              <Link href={row.checkoutHref} className="block">
                <div
                  className={
                    isStacked
                      ? "relative aspect-[16/9] w-full bg-surface-container-low"
                      : "relative h-full min-h-72 bg-surface-container-low sm:min-h-full"
                  }
                >
                  {row.image ? (
                    <Image
                      src={row.image}
                      alt={`${row.title} — won lot artwork`}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, 40vw"
                    />
                  ) : (
                    <ImagePlaceholder label="Lot artwork" />
                  )}
                </div>
              </Link>
              <div className="flex min-w-0 flex-col">
                <CardHeader className="pb-2">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <StatusBadge
                      variant={row.paymentStatus === "captured" ? "success" : "warning"}
                      size="sm"
                    >
                      {row.settlementLabel}
                    </StatusBadge>
                    {row.paymentStatus ? (
                      <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">
                        {row.paymentStatus}
                      </span>
                    ) : null}
                  </div>
                  <CardTitle className="font-headline text-2xl font-light leading-tight group-hover:italic">
                    <Link href={row.checkoutHref} className="underline-offset-4 hover:underline">
                      {row.title}
                    </Link>
                  </CardTitle>
                  {row.medium ? (
                    <p className="mt-2 line-clamp-2 text-sm text-on-surface-variant">
                      {row.medium}
                    </p>
                  ) : null}
                </CardHeader>
                <CardContent className="flex-1 pb-2">
                  <div className="grid grid-cols-3 gap-2 rounded-xl border border-outline-variant/15 bg-surface-container-low/45 p-3">
                    <div>
                      <p className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">
                        Hammer
                      </p>
                      <p className="mt-1 font-headline text-base text-on-surface">
                        {row.hammerLabel}
                      </p>
                    </div>
                    <div>
                      <p className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">
                        Premium
                      </p>
                      <p className="mt-1 font-headline text-base text-on-surface">
                        {row.premiumLabel}
                      </p>
                    </div>
                    <div>
                      <p className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">
                        {row.dueLabel}
                      </p>
                      <p className="mt-1 font-headline text-base text-on-surface">
                        {row.totalLabel}
                      </p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/10 pt-3">
                  <Button
                    type="button"
                    variant="secondary"
                    className="px-4 py-2 font-label text-xs uppercase tracking-widest"
                    onClick={() => setOpenId(row.id)}
                  >
                    Details
                  </Button>
                  {row.paymentStatus !== "captured" ? (
                    <Button
                      variant="primary"
                      className="px-4 py-2 font-label text-xs uppercase tracking-widest"
                      asChild
                    >
                      <Link href={row.checkoutHref}>Complete checkout</Link>
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      className="px-4 py-2 font-label text-xs uppercase tracking-widest"
                      asChild
                    >
                      <Link href={row.checkoutHref}>View details</Link>
                    </Button>
                  )}
                </CardFooter>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <DrawerDetail
        open={active != null}
        onOpenChange={(o) => {
          if (!o) setOpenId(null);
        }}
        title={active?.title ?? ""}
        {...(active
          ? { description: `${active.settlementLabel} · Hammer ${active.hammerLabel}` }
          : {})}
      >
        {active ? (
          <div className="space-y-4 font-body text-sm text-on-surface-variant">
            <TimelineStages
              activeIndex={active.settlementStageIndex}
              stages={[
                { id: "inv", label: "Invoice" },
                { id: "pay", label: "Paid" },
                { id: "ship", label: "Shipping" },
                { id: "done", label: "Delivered" },
              ]}
            />
            {active.medium ? (
              <p>
                <span className="font-label text-xs uppercase tracking-widest text-on-surface">
                  Medium
                </span>
                <br />
                {active.medium}
              </p>
            ) : null}
            {active.dimensions ? (
              <p>
                <span className="font-label text-xs uppercase tracking-widest text-on-surface">
                  Dimensions
                </span>
                <br />
                {active.dimensions}
              </p>
            ) : null}
            {active.paymentStatus ? (
              <p>
                <span className="font-label text-xs uppercase tracking-widest text-on-surface">
                  Payment
                </span>
                <br />
                <span className="text-on-surface">{active.paymentStatus}</span>
              </p>
            ) : null}
            <Button variant="primary" asChild className="mt-2 w-full sm:w-auto">
              <Link href={active.checkoutHref}>Go to checkout</Link>
            </Button>
          </div>
        ) : null}
      </DrawerDetail>
    </>
  );
}
