import type { PayNowBannerVm } from "@/lib/purchases/purchases.vm";
import { Button } from "@auction/ui/components/button";
import { CreditCard } from "lucide-react";
import Link from "next/link";

/**
 * The one thing due on Purchases, above the list: what to pay, by when, and one button. While
 * every due lot is being reviewed it explains that instead of offering a button.
 */
export function PayNowBanner({ banner }: { banner: PayNowBannerVm }) {
  return (
    <section
      aria-label="Payment due"
      className="flex flex-col gap-4 rounded-xl border border-outline-variant/60 bg-surface-container-low p-4 sm:flex-row sm:items-center sm:gap-5 md:p-5"
    >
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-container-lowest text-on-surface max-sm:hidden"
      >
        <CreditCard className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-body text-base font-semibold text-on-surface">{banner.title}</h2>
        <p className="mt-1 font-body text-sm text-on-surface-variant">{banner.description}</p>
      </div>
      {banner.href ? (
        <Button variant="primary" size="default" asChild className="shrink-0 max-sm:w-full">
          <Link href={banner.href}>Pay now</Link>
        </Button>
      ) : null}
    </section>
  );
}
