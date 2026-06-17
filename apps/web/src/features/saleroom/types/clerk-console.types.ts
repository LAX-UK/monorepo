import type { ClerkLivePhase } from "@/features/saleroom/lib/clerk-live-phase";
import type {
  SaleroomActivityEntry,
  StaffSaleroomSessionVM,
} from "@/features/saleroom/types/staff-saleroom.vm";
import type { ClerkLotLiveBidState } from "@/hooks/use-clerk-lot-live-price";
import type {
  AdminPaddleRosterEntry,
  AdminTelephoneBookingRow,
} from "@/lib/data/http/admin.server";
import type { LotRunProgress } from "@/lib/saleroom/lot-run-progress";
import type { Lot, SaleDeliveryMode } from "@auction/types";
import type { ReactNode } from "react";

export type ClerkToolsTab = "display" | "telephone" | "activity";

export type ClerkActionPolicy = {
  advanceInRunway: boolean;
  advanceInOnBlock: boolean;
  advanceInDock: boolean;
  hammerInOnBlock: boolean;
  hammerInDock: boolean;
  jumpToLotInRunway: boolean;
};

export type ClerkPhaseLayoutConfig = {
  sessionBarMode: "full" | "live";
  toolsPresentation: "expanded" | "tabbed";
  defaultToolsTab: ClerkToolsTab;
  reserveDockSpace: boolean;
  stickySessionToolbar: boolean;
};

export type ClerkAlertDefinition = {
  key: string;
  title: string;
  body: string;
  variant: "default" | "destructive";
  priority: number;
};

export type ClerkConsoleAlert = ClerkAlertDefinition & {
  renderBody?: ReactNode;
};

export type ClerkSessionSlice = {
  saleId: string;
  saleTitle: string;
  deliveryMode?: SaleDeliveryMode;
  session: StaffSaleroomSessionVM;
  livePhase: ClerkLivePhase;
  activityLog: SaleroomActivityEntry[];
};

export type ClerkLotSlice = {
  lots: Lot[];
  currentLotId: string | null;
  currentLot: Lot | null;
  progress: LotRunProgress;
  nextLot: Lot | null;
  liveBid: ClerkLotLiveBidState;
};

export type ClerkRosterSlice = {
  paddleRoster: AdminPaddleRosterEntry[];
  telephoneBookings: AdminTelephoneBookingRow[];
  registrationsHref?: string;
};

export type ClerkActionSlice = {
  policy: ClerkActionPolicy;
  canHammer: boolean;
  sessionLive: boolean;
  sessionStatus: StaffSaleroomSessionVM["status"];
};

export type ClerkFeedbackSlice = {
  alerts: ClerkAlertDefinition[];
  loadWarnings: string[];
  error?: string | null;
  registrationsHref?: string;
};

export type ClerkConsoleModel = {
  session: ClerkSessionSlice;
  lot: ClerkLotSlice;
  roster: ClerkRosterSlice;
  action: ClerkActionSlice;
  feedback: ClerkFeedbackSlice;
  phaseLayout: ClerkPhaseLayoutConfig;
  pendingTelForLot: number;
  showActionBar: boolean;
};

export type ClerkConsoleSlots = {
  alerts: ReactNode;
  sessionBar: ReactNode;
  sessionToolbar: ReactNode;
  runway: ReactNode;
  onBlock: ReactNode;
  tools: ReactNode;
  liveDock: ReactNode;
};

export type ClerkToolsRailSlots = {
  display: ReactNode;
  telephone: ReactNode;
  activity: ReactNode;
};
