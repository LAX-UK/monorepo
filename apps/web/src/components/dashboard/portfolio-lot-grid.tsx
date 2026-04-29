"use client";

import { Button } from "@/components/ui/button";
import { TimelineStages } from "@auction/ui";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@auction/ui/components/card";
import { DrawerDetail } from "@auction/ui/components/drawer-detail";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

export type PortfolioLotCardVm = {
  id: string;
  title: string;
  image: string | null;
  hammerLabel: string;
  settlementLabel: string;
  settlementStageIndex: number;
  medium: string | null;
  dimensions: string | null;
  paymentStatus: string | null;
  checkoutHref: string;
};

type Props = {
  items: PortfolioLotCardVm[];
};

export function PortfolioLotGrid({ items }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const active = useMemo(() => items.find((i) => i.id === openId) ?? null, [items, openId]);

  return (
    <>
      <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((row) => (
          <li key={row.id}>
            <Card className="group h-full overflow-hidden border border-outline-variant/15 p-0 shadow-none transition-colors hover:border-outline-variant/25 hover:bg-surface-container-low/20">
              <Link href={row.checkoutHref} className="block">
                <div className="relative aspect-[4/5] bg-surface-container-low">
                  {row.image ? (
                    <Image
                      src={row.image}
                      alt={`${row.title} — won lot artwork`}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, 33vw"
                    />
                  ) : null}
                  <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-sm bg-surface-container-lowest/90 px-2 py-1 backdrop-blur-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                    <span className="font-label text-xs font-bold uppercase tracking-wider text-primary">
                      {row.settlementLabel}
                    </span>
                  </div>
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="font-headline text-xl font-light group-hover:italic">
                    {row.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-2">
                  <p className="font-label text-xs uppercase tracking-widest text-primary">
                    Hammer {row.hammerLabel}
                  </p>
                </CardContent>
              </Link>
              <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/10 pt-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="px-4 py-2 font-label text-xs uppercase tracking-widest"
                  onClick={() => setOpenId(row.id)}
                >
                  Details
                </Button>
                <Button
                  variant="primary"
                  className="px-4 py-2 font-label text-xs uppercase tracking-widest"
                  asChild
                >
                  <Link href={row.checkoutHref}>
                    Complete purchase
                    <span
                      className="material-symbols-outlined ml-1 text-sm align-middle"
                      aria-hidden
                    >
                      arrow_forward
                    </span>
                  </Link>
                </Button>
              </CardFooter>
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
