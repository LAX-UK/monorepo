import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import type { AdminSaleOperationsSnapshot } from "@/lib/telephone/telephone-booking-types";
import type { SaleDeliveryMode, SaleroomRealtimePayload } from "@auction/types";

export type SaleroomConnectionStatus = "connected" | "reconnecting" | "disconnected";

/** Narrow session VM shared by clerk console and operations panel. */
export type StaffSaleroomSessionVM = PublicSaleroomSessionStatus & {
  isSessionActive: boolean;
  isSessionLive: boolean;
  lastEventAt: string | null;
  connectionStatus: SaleroomConnectionStatus;
};

export type SaleroomActivityEntry = {
  id: string;
  label: string;
  detail: string | null;
  occurredAt: string;
  source: "socket" | "db";
};

export type StaffOpsPanelVM = {
  saleId: string;
  saleTitle: string;
  saleStatus: string;
  deliveryMode: SaleDeliveryMode;
  sessionStatus: string;
  currentLotId: string | null;
  currentLotNumber: number | null;
  currentLotTitle: string | null;
  currentPrice: string | null;
  bidCount: number | null;
  leaderLabel: string | null;
  pendingRegistrations: number;
  pendingTelephone: number;
  inProgressTelephone: number;
  checkedInPaddleCount: number;
  connectionStatus: SaleroomConnectionStatus;
  lastEventAt: string | null;
  pendingTelephoneRows: AdminSaleOperationsSnapshot["pendingActions"]["telephone"];
};

export type RadarRowVM = {
  saleId: string;
  title: string;
  status: string;
  deliveryMode: SaleDeliveryMode;
  pendingRegistrations: number;
  pendingTelephone: number;
  inProgressTelephone: number;
  sessionStatus: string | null;
  currentLotTitle: string | null;
  isLiveSession: boolean;
};

export type ClerkBidEntryState = {
  paddleNumber: string;
  paddleAmount: string;
  telephoneAmount: string;
  bookingId: string;
};

export type LiveFeedState = {
  session: StaffSaleroomSessionVM;
  liveFeed: SaleroomRealtimePayload[];
  activityLog: SaleroomActivityEntry[];
};
