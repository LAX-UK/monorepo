"use client";

import {
  SaleroomDisplayBoard,
  SaleroomDisplayOverlay,
} from "@/features/saleroom/components/display/saleroom-display-board";
import { SaleroomDisplayPairing } from "@/features/saleroom/components/display/saleroom-display-pairing";
import { useDisplayPairing } from "@/features/saleroom/hooks/use-display-pairing";
import { useDisplayWakeLock } from "@/features/saleroom/hooks/use-display-wake-lock";
import { useSaleroomDisplayLive } from "@/features/saleroom/hooks/use-saleroom-display-live";
import { buildDisplayBoardVM } from "@/features/saleroom/lib/display-bid-ticks";

type Props = {
  saleId: string;
};

export function SaleroomDisplayShell({ saleId }: Props) {
  const { state: pairingState, beginPairing, disconnect } = useDisplayPairing(saleId);

  if (pairingState.phase === "authorized") {
    return (
      <SaleroomDisplayConnected
        saleId={saleId}
        displayToken={pairingState.displayToken}
        onDisconnect={disconnect}
      />
    );
  }

  const pairingPhase =
    pairingState.phase === "starting"
      ? "starting"
      : pairingState.phase === "waiting"
        ? "waiting"
        : pairingState.phase === "expired"
          ? "expired"
          : pairingState.phase === "error"
            ? "error"
            : "idle";

  return (
    <SaleroomDisplayPairing
      saleId={saleId}
      start={pairingState.phase === "waiting" ? pairingState.start : null}
      phase={pairingPhase}
      message={pairingState.phase === "error" ? pairingState.message : undefined}
      onBegin={() => void beginPairing()}
    />
  );
}

function SaleroomDisplayConnected({
  saleId,
  displayToken,
  onDisconnect,
}: {
  saleId: string;
  displayToken: string;
  onDisconnect: () => void;
}) {
  useDisplayWakeLock(true);
  const live = useSaleroomDisplayLive({
    saleId,
    displayToken,
    onUnauthorized: onDisconnect,
  });

  if (!live.snapshot) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-neutral-950 text-white/60">
        Loading display…
      </div>
    );
  }

  const betweenLots = live.snapshot.sessionStatus === "live" && live.snapshot.currentLotId == null;
  const boardVm = buildDisplayBoardVM(live.snapshot, live.bidLive, live.connectionStatus, {
    suppressPriceFlash: live.flash === "sold" || live.flash === "passed",
  });

  return (
    <>
      <SaleroomDisplayBoard {...boardVm} />
      <SaleroomDisplayOverlay overlay={live.overlay} flash={live.flash} betweenLots={betweenLots} />
      <button
        type="button"
        onClick={onDisconnect}
        className="fixed bottom-4 right-4 z-50 rounded bg-neutral-100/10 px-3 py-1 text-xs text-white/40 opacity-0 hover:opacity-100 focus:opacity-100"
      >
        Disconnect
      </button>
    </>
  );
}
