"use client";

import type { SaleroomDisplayPairingStart } from "@auction/types";

type Props = {
  saleId: string;
  start: SaleroomDisplayPairingStart | null;
  phase: "starting" | "waiting" | "expired" | "error";
  message?: string | undefined;
  onBegin: () => void;
};

export function SaleroomDisplayPairing({ saleId, start, phase, message, onBegin }: Props) {
  const approveUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/admin/saleroom/${saleId}`
      : `/admin/saleroom/${saleId}`;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-neutral-950 px-6 text-white">
      {phase === "waiting" && start ? (
        <div className="max-w-lg text-center">
          <p className="text-sm uppercase tracking-[0.25em] text-white/50">Connect this display</p>
          <p className="mt-6 text-6xl font-bold tracking-[0.35em]">{start.userCode}</p>
          <p className="mt-6 text-lg text-white/60">
            Ask staff to enter this code in the clerk console for sale{" "}
            <span className="font-mono text-white/80">{saleId.slice(0, 8)}…</span>
          </p>
          <p className="mt-4 text-sm text-white/40">
            Clerk console:{" "}
            <a href={approveUrl} className="underline underline-offset-4">
              Open saleroom
            </a>
          </p>
          <p className="mt-8 animate-pulse text-sm text-white/40">Waiting for approval…</p>
        </div>
      ) : phase === "expired" ? (
        <div className="text-center">
          <p className="text-2xl">Pairing code expired</p>
          <button
            type="button"
            onClick={onBegin}
            className="mt-6 rounded-lg bg-neutral-100 px-6 py-3 text-sm font-semibold text-neutral-950"
          >
            Try again
          </button>
        </div>
      ) : phase === "error" ? (
        <div className="text-center">
          <p className="text-2xl text-red-300">{message ?? "Something went wrong"}</p>
          <button
            type="button"
            onClick={onBegin}
            className="mt-6 rounded-lg bg-neutral-100 px-6 py-3 text-sm font-semibold text-neutral-950"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-3xl font-light">Venue display</p>
          <p className="mt-3 text-white/50">Pair this screen with the clerk console</p>
          <button
            type="button"
            onClick={onBegin}
            disabled={phase === "starting"}
            className="mt-8 rounded-lg bg-neutral-100 px-8 py-3 text-sm font-semibold text-neutral-950 disabled:opacity-60"
          >
            {phase === "starting" ? "Starting…" : "Connect display"}
          </button>
        </div>
      )}
    </div>
  );
}
