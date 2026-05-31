"use client";

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
  const [item, setItem] = useState<QrCodeItem | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const qrId = useId().replace(/:/g, "");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminLoadQrCodeDialogResultAction(entityType, entityId);
      if (!result.ok) {
        notify.error(result.error);
        return;
      }
      setItem(result.data?.item ?? null);
      setAnalytics(result.data?.analytics ?? null);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Could not load QR code");
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
      new Blob([svg.outerHTML], { type: "image/svg+xml;charset=utf-8" }),
      `${entityType}-${entityId}-qr.svg`,
    );
  };

  const downloadPng = async () => {
    const svg = document.getElementById(qrId);
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: "image/svg+xml;charset=utf-8" });
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
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const print = () => {
    if (!item) return;
    const svg = document.getElementById(qrId)?.outerHTML;
    if (!svg) return;
    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) return;
    win.document.write(`<!doctype html><html><head><title>QR code</title><style>
      body{font-family:Arial,sans-serif;margin:32px;text-align:center;color:#111}
      .qr{display:inline-block;border:1px solid #ddd;padding:24px;margin:24px auto}
      h1{font-size:20px;margin:0 0 8px} p{margin:6px 0}
    </style></head><body><h1>Scan to view</h1><p>${escapeHtml(title)}</p><div class="qr">${svg}</div><p>${escapeHtml(item.shortUrl)}</p></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const regenerate = async () => {
    if (
      !window.confirm(
        "Regenerate this QR code? Existing printed QR codes for this item will stop working.",
      )
    ) {
      return;
    }
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
      await load();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Could not regenerate QR code");
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <QrCode className="size-4" aria-hidden />
          QR code
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Marketing QR code</DialogTitle>
          <DialogDescription>
            Dynamic QR link for printed gallery and campaign material.
          </DialogDescription>
        </DialogHeader>
        {loading ? <p className="text-sm text-on-surface-variant">Loading QR code...</p> : null}
        {item ? (
          <div className="space-y-5">
            <div className="flex justify-center rounded-xl border border-border-hairline bg-white p-5">
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
              <Button type="button" size="sm" onClick={() => void copy()}>
                Copy link
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={downloadSvg}>
                <Download className="size-4" aria-hidden />
                SVG
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void downloadPng()}>
                <Download className="size-4" aria-hidden />
                PNG
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={print}>
                <Printer className="size-4" aria-hidden />
                Print
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void regenerate()}
                disabled={regenerating}
              >
                <RotateCcw className="size-4" aria-hidden />
                {regenerating ? "Regenerating..." : "Regenerate"}
              </Button>
            </div>
            <div className="rounded-lg bg-surface-container-high p-3 text-sm">
              <p className="font-medium text-on-surface">Last 30 days</p>
              <p className="text-on-surface-variant">
                {analytics?.totalScans ?? 0} scans
                {analytics?.byDevice[0] ? `, top device: ${analytics.byDevice[0].deviceType}` : ""}
              </p>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
