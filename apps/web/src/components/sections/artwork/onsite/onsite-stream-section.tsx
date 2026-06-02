import { SaleStreamPreview } from "@/components/marketing/sale-stream-preview";
import type { Sale } from "@auction/types";
import { Video } from "lucide-react";

type Props = {
  sale: Sale;
  streamPosterUrl: string | null;
};

export function OnsiteStreamSection({ sale, streamPosterUrl }: Props) {
  if (!sale.streamUrl) return null;

  return (
    <section
      id="live-stream"
      aria-labelledby="stream-promo"
      className="scroll-mt-28 rounded-3xl border border-primary/25 bg-primary-container/5 p-6 shadow-sm dark:bg-primary/10 sm:p-8"
    >
      <h2
        id="stream-promo"
        className="flex items-center gap-2 font-headline text-xl font-bold text-on-surface"
      >
        <Video className="size-5 animate-pulse text-primary" aria-hidden />
        Watch From Anywhere
      </h2>
      <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
        Follow the live stream while the auction runs in the gallery.
      </p>
      <div className="mt-5 overflow-hidden rounded-2xl border border-outline-variant/15 shadow-md">
        <SaleStreamPreview
          streamUrl={sale.streamUrl}
          saleTitle={sale.title}
          posterUrl={streamPosterUrl}
        />
      </div>
    </section>
  );
}
