import { salePath } from "@/lib/seo/url";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = {
  saleTitle?: string | null;
  saleId?: string | null;
};

/** Shown when an onsite lot cannot load its parent sale bundle. */
export function OnsiteLotUnavailable({ saleTitle, saleId }: Props) {
  return (
    <section className="mx-auto max-w-[var(--container-max,1440px)] px-4 py-16 sm:px-6 md:px-8">
      <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-8 text-center shadow-sm">
        <h1 className="font-headline text-2xl font-bold text-on-surface">
          Sale details unavailable
        </h1>
        <p className="mt-3 font-body text-sm text-on-surface-variant">
          This lot is part of an in-gallery sale
          {saleTitle ? ` (${saleTitle})` : ""}, but we couldn&apos;t load the full sale schedule
          right now. Please try again shortly or browse the catalogue.
        </p>
        {saleId ? (
          <Button className="mt-6" asChild>
            <Link href={salePath({ id: saleId, title: saleTitle ?? "sale" })}>View sale</Link>
          </Button>
        ) : (
          <Button className="mt-6" asChild>
            <Link href="/sales">Browse sales</Link>
          </Button>
        )}
      </div>
    </section>
  );
}
