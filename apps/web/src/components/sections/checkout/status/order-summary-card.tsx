"use client";

import { Card, CardContent } from "@auction/ui/components/card";
import { Separator } from "@auction/ui/components/separator";

export type OrderSummaryProps = {
  hammer: string;
  buyerPremium: string;
  total: string;
  premiumPercentLabel: string;
};

export function OrderSummaryCard({
  hammer,
  buyerPremium,
  total,
  premiumPercentLabel,
}: OrderSummaryProps) {
  return (
    <Card className="min-w-0 border border-border-hairline bg-surface-container-low shadow-md lg:sticky lg:top-4 lg:z-10 lg:shadow-lg">
      <CardContent className="p-6 sm:p-8">
        <h2 className="mb-6 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Order summary
        </h2>
        <dl className="min-w-0 space-y-4 font-body text-sm">
          <div className="flex min-w-0 justify-between gap-4">
            <dt className="min-w-0 shrink text-on-surface-variant">Hammer price</dt>
            <dd className="shrink-0 font-headline text-lg tabular-nums text-on-surface">
              {hammer}
            </dd>
          </div>
          <div className="flex min-w-0 justify-between gap-4">
            <dt className="min-w-0 break-words pr-2 text-on-surface-variant">
              Buyer&apos;s premium ({premiumPercentLabel})
            </dt>
            <dd className="shrink-0 font-headline text-lg tabular-nums text-primary">
              {buyerPremium}
            </dd>
          </div>
          <Separator className="bg-outline-variant/10" />
          <div className="flex min-w-0 justify-between gap-4">
            <dt className="min-w-0 text-on-surface-variant">Shipping &amp; logistics</dt>
            <dd className="shrink-0 text-right font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
              Quoted after payment
            </dd>
          </div>
          <p className="font-body text-xs leading-relaxed text-on-surface-variant">
            The total below covers the hammer price and buyer&apos;s premium only. Shipping and
            logistics are quoted and invoiced separately once your lot is released.
          </p>
          <Separator className="bg-outline-variant/15" />
          <div className="flex min-w-0 justify-between gap-4 pt-2">
            <dt className="min-w-0 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface">
              Total due
            </dt>
            <dd className="shrink-0 font-headline text-2xl tabular-nums text-on-surface">
              {total}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
