import type { SaleroomDisplayOverlay } from "@auction/types";

export type AdminSaleroomSessionRow = {
  id: string;
  saleId: string;
  status: string;
  currentLotId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  clerkUserId: string | null;
  auctioneerUserId: string | null;
  createdAt: string;
  updatedAt: string;
  displayOverlay: SaleroomDisplayOverlay | null;
};

export type AdminSaleroomEventRow = {
  id: string;
  sessionId: string;
  kind: string;
  payload: Record<string, unknown>;
  actorUserId: string | null;
  occurredAt: string;
};

export type AdminSaleroomSessionSnapshot = {
  session: AdminSaleroomSessionRow | null;
  events: AdminSaleroomEventRow[];
};

export type AdminSaleroomSessionStatusRow = {
  saleId: string;
  status: "none" | "pending" | "live" | "paused" | "ended";
  currentLotId: string | null;
};
