"use client";

import { QrAnalyticsPanel } from "@/components/admin/qr-code/qr-analytics-panel";
import {
  adminLoadQrCodeDialogResultAction,
  adminRegenerateQrCodeResultAction,
} from "@/lib/actions/admin-qr-codes";
import type { AdminQrCodeItem as QrCodeItem } from "@/lib/services/interfaces/admin-qr-codes-service";
import { notify } from "@/lib/ui/notify";
import { ConfirmActionDialog, Notice, Skeleton, StaffButton, StaffDialog } from "@auction/staff-ui";
import type { QrCodeDetailedAnalytics } from "@auction/validators";
import { Download, Printer, QrCode, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useId, useState } from "react";

const QRCodeSVG = dynamic(() => import("qrcode.react").then((m) => m.QRCodeSVG), {
  ssr: false,
  loading: () => <Skeleton className="size-56 rounded-staff-lg" />,
});

type EntityType = "sale" | "lot";

type Props = {
  entityType: EntityType;
  entityId: string;
  title: string;
  /** Controlled from elsewhere (a page's overflow menu): no trigger button is rendered. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function AdminQrCodeButton({
  entityType,
  entityId,
  title,
  open: controlledOpen,
  onOpenChange,
}: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (!controlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const [confirmRegenerateOpen, setConfirmRegenerateOpen] = useState(false);
  const [item, setItem] = useState<QrCodeItem | null>(null);
  const [analytics, setAnalytics] = useState<QrCodeDetailedAnalytics | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [renderingPng, setRenderingPng] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [analyticsSession, setAnalyticsSession] = useState(0);
  const qrId = useId().replace(/:/g, "");

  useEffect(() => {
    if (open) setAnalyticsSession((session) => session + 1);
  }, [open]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await adminLoadQrCodeDialogResultAction(entityType, entityId);
      if (!result.ok) {
        setLoadError(result.error);
        notify.error(result.error);
        return;
      }
      setItem(result.data?.item ?? null);
      setAnalytics(result.data?.analytics ?? null);
      setLoadError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load QR code";
      setLoadError(message);
      notify.error(message);
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType]);

  useEffect(() => {
    if (!open || item) return;
    void load();
  }, [item, load, open]);

  const copy = async () => {
    if (!item) return;
    await navigator.clipboard.writeText(item.shortUrl);
    notify.success("QR link copied");
  };

  const downloadSvg = () => {
    const svg = document.getElementById(qrId);
    if (!svg) return;
    downloadBlob(
      new Blob([serializeSvg(svg)], { type: "image/svg+xml;charset=utf-8" }),
      `${entityType}-${entityId}-qr.svg`,
    );
  };

  const downloadPng = async () => {
    const svg = document.getElementById(qrId);
    if (!svg) {
      notify.error("QR code is still rendering. Please try again.");
      return;
    }
    setRenderingPng(true);
    const blob = new Blob([serializeSvg(svg)], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Could not render QR PNG"));
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 1200;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((png) => {
        if (png) downloadBlob(png, `${entityType}-${entityId}-qr.png`);
      }, "image/png");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Could not render QR PNG");
    } finally {
      URL.revokeObjectURL(url);
      setRenderingPng(false);
    }
  };

  const print = () => {
    if (!item) return;
    setPrinting(true);
    const svgElement = document.getElementById(qrId);
    const svg = svgElement ? serializeSvg(svgElement) : null;
    if (!svg) {
      setPrinting(false);
      notify.error("QR code is still rendering. Please try again.");
      return;
    }
    const win = openPrintWindow();
    if (!win) {
      setPrinting(false);
      notify.error("Could not open print window. Please allow pop-ups and try again.");
      return;
    }
    win.document.write(`<!doctype html><html><head><title>QR code</title><style>
      body{font-family:Arial,sans-serif;margin:32px;text-align:center;color:#111}
      .qr{display:inline-block;border:1px solid #ddd;padding:24px;margin:24px auto}
      h1{font-size:20px;margin:0 0 8px} p{margin:6px 0}
    </style></head><body><h1>Scan to view</h1><p>${escapeHtml(title)}</p><div class="qr">${svg}</div><p>${escapeHtml(item.shortUrl)}</p></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      setPrinting(false);
    }, 0);
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const result = await adminRegenerateQrCodeResultAction(entityType, entityId);
      if (!result.ok) {
        notify.error(result.error);
        return;
      }
      setItem(result.data ?? null);
      setAnalytics(null);
      notify.success("QR code regenerated");
      setConfirmRegenerateOpen(false);
      await load();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Could not regenerate QR code");
    } finally {
      setRegenerating(false);
    }
  };

  const actionsDisabled = loading || renderingPng || printing || regenerating;

  return (
    <>
      {controlled ? null : (
        <StaffButton
          size="sm"
          variant="secondary"
          icon={<QrCode aria-hidden />}
          onClick={() => setOpen(true)}
        >
          QR code
        </StaffButton>
      )}
      <StaffDialog
        open={open}
        onOpenChange={setOpen}
        size="md"
        title="Marketing QR code"
        description="Dynamic QR link for printed gallery and campaign material."
        footer={
          <StaffButton variant="secondary" onClick={() => setOpen(false)}>
            Close
          </StaffButton>
        }
      >
        {loading && !item ? <QrCodeDialogSkeleton /> : null}
        {!loading && loadError && !item ? (
          <Notice
            tone="danger"
            alert
            title="Could not load QR code"
            actions={
              <StaffButton size="sm" variant="secondary" onClick={() => void load()}>
                Try again
              </StaffButton>
            }
          >
            {loadError}
          </Notice>
        ) : null}
        {item ? (
          <div className="flex flex-col gap-5">
            <div className="flex justify-center rounded-staff-lg border border-staff-line bg-white p-5">
              <QRCodeSVG id={qrId} value={item.shortUrl} size={224} level="M" includeMargin />
            </div>
            <div className="flex flex-col gap-1 text-staff-sm">
              <p className="font-medium text-staff-fg">Short URL</p>
              <p className="break-all text-staff-muted">{item.shortUrl}</p>
              <p className="break-all text-staff-xs text-staff-muted">
                Destination: {item.destinationUrl}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StaffButton
                size="sm"
                variant="primary"
                onClick={() => void copy()}
                disabled={actionsDisabled}
              >
                Copy link
              </StaffButton>
              <StaffButton
                size="sm"
                variant="secondary"
                icon={<Download aria-hidden />}
                onClick={downloadSvg}
                disabled={actionsDisabled}
              >
                SVG
              </StaffButton>
              <StaffButton
                size="sm"
                variant="secondary"
                icon={<Download aria-hidden />}
                loading={renderingPng}
                onClick={() => void downloadPng()}
                disabled={actionsDisabled}
              >
                PNG
              </StaffButton>
              <StaffButton
                size="sm"
                variant="secondary"
                icon={<Printer aria-hidden />}
                loading={printing}
                onClick={print}
                disabled={actionsDisabled}
              >
                Print
              </StaffButton>
              <StaffButton
                size="sm"
                variant="secondary"
                icon={<RotateCcw aria-hidden />}
                loading={regenerating}
                onClick={() => setConfirmRegenerateOpen(true)}
                disabled={actionsDisabled}
              >
                Regenerate
              </StaffButton>
            </div>
            <QrAnalyticsPanel
              key={analyticsSession}
              qrCodeId={item.id}
              initialAnalytics={analytics}
            />
          </div>
        ) : null}
      </StaffDialog>
      <ConfirmActionDialog
        open={confirmRegenerateOpen}
        onOpenChange={setConfirmRegenerateOpen}
        title="Regenerate QR code?"
        description={`This creates a new QR link and disables the current one. Existing printed QR codes for this ${entityType} will return inactive, while analytics history stays preserved.`}
        confirmLabel="Regenerate QR code"
        cancelLabel="Keep current code"
        tone="danger"
        loading={regenerating}
        onConfirm={() => void regenerate()}
      />
    </>
  );
}

function QrCodeDialogSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading QR code details">
      <div className="flex justify-center rounded-staff-lg border border-staff-line bg-white p-5">
        <Skeleton className="size-56 rounded-staff-lg" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-28" />
      </div>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function openPrintWindow(): Window | null {
  const win = window.open("", "_blank");
  if (win) win.opener = null;
  return win;
}

function serializeSvg(svg: Element): string {
  const clone = svg.cloneNode(true);
  if (!(clone instanceof SVGSVGElement)) {
    return svg.outerHTML;
  }

  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  if (!clone.getAttribute("width")) clone.setAttribute("width", "224");
  if (!clone.getAttribute("height")) clone.setAttribute("height", "224");
  if (!clone.getAttribute("viewBox")) {
    const width = clone.getAttribute("width") ?? "224";
    const height = clone.getAttribute("height") ?? "224";
    clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }
  return new XMLSerializer().serializeToString(clone);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
