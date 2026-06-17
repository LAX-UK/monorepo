"use client";

import { SaleroomPendingSubmit } from "@/components/admin/saleroom-pending-form";
import {
  ConsolePanel,
  PanelHeading,
} from "@/features/saleroom/components/clerk-console/console-panel";
import { useDisplayOverlayState } from "@/features/saleroom/hooks/use-display-overlay-state";
import {
  adminSaleroomDisplayApproveAction,
  adminSaleroomDisplayClearOverlayAction,
  adminSaleroomDisplayOverlayAction,
  adminSaleroomDisplayRevokeAction,
} from "@/lib/actions/admin";
import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import type { SaleroomDisplayDeviceRow, SaleroomDisplayOverlay } from "@auction/types";
import { Badge } from "@auction/ui/components/badge";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { cn } from "@auction/ui/lib/utils";
import { Check, Copy } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Props = {
  saleId: string;
  initialOverlay?: SaleroomDisplayOverlay | null;
};

export function DisplayControlPanel({ saleId, initialOverlay = null }: Props) {
  const [devices, setDevices] = useState<SaleroomDisplayDeviceRow[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const [copied, setCopied] = useState(false);
  const [displayUrl, setDisplayUrl] = useState(`/display/${saleId}`);
  const {
    activeOverlay,
    hasActiveOverlay,
    setOptimisticOverlay,
    clearOptimisticOverlay,
    refreshOverlay,
  } = useDisplayOverlayState({ saleId, initialOverlay });

  const approveFormId = `saleroom-display-approve-${saleId}`;
  const fairWarningFormId = `saleroom-display-fw-${saleId}`;
  const announceFormId = `saleroom-display-announce-${saleId}`;
  const clearFormId = `saleroom-display-clear-${saleId}`;

  useEffect(() => {
    setDisplayUrl(`${window.location.origin}/display/${saleId}`);
  }, [saleId]);

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

  const copyDisplayUrl = async () => {
    try {
      await navigator.clipboard.writeText(displayUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const activeOverlayLabel =
    activeOverlay?.kind === "fair_warning"
      ? "Fair warning"
      : activeOverlay?.kind === "announcement"
        ? `Announcement${activeOverlay.message ? `: ${activeOverlay.message}` : ""}`
        : null;

  return (
    <ConsolePanel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <PanelHeading>Venue display</PanelHeading>
          <p className="mt-2 font-body text-sm text-secondary">
            Pair a TV at{" "}
            <Link href={`/display/${saleId}`} className="font-medium text-link underline">
              /display/{saleId}
            </Link>
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 shrink-0 font-mono text-xs"
          onClick={() => void copyDisplayUrl()}
        >
          {copied ? (
            <>
              <Check className="mr-1.5 size-3.5" aria-hidden />
              Copied
            </>
          ) : (
            <>
              <Copy className="mr-1.5 size-3.5" aria-hidden />
              Copy URL
            </>
          )}
        </Button>
      </div>

      <form
        id={approveFormId}
        action={adminSaleroomDisplayApproveAction}
        className="mt-4 flex flex-wrap items-end gap-2"
      >
        <input type="hidden" name="saleId" value={saleId} />
        <div className="min-w-[10rem] flex-1 space-y-1">
          <Label htmlFor={`display-code-${saleId}`}>Display code from TV</Label>
          <Input
            id={`display-code-${saleId}`}
            name="userCode"
            placeholder="ABCD-1234"
            className="h-11 font-body text-sm uppercase tracking-widest"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <SaleroomPendingSubmit
          formId={approveFormId}
          pendingLabel="Approving…"
          className="min-h-11"
        >
          Approve display
        </SaleroomPendingSubmit>
      </form>

      {activeOverlayLabel ? (
        <div
          className="mt-4 rounded-md border border-primary/25 bg-primary/5 px-3 py-2 font-body text-sm text-foreground"
          aria-live="polite"
        >
          <span className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Active overlay
          </span>
          <p className="mt-1 font-medium">{activeOverlayLabel}</p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <form
          id={fairWarningFormId}
          action={adminSaleroomDisplayOverlayAction}
          onSubmit={() => {
            setOptimisticOverlay({ kind: "fair_warning" });
            void refreshOverlay();
          }}
        >
          <input type="hidden" name="saleId" value={saleId} />
          <input type="hidden" name="kind" value="fair_warning" />
          <SaleroomPendingSubmit
            formId={fairWarningFormId}
            pendingLabel="Sending…"
            variant={activeOverlay?.kind === "fair_warning" ? "default" : "outline"}
            className={cn(
              "min-h-11",
              activeOverlay?.kind === "fair_warning" && "ring-2 ring-primary/30",
            )}
          >
            Fair warning
          </SaleroomPendingSubmit>
        </form>

        <form
          id={announceFormId}
          action={adminSaleroomDisplayOverlayAction}
          className="flex min-w-[12rem] flex-1 flex-wrap items-end gap-2"
          onSubmit={() => {
            const message = announcement.trim();
            setOptimisticOverlay(
              message ? { kind: "announcement", message } : { kind: "announcement" },
            );
            setAnnouncement("");
            void refreshOverlay();
          }}
        >
          <input type="hidden" name="saleId" value={saleId} />
          <input type="hidden" name="kind" value="announcement" />
          <div className="min-w-[10rem] flex-1 space-y-1">
            <Label htmlFor={`display-announce-${saleId}`} className="sr-only">
              Announcement text
            </Label>
            <Input
              id={`display-announce-${saleId}`}
              name="message"
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              placeholder="Announcement text"
              className="h-11 font-body text-sm"
              maxLength={500}
            />
          </div>
          <SaleroomPendingSubmit
            formId={announceFormId}
            pendingLabel="Sending…"
            variant={activeOverlay?.kind === "announcement" ? "default" : "outline"}
            className={cn(
              "min-h-11",
              activeOverlay?.kind === "announcement" && "ring-2 ring-primary/30",
            )}
          >
            Announce
          </SaleroomPendingSubmit>
        </form>

        <form
          id={clearFormId}
          action={adminSaleroomDisplayClearOverlayAction}
          onSubmit={() => {
            clearOptimisticOverlay();
            void refreshOverlay();
          }}
        >
          <input type="hidden" name="saleId" value={saleId} />
          <SaleroomPendingSubmit
            formId={clearFormId}
            pendingLabel="Clearing…"
            variant="ghost"
            className="min-h-11 text-secondary"
            disabled={!hasActiveOverlay}
            aria-disabled={!hasActiveOverlay}
          >
            Clear overlay
          </SaleroomPendingSubmit>
        </form>
      </div>

      {devices.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {devices
            .filter((d) => d.status === "paired" || d.status === "pending")
            .map((device) => (
              <li
                key={device.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-outline-variant/20 bg-surface-container-low/30 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2 font-body text-sm">
                  <span className="font-mono tracking-widest text-foreground">
                    {device.userCode}
                  </span>
                  <Badge variant="secondary">{device.status}</Badge>
                  {device.isOnline ? (
                    <span className="text-xs text-success">online</span>
                  ) : device.status === "paired" ? (
                    <span className="text-xs text-secondary">offline</span>
                  ) : null}
                </div>
                {device.status === "paired" ? (
                  <form action={adminSaleroomDisplayRevokeAction}>
                    <input type="hidden" name="saleId" value={saleId} />
                    <input type="hidden" name="pairingId" value={device.id} />
                    <Button type="submit" variant="ghost" size="sm" className="text-error">
                      Revoke
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
        </ul>
      ) : (
        <p className="mt-4 font-body text-sm text-secondary">No paired displays yet.</p>
      )}
    </ConsolePanel>
  );
}
