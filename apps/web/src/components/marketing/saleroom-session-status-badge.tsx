import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import { presentSaleroomSession } from "@/lib/saleroom/saleroom-session-status-map";
import { MappedStatusBadge } from "@auction/ui/lax";

type Props = {
  status: PublicSaleroomSessionStatus["status"];
  className?: string;
};

/** The public saleroom session's status, through the saleroom status map. */
export function SaleroomSessionStatusBadge({ status, className }: Props) {
  return (
    <MappedStatusBadge
      status={status}
      present={presentSaleroomSession}
      {...(className ? { className } : {})}
    />
  );
}
