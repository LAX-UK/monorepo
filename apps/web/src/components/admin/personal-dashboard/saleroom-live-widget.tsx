import { AdminLiveBidActivity } from "@/components/admin/admin-live-bid-activity";
import { Surface } from "@auction/ui/components/surface";

type Props = {
  bidsPerMinute: number;
  activeLotIds: readonly string[];
};

export function SaleroomLiveWidget({ bidsPerMinute, activeLotIds }: Props) {
  return (
    <Surface variant="section" padding="md" className="space-y-4 border-border-hairline">
      <div className="space-y-1">
        <h3 className="font-headline text-lg font-semibold text-on-surface">Saleroom live</h3>
        <p className="font-body text-sm text-on-surface-variant">
          Live bid velocity and room pulse — full saleroom controls coming soon.
        </p>
      </div>
      <AdminLiveBidActivity initialBidsPerMinute={bidsPerMinute} activeLotIds={activeLotIds} />
    </Surface>
  );
}
