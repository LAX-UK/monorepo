"use client";

import { formatMoney } from "@/lib/format-currency";
import { bulkBarBottomOffset } from "@/lib/layout/bottom-chrome";
import { lotPath } from "@/lib/seo/url";
import type { Lot } from "@auction/types";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { ArrowRight, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type CheckoutBasketRow = {
  lot: Lot;
  hammer: number;
  premium: number;
  total: number;
  premiumPercentLabel: string;
};

type Props = {
  rows: CheckoutBasketRow[];
  grandTotal: number;
};

/** Basket list with mobile card layout and sticky combined total above the tab bar. */
export function CheckoutBasketPanel({ rows, grandTotal }: Props) {
  const pathname = usePathname();
  const tabBarActive = pathname.startsWith("/dashboard");
  const stickyBottom = tabBarActive ? bulkBarBottomOffset(true) : "0px";

  return (
    <>
      <Surface variant="section" padding="md" className="pb-28 lg:pb-6">
        <div className="space-y-5">
          <header className="flex items-center gap-3">
            <ShoppingBag className="size-5 text-primary" aria-hidden />
            <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
              Basket
            </p>
          </header>
          <ul className="space-y-3 lg:divide-y lg:divide-outline-variant/15 lg:space-y-0">
            {rows.map((row) => (
              <li
                key={row.lot.id}
                className={cn(
                  "rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-4 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:py-4",
                  "flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center",
                )}
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={lotPath(row.lot)}
                    className="block font-headline text-sm font-semibold text-on-surface underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {row.lot.title}
                  </Link>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Hammer {formatMoney(row.hammer.toFixed(2))} · Premium {row.premiumPercentLabel}{" "}
                    ({formatMoney(row.premium.toFixed(2))})
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 lg:justify-end">
                  <div className="text-left lg:text-right">
                    <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                      Lot total
                    </p>
                    <p className="font-headline text-base tabular-nums text-on-surface">
                      {formatMoney(row.total.toFixed(2))}
                    </p>
                  </div>
                  <Button variant="secondaryOutline" asChild className="shrink-0">
                    <Link
                      href={`/dashboard/checkout/${row.lot.id}`}
                      className="inline-flex items-center gap-2"
                    >
                      Pay this lot <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <p className="font-body text-xs text-on-surface-variant">
            We invoice and settle each lot individually for now. When finance enables basket
            invoicing, payment will consolidate into a single Xero invoice from this screen.
          </p>
        </div>
      </Surface>

      <div
        className="fixed inset-x-0 z-30 border-t border-outline-variant/20 bg-surface/95 px-4 py-3 backdrop-blur-md lg:hidden"
        style={{ bottom: stickyBottom }}
        aria-live="polite"
      >
        <div className="mx-auto flex max-w-lg items-center justify-between gap-4">
          <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            Combined total
          </p>
          <p className="font-headline text-lg tabular-nums text-on-surface">
            {formatMoney(grandTotal.toFixed(2))}
          </p>
        </div>
      </div>
    </>
  );
}
