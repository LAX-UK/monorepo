"use client";

import { MediaImage } from "@/components/ui/media-image";
import { TimelineStages } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { DrawerDetail } from "@auction/ui/components/drawer-detail";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";
import { useMemo, useState } from "react";

export type PortfolioLotCardVm = {
  id: string;
  title: string;
  artistName: string | null;
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
  conditionReportUrl: string | null;
  endYear: number;
};

type Props = {
  items: PortfolioLotCardVm[];
  /** `split` (default) keeps the historical image-left / detail-right card.
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
          <li key={row.id} className="lift-row section-enter">
            <Surface
              variant="card"
              padding="none"
              className={
                isStacked
                  ? "group flex h-full flex-col overflow-hidden border border-border-hairline transition-colors hover:border-link/25 hover:bg-surface-container-low/20"
                  : "group grid h-full overflow-hidden border border-border-hairline transition-colors hover:border-link/25 hover:bg-surface-container-low/20 sm:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.2fr)]"
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
                  <MediaImage
                    src={row.image}
                    alt={`${row.title} — won lot artwork`}
                    label="Lot artwork"
                    imgClassName="transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, 40vw"
                  />
                </div>
              </Link>
              <div className="flex min-w-0 flex-col">
                <div className="space-y-2 p-4 pb-2">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <StatusBadge
                      variant={row.paymentStatus === "captured" ? "success" : "warning"}
                      size="sm"
                    >
                      {row.settlementLabel}
                    </StatusBadge>
                  </div>
                  <h3 className="font-headline text-2xl font-light leading-tight group-hover:italic">
                    <Link href={row.checkoutHref} className="underline-offset-4 hover:underline">
                      {row.title}
                    </Link>
                  </h3>
                  {row.artistName ? (
                    <p className="mt-1 font-label text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
                      {row.artistName}
                    </p>
                  ) : null}
                  {row.medium ? (
                    <p className="mt-2 line-clamp-2 text-sm text-on-surface-variant">
                      {row.medium}
                    </p>
                  ) : null}
                </div>
                <div className="flex-1 pb-2">
                  <div className="grid grid-cols-3 gap-2 rounded-xl border border-border-hairline bg-surface-container-low/45 p-3">
                    <div className="min-w-0">
                      <p className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">
                        Hammer
                      </p>
                      <p
                        className="mt-1 truncate font-headline text-sm tabular-nums text-on-surface sm:text-base"
                        title={row.hammerLabel}
                      >
                        {row.hammerLabel}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">
                        Premium
                      </p>
                      <p
                        className="mt-1 truncate font-headline text-sm tabular-nums text-on-surface sm:text-base"
                        title={row.premiumLabel}
                      >
                        {row.premiumLabel}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">
                        {row.dueLabel}
                      </p>
                      <p
                        className="mt-1 truncate font-headline text-sm tabular-nums text-on-surface sm:text-base"
                        title={row.totalLabel}
                      >
                        {row.totalLabel}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-hairline p-4 pt-3">
                  <Button
                    type="button"
                    variant="secondaryOutline"
                    className="px-4 py-2 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
                    onClick={() => setOpenId(row.id)}
                  >
                    Details
                  </Button>
                  {row.paymentStatus !== "captured" ? (
                    <Button
                      variant="primary"
                      className="px-4 py-2 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
                      asChild
                    >
                      <Link href={row.checkoutHref}>Complete checkout</Link>
                    </Button>
                  ) : (
                    <Button
                      variant="secondaryOutline"
                      className="px-4 py-2 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
                      asChild
                    >
                      <Link href={row.checkoutHref}>View details</Link>
                    </Button>
                  )}
                </div>
              </div>
            </Surface>
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
            {active.artistName ? (
              <p>
                <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface">
                  Artist
                </span>
                <br />
                {active.artistName}
              </p>
            ) : null}
            {active.medium ? (
              <p>
                <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface">
                  Medium
                </span>
                <br />
                {active.medium}
              </p>
            ) : null}
            {active.dimensions ? (
              <p>
                <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface">
                  Dimensions
                </span>
                <br />
                {active.dimensions}
              </p>
            ) : null}
            {active.paymentStatus ? (
              <p>
                <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface">
                  Payment
                </span>
                <br />
                <span className="text-on-surface">{active.paymentStatus}</span>
              </p>
            ) : null}
            <div className="space-y-2">
              <span className="block font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface">
                Paperwork
              </span>
              <ul className="space-y-1.5 text-sm">
                {active.conditionReportUrl ? (
                  <li>
                    <a
                      href={active.conditionReportUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-link underline-offset-4 hover:underline"
                    >
                      Condition report (PDF)
                    </a>
                  </li>
                ) : (
                  <li className="text-on-surface-variant">Condition report not available</li>
                )}
                <li>
                  <Link
                    href={active.checkoutHref}
                    className="text-link underline-offset-4 hover:underline"
                  >
                    Invoice &amp; payment details
                  </Link>
                </li>
              </ul>
            </div>
            <Button variant="primary" asChild className="mt-2 w-full sm:w-auto">
              <Link href={active.checkoutHref}>Go to checkout</Link>
            </Button>
          </div>
        ) : null}
      </DrawerDetail>
    </>
  );
}
