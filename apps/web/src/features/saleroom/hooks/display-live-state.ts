import {
  type DisplayBidLiveState,
  EMPTY_DISPLAY_BID_LIVE_STATE,
} from "@/features/saleroom/lib/display-bid-ticks";
import type { SaleroomDisplayOverlay, SaleroomDisplaySnapshot } from "@auction/types";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

export type DisplayFlashKind = "sold" | "passed" | null;

export type SaleroomDisplayLiveState = {
  snapshot: SaleroomDisplaySnapshot | null;
  overlay: SaleroomDisplayOverlay | null;
  flash: DisplayFlashKind;
  lastHammer: import("@/features/saleroom/lib/display-bid-ticks").DisplayLastHammer | null;
  connectionStatus: "connected" | "reconnecting" | "disconnected";
  bidLive: DisplayBidLiveState;
};

export const EMPTY_SALEROOM_DISPLAY_LIVE_STATE: SaleroomDisplayLiveState = {
  snapshot: null,
  overlay: null,
  flash: null,
  lastHammer: null,
  connectionStatus: "disconnected",
  bidLive: EMPTY_DISPLAY_BID_LIVE_STATE,
};

export const DISPLAY_PRICE_FLASH_MS = 450;
export const DISPLAY_HYDRATE_DEBOUNCE_MS = 400;
export const DISPLAY_RESYNC_INTERVAL_MS = 15_000;

export type HydrateMode = "full" | "merge";

export type DisplayLiveRefs = {
  currentLotIdRef: MutableRefObject<string | null>;
  soldFlashTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  priceFlashTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  hydrateDebounceRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  hydrateGenerationRef: MutableRefObject<number>;
  overlayGenerationRef: MutableRefObject<number>;
  overlayControlEmittedAtRef: MutableRefObject<string | null>;
  bidSummaryEmittedAtRef: MutableRefObject<string | null>;
  hydratingRef: MutableRefObject<boolean>;
  snapshotRef: MutableRefObject<SaleroomDisplaySnapshot | null>;
  syncJoinedLotRef: MutableRefObject<(lotId: string | null) => void>;
  hydrateRef: MutableRefObject<(mode?: HydrateMode) => Promise<boolean>>;
  scheduleHydrateRef: MutableRefObject<() => void>;
};

export type DisplayLiveSetState = Dispatch<SetStateAction<SaleroomDisplayLiveState>>;

export type { DisplayBidLiveState } from "@/features/saleroom/lib/display-bid-ticks";
