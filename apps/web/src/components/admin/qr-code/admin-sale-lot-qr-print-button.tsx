"use client";

import { adminEnsureLotQrCodesForPrintResultAction } from "@/lib/actions/admin-qr-codes";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { renderToStaticMarkup } from "react-dom/server";

type LotQrRow = {
  id: string;
  title: string;
  lotNumber: number | null;
};

type Props = {
  lots: LotQrRow[];
};

export function AdminSaleLotQrPrintButton({ lots }: Props) {
  const print = async () => {
    const win = openPrintWindow();
    if (!win) {
      notify.error("Could not open print window. Please allow pop-ups and try again.");
      return;
    }
    win.document.write(`<!doctype html><html><head><title>Lot QR labels</title></head><body>
      <p style="font-family:Arial,sans-serif;margin:24px">Preparing QR labels...</p>
    </body></html>`);
    win.document.close();

    try {
      const result = await adminEnsureLotQrCodesForPrintResultAction(lots);
      if (!result.ok) {
        win.close();
        notify.error(result.error);
        return;
      }
      const rows = result.data ?? [];
      const labels = rows
        .map((row) => {
          const svg = renderToStaticMarkup(
            <QRCodeSVG value={row.shortUrl} size={160} level="M" includeMargin />,
          );
          const heading = row.lotNumber == null ? "Lot" : `Lot #${row.lotNumber}`;
          return `<section class="label"><h2>${escapeHtml(heading)}</h2><p>${escapeHtml(row.title)}</p><div>${svg}</div><small>${escapeHtml(row.shortUrl)}</small></section>`;
        })
        .join("");
      win.document.open();
      win.document.write(`<!doctype html><html><head><title>Lot QR labels</title><style>
        body{font-family:Arial,sans-serif;color:#111;margin:24px}
        .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
        .label{break-inside:avoid;border:1px solid #ddd;padding:16px;text-align:center}
        h2{margin:0 0 4px;font-size:16px} p{min-height:36px;margin:0 0 10px;font-size:13px}
        small{display:block;margin-top:6px;word-break:break-all;font-size:9px}
        @media print{body{margin:12mm}.grid{gap:10mm}}
      </style></head><body><h1>Scan to view</h1><div class="grid">${labels}</div></body></html>`);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 0);
    } catch (error) {
      win.close();
      notify.error(error instanceof Error ? error.message : "Could not print lot QR labels");
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void print()}
      disabled={lots.length === 0}
    >
      <Printer className="size-4" aria-hidden />
      Print lot QR labels
    </Button>
  );
}

function openPrintWindow(): Window | null {
  const win = window.open("", "_blank");
  if (win) win.opener = null;
  return win;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
