import { SaleStreamPreview } from "@/components/marketing/sale-stream-preview";
import type { StreamPresentation } from "@/lib/sale-stream-policy";
import { Video } from "lucide-react";

type Props = {
  streamUrl: string;
  saleTitle: string;
  streamPosterUrl: string | null;
  presentation: StreamPresentation;
};

/** Lot-page live stream section (onsite / hybrid). Only rendered when stream is
 * active or upcoming — the parent is responsible for gating via the policy.
 */
export function OnsiteStreamSection({
  streamUrl,
  saleTitle,
  streamPosterUrl,
  presentation,
}: Props) {
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
        {presentation.showPulseIcon ? (
          <Video className="size-5 animate-pulse text-primary" aria-hidden />
        ) : null}
        {presentation.sectionHeading}
      </h2>
      <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
        {presentation.sectionBody}
      </p>
      <div className="mt-5 overflow-hidden rounded-2xl border border-outline-variant/15 shadow-md">
        <SaleStreamPreview
          streamUrl={streamUrl}
          saleTitle={saleTitle}
          posterUrl={streamPosterUrl}
          presentation={presentation}
        />
      </div>
    </section>
  );
}
