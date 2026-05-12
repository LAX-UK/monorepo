"use client";

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
import { Button } from "@auction/ui/components/button";
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
        <h2 className="font-label text-xs uppercase tracking-widest text-secondary">Session</h2>
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
        <form action={adminSaleroomGoLiveAction}>
          <input type="hidden" name="saleId" value={saleId} />
          <Button type="submit" variant="default">
            Go live
          </Button>
        </form>
        <form action={adminSaleroomPauseAction}>
          <input type="hidden" name="saleId" value={saleId} />
          <Button type="submit" variant="secondary">
            Pause
          </Button>
        </form>
        <form action={adminSaleroomResumeAction}>
          <input type="hidden" name="saleId" value={saleId} />
          <Button type="submit" variant="secondary">
            Resume
          </Button>
        </form>
        <form action={adminSaleroomCloseAction}>
          <input type="hidden" name="saleId" value={saleId} />
          <Button type="submit" variant="secondary">
            Close session
          </Button>
        </form>
      </div>

      <div className="rounded-lg border border-outline-variant/25 p-4">
        <h2 className="font-label text-xs uppercase tracking-widest text-secondary">Advance</h2>
        {lots.length === 0 ? (
          <p className="mt-2 font-body text-sm text-secondary">No lots on this sale yet.</p>
        ) : (
          <form action={adminSaleroomAdvanceAction} className="mt-3 flex flex-wrap items-end gap-3">
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
            <Button type="submit" variant="default">
              On the block
            </Button>
          </form>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <form action={adminSaleroomHammerAction}>
          <input type="hidden" name="saleId" value={saleId} />
          <Button type="submit" variant="default">
            Hammer (sold)
          </Button>
        </form>
        <form action={adminSaleroomNoSaleAction}>
          <input type="hidden" name="saleId" value={saleId} />
          <Button type="submit" variant="secondary">
            No sale
          </Button>
        </form>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-outline-variant/25 p-4">
          <h2 className="font-label text-xs uppercase tracking-widest text-secondary">
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
          <h2 className="font-label text-xs uppercase tracking-widest text-secondary">
            Live feed (socket)
          </h2>
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto font-mono text-xs text-secondary">
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
