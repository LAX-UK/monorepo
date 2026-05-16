import { ExternalLink } from "lucide-react";
import type { SaleOverviewVM } from "./view-models";

type Props = {
  overview: SaleOverviewVM;
};

/** External live stream affordance. */
export function SaleroomOverviewStream({ overview }: Props) {
  if (!overview.showLiveStream || !overview.streamUrl) return null;

  return (
    <p className="mt-6 text-base">
      <a
        href={overview.streamUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 font-semibold text-on-surface underline underline-offset-2 hover:opacity-80"
      >
        <ExternalLink className="size-4 shrink-0" aria-hidden />
        Watch live stream
      </a>
    </p>
  );
}
