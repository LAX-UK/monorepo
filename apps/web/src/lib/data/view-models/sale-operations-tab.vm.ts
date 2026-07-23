import type { DetailBoardKpiTile } from "@/lib/admin/detail-board/types";
import type { AdminSaleOperationsSnapshot } from "@/lib/telephone/telephone-booking-types";

export function buildSaleOperationsKpiTiles(
  snapshot: AdminSaleOperationsSnapshot,
  checkedInPaddleCount: number,
): DetailBoardKpiTile[] {
  const sessionLabel = snapshot.saleroomSession?.status ?? "idle";
  const onBlock =
    snapshot.saleroomSession?.currentLotNumber != null
      ? `Lot ${snapshot.saleroomSession.currentLotNumber}`
      : "No lot on block";

  return [
    {
      id: "pending-regs",
      label: "Pending registrations",
      value: String(snapshot.registrations.pending),
      compareHint: `${snapshot.registrations.approved} approved · ${snapshot.registrations.rejected} rejected`,
    },
    {
      id: "telephone",
      label: "Telephone requested",
      value: String(snapshot.telephoneBookings.requested),
      compareHint: `${snapshot.telephoneBookings.inProgress} in progress · ${snapshot.telephoneBookings.confirmed} confirmed`,
    },
    {
      id: "paddles",
      label: "Checked-in paddles",
      value: String(checkedInPaddleCount),
      compareHint: "In-room bidders on file",
    },
    {
      id: "session",
      label: "Saleroom session",
      value: sessionLabel,
      compareHint: onBlock,
    },
  ];
}
