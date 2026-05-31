import { AdminLiveBidActivity } from "@/components/admin/admin-live-bid-activity";
import { Surface } from "@auction/ui/components/surface";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

type Props = {
  bidsPerMinute: number;
  activeLotIds: readonly string[];
};

export function SaleroomLiveWidget({ bidsPerMinute, activeLotIds }: Props) {
  return (
    <Surface variant="section" padding="md" className="space-y-4 border-border-hairline">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-headline text-lg font-semibold text-on-surface">Saleroom live</h3>
          <p className="font-body text-sm text-on-surface-variant">
            Live bid velocity and room pulse from active lots.
          </p>
        </div>
        <Link
          href="/admin/saleroom"
          className="inline-flex min-h-9 shrink-0 items-center gap-1 font-label text-xs font-semibold uppercase tracking-widest text-primary hover:underline"
        >
          Open
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      <AdminLiveBidActivity initialBidsPerMinute={bidsPerMinute} activeLotIds={activeLotIds} />
    </Surface>
  );
}
