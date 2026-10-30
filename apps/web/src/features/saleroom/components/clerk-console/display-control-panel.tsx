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
import {
  Field,
  Notice,
  Skeleton,
  StaffButton,
  StatusBadge,
  TextInput,
  TextLink,
} from "@auction/staff-ui";
import type { SaleroomDisplayOverlay } from "@auction/types";
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

  const listed = devices.filter((d) => d.status === "paired" || d.status === "pending");

  return (
    <ConsolePanel variant={panelVariant} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <PanelHeading>Venue display</PanelHeading>
          <p className="mt-1 text-staff-sm text-staff-muted">
            Open the{" "}
            <TextLink href={`/display/${saleId}`} Link={Link} className="align-baseline leading-5">
              display page
            </TextLink>{" "}
            on the venue screen, then enter the code it shows.
          </p>
        </div>
        <StaffButton
          variant="secondary"
          size="lg"
          icon={copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          onClick={() => void copyDisplayUrl()}
        >
          {copied ? "Copied" : "Copy display link"}
        </StaffButton>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Field
          label="Display code from the screen"
          id={`display-code-${saleId}`}
          className="min-w-40 flex-1"
        >
          <TextInput
            size="lg"
            value={pairingCode}
            onChange={(e) => setPairingCode(e.target.value)}
            placeholder="For example ABCD-1234"
            className="font-mono uppercase tracking-widest placeholder:tracking-normal placeholder:normal-case"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
        <SaleroomPendingSubmit
          pendingLabel="Approving…"
          variant="primary"
          size="lg"
          {...(pairingCode.trim().length < 4
            ? { disabledReason: "Enter the code shown on the venue screen" }
            : {})}
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
        <Notice tone="info" title="On the venue display now">
          {activeOverlayLabel}
        </Notice>
      ) : null}

      <DisplayOverlayActions saleId={saleId} initialOverlay={initialOverlay} />

      {isLoading ? (
        <output
          className="flex flex-col gap-2"
          aria-busy="true"
          aria-label="Loading display devices"
        >
          <Skeleton className="h-12 w-full rounded-staff-sm" />
          <Skeleton className="h-12 w-full rounded-staff-sm" />
        </output>
      ) : error ? (
        <Notice
          tone="danger"
          alert
          title="Could not load the venue displays"
          actions={
            <StaffButton variant="secondary" size="sm" onClick={() => void retry()}>
              Try again
            </StaffButton>
          }
        >
          {error}
        </Notice>
      ) : listed.length > 0 ? (
        <ul className="flex flex-col gap-2" aria-label="Paired displays">
          {listed.map((device) => (
            <li
              key={device.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-staff-sm border border-staff-line-subtle bg-staff-sunken px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-2 text-staff-sm">
                <span className="font-mono font-medium tracking-widest text-staff-fg">
                  {device.userCode}
                </span>
                <StatusBadge tone={device.status === "paired" ? "success" : "warning"}>
                  {device.status === "paired" ? "Paired" : "Waiting for approval"}
                </StatusBadge>
                {device.status === "paired" ? (
                  <StatusBadge tone={device.isOnline ? "success" : "neutral"}>
                    {device.isOnline ? "Online" : "Offline"}
                  </StatusBadge>
                ) : null}
              </div>
              {device.status === "paired" ? (
                <SaleroomPendingSubmit
                  pendingLabel="Revoking…"
                  variant="danger-secondary"
                  onRun={() =>
                    adminSaleroomDisplayRevokeAction({
                      saleId,
                      pairingId: device.id,
                    })
                  }
                >
                  Revoke display
                </SaleroomPendingSubmit>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-staff-sm text-staff-muted">No paired displays yet.</p>
      )}
    </ConsolePanel>
  );
}
