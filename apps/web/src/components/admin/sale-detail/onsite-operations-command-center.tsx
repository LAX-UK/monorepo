import { OperationsLivePanel } from "@/features/saleroom/components/operations-live-panel/operations-live-panel";
import type { AdminPaddleRosterEntry } from "@/lib/data/http/admin.server";
import type { AdminSaleOperationsSnapshot } from "@/lib/telephone/telephone-booking-types";
import { ErrorState, Section } from "@auction/staff-ui";
import type { Lot, Sale } from "@auction/types";

type Props = {
  saleId: string;
  sale: Sale;
  liveish: boolean;
  snapshot: AdminSaleOperationsSnapshot | null;
  paddleRoster?: AdminPaddleRosterEntry[];
  lots?: Lot[];
};

/** The sale-day view: live session, pending registrations and telephone line workload. */
export function SaleroomOperationsCommandCenter({
  saleId,
  sale,
  liveish,
  snapshot,
  paddleRoster = [],
  lots = [],
}: Props) {
  return (
    <Section
      title="Saleroom operations"
      description="Live session status, pending registrations and telephone line workload."
    >
      {snapshot ? (
        <OperationsLivePanel
          saleId={saleId}
          sale={sale}
          liveish={liveish}
          snapshot={snapshot}
          paddleRoster={paddleRoster}
          lots={lots}
        />
      ) : (
        <ErrorState
          headingLevel="h3"
          title="The live operations view could not be loaded"
          description="Reload the page. If it keeps failing, the saleroom service may be unavailable."
        />
      )}
    </Section>
  );
}
