"use client";

import { QrAnalyticsPanel } from "@/components/admin/qr-code/qr-analytics-panel";
import {
  type AdminQrCodeAnalytics as Analytics,
  type AdminQrCodeItem as QrCodeItem,
  adminLoadQrCodeDialogResultAction,
  adminRegenerateQrCodeResultAction,
} from "@/lib/actions/admin-qr-codes";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@auction/ui/components/dialog";
import { Skeleton } from "@auction/ui/components/skeleton";
import { Download, Printer, QrCode, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useId, useState } from "react";

const QRCodeSVG = dynamic(() => import("qrcode.react").then((m) => m.QRCodeSVG), {
  ssr: false,
  loading: () => <div className="size-56 animate-pulse rounded-lg bg-surface-container-high" />,
});

type EntityType = "sale" | "lot";

type Props = {
  entityType: EntityType;
  entityId: string;
  title: string;
};

export function AdminQrCodeButton({ entityType, entityId, title }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmRegenerateOpen, setConfirmRegenerateOpen] = useState(false);
  const [item, setItem] = useState<QrCodeItem | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [renderingPng, setRenderingPng] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const qrId = useId().replace(/:/g, "");

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <QrCode className="size-4" aria-hidden />
          QR code
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Marketing QR code</DialogTitle>
          <DialogDescription>
            Dynamic QR link for printed gallery and campaign material.
          </DialogDescription>
        </DialogHeader>
        {loading && !item ? <QrCodeDialogSkeleton /> : null}
        {!loading && loadError && !item ? (
          <div className="rounded-lg border border-error/30 bg-error-container/20 p-4 text-sm">
            <p className="font-medium text-on-surface">Could not load QR code</p>
            <p className="mt-1 text-on-surface-variant">{loadError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void load()}
            >
              Try again
            </Button>
          </div>
        ) : null}
        {item ? (
          <div className="space-y-5">
            <div className="flex justify-center rounded-xl border border-border-hairline bg-white p-5 dark:bg-surface-container-highest">
              <QRCodeSVG id={qrId} value={item.shortUrl} size={224} level="M" includeMargin />
            </div>
            <div className="space-y-1 text-sm">
              <p className="font-medium text-on-surface">Short URL</p>
              <p className="break-all text-on-surface-variant">{item.shortUrl}</p>
              <p className="break-all text-xs text-on-surface-variant">
                Destination: {item.destinationUrl}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => void copy()}
                disabled={actionsDisabled}
              >
                Copy link
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadSvg}
                disabled={actionsDisabled}
              >
                <Download className="size-4" aria-hidden />
                SVG
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void downloadPng()}
                disabled={actionsDisabled}
                aria-busy={renderingPng || undefined}
              >
                <Download className="size-4" aria-hidden />
                {renderingPng ? "Rendering..." : "PNG"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={print}
                disabled={actionsDisabled}
                aria-busy={printing || undefined}
              >
                <Printer className="size-4" aria-hidden />
                {printing ? "Opening print..." : "Print"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmRegenerateOpen(true)}
                disabled={actionsDisabled}
              >
                <RotateCcw className="size-4" aria-hidden />
                {regenerating ? "Regenerating..." : "Regenerate"}
              </Button>
            </div>
            <QrAnalyticsPanel qrCodeId={item.id} initialAnalytics={analytics} />
          </div>
        ) : null}
      </DialogContent>
      <Dialog open={confirmRegenerateOpen} onOpenChange={setConfirmRegenerateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Regenerate QR code?</DialogTitle>
            <DialogDescription>
              This creates a new QR link and disables the current one. Existing printed QR codes for
              this {entityType} will return inactive, while analytics history stays preserved.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmRegenerateOpen(false)}
              disabled={regenerating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void regenerate()}
              disabled={regenerating}
              aria-busy={regenerating || undefined}
            >
              {regenerating ? "Regenerating..." : "Regenerate QR code"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function QrCodeDialogSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading QR code details">
      <div className="flex justify-center rounded-xl border border-border-hairline bg-white p-5 dark:bg-surface-container-highest">
        <Skeleton className="size-56 rounded-lg" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-16" />
        <Skeleton className="h-9 w-16" />
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
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
