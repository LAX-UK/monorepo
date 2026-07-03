"use client";

import { SaleroomPendingSubmit } from "@/components/admin/saleroom-pending-form";
import {
  ConsolePanel,
  PanelHeading,
} from "@/features/saleroom/components/clerk-console/console-panel";
import { DisplayOverlayActions } from "@/features/saleroom/components/clerk-console/display-overlay-actions";
import { useClerkDisplayDevices } from "@/features/saleroom/hooks/use-clerk-display-devices";
import { useDisplayOverlayState } from "@/features/saleroom/hooks/use-display-overlay-state";
import {
  adminSaleroomDisplayApproveAction,
  adminSaleroomDisplayRevokeAction,
} from "@/lib/actions/admin";
import type { SaleroomDisplayOverlay } from "@auction/types";
import { Badge } from "@auction/ui/components/badge";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { Skeleton } from "@auction/ui/components/skeleton";
import { Check, Copy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  saleId: string;
  initialOverlay?: SaleroomDisplayOverlay | null;
  panelVariant?: "bordered" | "plain";
};

export function DisplayControlPanel({
  saleId,
  initialOverlay = null,
  panelVariant = "bordered",
}: Props) {
  const [pairingCode, setPairingCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [displayUrl, setDisplayUrl] = useState(`/display/${saleId}`);
  const { devices, isLoading, error, retry } = useClerkDisplayDevices(saleId);
  const { activeOverlay } = useDisplayOverlayState({ saleId, initialOverlay });

  useEffect(() => {
    setDisplayUrl(`${window.location.origin}/display/${saleId}`);
  }, [saleId]);

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
    <ConsolePanel variant={panelVariant}>
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

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="min-w-[10rem] flex-1 space-y-1">
          <Label htmlFor={`display-code-${saleId}`}>Display code from TV</Label>
          <Input
            id={`display-code-${saleId}`}
            value={pairingCode}
            onChange={(e) => setPairingCode(e.target.value)}
            placeholder="ABCD-1234"
            className="h-11 font-body text-sm uppercase tracking-widest"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <SaleroomPendingSubmit
          pendingLabel="Approving…"
          className="min-h-11"
          disabled={pairingCode.trim().length < 4}
          onRun={() =>
            adminSaleroomDisplayApproveAction({
              saleId,
              userCode: pairingCode.trim(),
            })
          }
          onSuccess={() => setPairingCode("")}
        >
          Approve display
        </SaleroomPendingSubmit>
      </div>

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

      <div className="mt-4">
        <DisplayOverlayActions saleId={saleId} initialOverlay={initialOverlay} />
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-2" aria-busy="true" aria-label="Loading display devices">
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      ) : error ? (
        <div className="mt-4 rounded-md border border-destructive/25 bg-destructive/5 p-3">
          <p className="font-body text-sm text-destructive">{error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 min-h-11"
            onClick={() => void retry()}
          >
            Retry
          </Button>
        </div>
      ) : devices.length > 0 ? (
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
                  <SaleroomPendingSubmit
                    pendingLabel="Revoking…"
                    variant="ghost"
                    className="min-h-11 text-error"
                    onRun={() =>
                      adminSaleroomDisplayRevokeAction({
                        saleId,
                        pairingId: device.id,
                      })
                    }
                  >
                    Revoke
                  </SaleroomPendingSubmit>
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
