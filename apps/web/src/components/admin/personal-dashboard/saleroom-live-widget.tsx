import { AdminLiveBidActivity } from "@/components/admin/admin-live-bid-activity";
import { Surface } from "@auction/ui/components/surface";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

type Props = {
  bidsPerMinute: number;
  activeLotIds: readonly string[];
  activeSaleroomSessions?: number;
};

export function SaleroomLiveWidget({
  bidsPerMinute,
  activeLotIds,
  activeSaleroomSessions = 0,
}: Props) {
  return (
    <Surface variant="section" padding="md" className="space-y-4 border-border-hairline">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-headline text-lg font-semibold text-on-surface">Saleroom live</h3>
          <p className="font-body text-sm text-on-surface-variant">
            Live bid velocity and saleroom sessions on the floor.
            {activeSaleroomSessions > 0 ? (
              <>
                {" "}
                <span className="font-medium text-on-surface">
                  {activeSaleroomSessions} active session
                  {activeSaleroomSessions === 1 ? "" : "s"}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <Link
          href="/admin/saleroom"
          className="inline-flex min-h-9 shrink-0 items-center gap-1 font-label text-xs font-semibold uppercase tracking-widest text-link hover:underline"
        >
          Open
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      <AdminLiveBidActivity initialBidsPerMinute={bidsPerMinute} activeLotIds={activeLotIds} />
    </Surface>
  );
}
