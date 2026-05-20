"use client";

import { ConfirmFormSubmit } from "@/components/admin/confirm-form-submit";
import { SaleroomPendingSubmit } from "@/components/admin/saleroom-pending-form";
import {
  adminSaleroomAdvanceAction,
  adminSaleroomCloseAction,
  adminSaleroomGoLiveAction,
  adminSaleroomHammerAction,
  adminSaleroomNoSaleAction,
  adminSaleroomPauseAction,
  adminSaleroomResumeAction,
} from "@/lib/actions/admin";
import type {
  AdminSaleroomEventRow,
  AdminSaleroomSessionSnapshot,
} from "@/lib/data/http/admin.server";
import { getSocket } from "@/lib/socket";
import type { Lot } from "@auction/types";
import type { SaleroomRealtimePayload } from "@auction/types";
import { useEffect, useState } from "react";

type Props = {
  saleId: string;
  saleTitle: string;
  initial: AdminSaleroomSessionSnapshot;
  lots: Lot[];
  error?: string | null;
};

export function SaleroomClerkConsole({ saleId, saleTitle, initial, lots, error }: Props) {
  const [liveFeed, setLiveFeed] = useState<SaleroomRealtimePayload[]>([]);

  useEffect(() => {
    const socket = getSocket();
    const onSaleroom = (raw: unknown) => {
      const p = raw as SaleroomRealtimePayload;
      if (p && typeof p.kind === "string" && p.saleId === saleId) {
        setLiveFeed((prev) => [p, ...prev].slice(0, 40));
      }
    };
    socket.emit("joinSaleroom", { saleId }, () => {});
    socket.on("saleroomEvent", onSaleroom);
    return () => {
      socket.off("saleroomEvent", onSaleroom);
      socket.emit("leaveSaleroom", { saleId }, () => {});
    };
  }, [saleId]);

  const session = initial.session;
  const status = session?.status ?? "none";
  const currentLotId = session?.currentLotId ?? null;

  return (
    <div className="space-y-8">
      {error ? (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 font-body text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="rounded-lg border border-outline-variant/25 p-4">
        <h2 className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Session
        </h2>
        <p className="mt-1 font-body text-sm text-secondary">
          {saleTitle} · status: <span className="text-foreground">{status}</span>
          {currentLotId ? (
            <>
              {" "}
              · current lot:{" "}
              <span className="text-foreground font-mono text-xs">{currentLotId}</span>
            </>
          ) : null}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <form id={`saleroom-go-live-${saleId}`} action={adminSaleroomGoLiveAction}>
          <input type="hidden" name="saleId" value={saleId} />
          <SaleroomPendingSubmit
            formId={`saleroom-go-live-${saleId}`}
            pendingLabel="Going live…"
            variant="default"
          >
            Go live
          </SaleroomPendingSubmit>
        </form>
        <form id={`saleroom-pause-${saleId}`} action={adminSaleroomPauseAction}>
          <input type="hidden" name="saleId" value={saleId} />
          <SaleroomPendingSubmit
            formId={`saleroom-pause-${saleId}`}
            pendingLabel="Pausing…"
            variant="secondary"
          >
            Pause
          </SaleroomPendingSubmit>
        </form>
        <form id={`saleroom-resume-${saleId}`} action={adminSaleroomResumeAction}>
          <input type="hidden" name="saleId" value={saleId} />
          <SaleroomPendingSubmit
            formId={`saleroom-resume-${saleId}`}
            pendingLabel="Resuming…"
            variant="secondary"
          >
            Resume
          </SaleroomPendingSubmit>
        </form>
        <form id={`saleroom-close-${saleId}`} action={adminSaleroomCloseAction}>
          <input type="hidden" name="saleId" value={saleId} />
          <ConfirmFormSubmit
            formId={`saleroom-close-${saleId}`}
            variant="secondary"
            confirmTitle="Close saleroom session?"
            confirmBody="Bidders will no longer see live updates until you go live again."
            confirmLabel="Close session"
            tone="warning"
          >
            Close session
          </ConfirmFormSubmit>
        </form>
      </div>

      <div className="rounded-lg border border-outline-variant/25 p-4">
        <h2 className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Advance
        </h2>
        {lots.length === 0 ? (
          <p className="mt-2 font-body text-sm text-secondary">No lots on this sale yet.</p>
        ) : (
          <form
            id={`saleroom-advance-${saleId}`}
            action={adminSaleroomAdvanceAction}
            className="mt-3 flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="saleId" value={saleId} />
            <label className="flex flex-col gap-1 font-body text-xs text-secondary">
              Lot
              <select
                name="lotId"
                defaultValue={lots[0]?.id ?? ""}
                className="min-w-[240px] rounded-md border border-outline-variant/30 bg-background px-3 py-2 font-body text-sm"
              >
                {lots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title?.trim() || l.id}
                  </option>
                ))}
              </select>
            </label>
            <SaleroomPendingSubmit
              formId={`saleroom-advance-${saleId}`}
              pendingLabel="Advancing…"
              variant="default"
            >
              On the block
            </SaleroomPendingSubmit>
          </form>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <form id={`saleroom-hammer-${saleId}`} action={adminSaleroomHammerAction}>
          <input type="hidden" name="saleId" value={saleId} />
          <SaleroomPendingSubmit
            formId={`saleroom-hammer-${saleId}`}
            pendingLabel="Recording…"
            variant="default"
          >
            Hammer (sold)
          </SaleroomPendingSubmit>
        </form>
        <form id={`saleroom-nosale-${saleId}`} action={adminSaleroomNoSaleAction}>
          <input type="hidden" name="saleId" value={saleId} />
          <SaleroomPendingSubmit
            formId={`saleroom-nosale-${saleId}`}
            pendingLabel="Recording…"
            variant="secondary"
          >
            No sale
          </SaleroomPendingSubmit>
        </form>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-outline-variant/25 p-4">
          <h2 className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Recent events (DB)
          </h2>
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto font-mono text-xs text-secondary">
            {initial.events.length === 0 ? (
              <li>—</li>
            ) : (
              initial.events.map((e: AdminSaleroomEventRow) => (
                <li key={e.id}>
                  <span className="text-foreground">{e.kind}</span>{" "}
                  <span className="opacity-70">{e.occurredAt}</span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="rounded-lg border border-outline-variant/25 p-4">
          <h2 className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Live feed (socket)
          </h2>
          <ul
            className="mt-3 max-h-64 space-y-2 overflow-y-auto font-mono text-xs text-secondary"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label="Live saleroom events"
          >
            {liveFeed.length === 0 ? (
              <li>Waiting for events…</li>
            ) : (
              liveFeed.map((e, i) => (
                <li key={`${e.emittedAt}-${i}`}>
                  <span className="text-foreground">{e.kind}</span>{" "}
                  {e.lotId ? <span className="opacity-80">lot {e.lotId.slice(0, 8)}…</span> : null}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
