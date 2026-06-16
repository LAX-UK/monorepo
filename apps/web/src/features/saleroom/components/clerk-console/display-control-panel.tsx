"use client";

import {
  adminSaleroomDisplayApproveAction,
  adminSaleroomDisplayClearOverlayAction,
  adminSaleroomDisplayOverlayAction,
  adminSaleroomDisplayRevokeAction,
} from "@/lib/actions/admin";
import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import type { SaleroomDisplayDeviceRow } from "@auction/types";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Props = {
  saleId: string;
};

export function DisplayControlPanel({ saleId }: Props) {
  const [devices, setDevices] = useState<SaleroomDisplayDeviceRow[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const displayUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/display/${saleId}`
      : `/display/${saleId}`;

  const loadDevices = useCallback(async () => {
    try {
      const res = await browserFetch(
        `${browserApiBase()}/admin/sales/${encodeURIComponent(saleId)}/saleroom/display/devices`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const body = (await res.json()) as { data?: { items?: SaleroomDisplayDeviceRow[] } };
      setDevices(body.data?.items ?? []);
    } catch {
      /* ignore */
    }
  }, [saleId]);

  useEffect(() => {
    void loadDevices();
    const timer = setInterval(() => void loadDevices(), 15_000);
    return () => clearInterval(timer);
  }, [loadDevices]);

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Venue display</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Pair a TV at{" "}
            <Link href={`/display/${saleId}`} className="underline underline-offset-2">
              /display/{saleId.slice(0, 8)}…
            </Link>
            . SOLD and PASSED flash automatically from the clerk console.
          </p>
        </div>
        <code className="max-w-full truncate rounded bg-muted px-2 py-1 text-xs">{displayUrl}</code>
      </div>

      <form action={adminSaleroomDisplayApproveAction} className="mt-4 flex flex-wrap gap-2">
        <input type="hidden" name="saleId" value={saleId} />
        <input
          name="userCode"
          placeholder="Display code from TV"
          className="min-w-[10rem] flex-1 rounded-md border bg-background px-3 py-2 text-sm uppercase tracking-widest"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Approve display
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        <form action={adminSaleroomDisplayOverlayAction}>
          <input type="hidden" name="saleId" value={saleId} />
          <input type="hidden" name="kind" value="fair_warning" />
          <button type="submit" className="rounded-md border px-3 py-2 text-sm font-medium">
            Fair warning
          </button>
        </form>
        <form
          action={adminSaleroomDisplayOverlayAction}
          className="flex min-w-[12rem] flex-1 gap-2"
        >
          <input type="hidden" name="saleId" value={saleId} />
          <input type="hidden" name="kind" value="announcement" />
          <input
            name="message"
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            placeholder="Announcement text"
            className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm"
            maxLength={500}
          />
          <button type="submit" className="rounded-md border px-3 py-2 text-sm font-medium">
            Announce
          </button>
        </form>
        <form action={adminSaleroomDisplayClearOverlayAction}>
          <input type="hidden" name="saleId" value={saleId} />
          <button
            type="submit"
            className="rounded-md border px-3 py-2 text-sm text-muted-foreground"
          >
            Clear overlay
          </button>
        </form>
      </div>

      {devices.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm">
          {devices
            .filter((d) => d.status === "paired" || d.status === "pending")
            .map((device) => (
              <li
                key={device.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <div>
                  <span className="font-mono tracking-widest">{device.userCode}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{device.status}</span>
                  {device.isOnline ? (
                    <span className="ml-2 text-xs text-emerald-600">online</span>
                  ) : device.status === "paired" ? (
                    <span className="ml-2 text-xs text-muted-foreground">offline</span>
                  ) : null}
                </div>
                {device.status === "paired" ? (
                  <form action={adminSaleroomDisplayRevokeAction}>
                    <input type="hidden" name="saleId" value={saleId} />
                    <input type="hidden" name="pairingId" value={device.id} />
                    <button type="submit" className="text-xs text-destructive underline">
                      Revoke
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
        </ul>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">No paired displays yet.</p>
      )}
    </section>
  );
}
