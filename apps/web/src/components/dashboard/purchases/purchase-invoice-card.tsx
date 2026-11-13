import type {
  InvoiceCardLink,
  PurchaseInvoiceCardVm,
} from "@/lib/purchases/purchase-invoice-card.vm";
import { cn } from "@auction/ui/lib/utils";
import { AlertTriangle, Download, FileText, FileX } from "lucide-react";

const ROW_LINK =
  "-mx-2 flex items-center gap-3 rounded-lax-control px-2 py-2 hover:bg-lax-hover lax-focus";
const ICON_BOX =
  "grid size-9 shrink-0 place-items-center rounded-lax-control border border-lax-line text-lax-muted";

/** One downloadable PDF: the stored Books copy, or LAX's own invoice. */
function DownloadRow({
  link,
  title,
  meta,
  srLabel,
}: {
  link: InvoiceCardLink;
  title: string;
  meta?: string;
  srLabel?: string;
}) {
  return (
    <a href={link.href} target="_blank" rel="noopener noreferrer" className={ROW_LINK}>
      <span className={ICON_BOX}>
        <FileText aria-hidden className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lax-14 font-medium text-lax-fg">{title}</span>
        {meta ? <span className="block text-lax-13 text-lax-muted">{meta}</span> : null}
      </span>
      <Download aria-hidden className="size-4 shrink-0 text-lax-muted" />
      {srLabel ? <span className="sr-only">{srLabel}</span> : null}
    </a>
  );
}

/**
 * The invoice on a purchase: being prepared (and late), issued under its Books number with LAX's
 * stored PDF and any credit notes, cancelled, or LAX's own invoice while Books does not issue it.
 */
export function PurchaseInvoiceCard({ card }: { card: PurchaseInvoiceCardVm }) {
  switch (card.kind) {
    case "lax":
      return card.download ? (
        <DownloadRow
          link={card.download}
          title="Invoice"
          meta="PDF"
          srLabel="Download the invoice"
        />
      ) : (
        <p className="text-lax-14 text-lax-muted">{card.empty}</p>
      );
    case "preparing":
    case "delayed":
      return (
        <div className="flex flex-col gap-3" data-invoice-state={card.kind}>
          <div className="flex items-start gap-3">
            <span className={ICON_BOX}>
              <FileText aria-hidden className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-lax-14 font-medium text-lax-fg">{card.title}</p>
              {card.kind === "preparing" ? (
                <p className="text-lax-13 text-lax-muted">{card.detail}</p>
              ) : null}
            </div>
          </div>
          {card.kind === "delayed" ? (
            <output className="flex gap-2 rounded-lax-control bg-lax-warning-bg px-3 py-2 text-lax-13 text-lax-warning-fg">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>{card.detail}</span>
            </output>
          ) : null}
          <p className="text-lax-13 text-lax-muted">{card.note}</p>
        </div>
      );
    case "issued":
      return (
        <div className="flex flex-col gap-1" data-invoice-state="issued">
          <div className="flex flex-col">
            <p className="text-lax-14 font-medium text-lax-fg">{card.title}</p>
            <p className="text-lax-13 text-lax-muted">{card.meta}</p>
          </div>
          <DownloadRow link={card.download} title={card.download.label} />
          {card.credits.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1 border-t border-lax-line pt-3">
              {card.credits.map((credit) => (
                <li key={credit.link.href}>
                  <p className="text-lax-14 tabular-nums text-lax-fg">{credit.label}</p>
                  <a
                    href={credit.link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "inline-flex items-center gap-2 text-lax-13 text-lax-fg underline underline-offset-4",
                      "lax-focus rounded-lax-control",
                    )}
                  >
                    <Download aria-hidden className="size-3.5" />
                    {credit.link.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      );
    case "cancelled":
      return (
        <div className="flex items-start gap-3" data-invoice-state="cancelled">
          <span className={ICON_BOX}>
            <FileX aria-hidden className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-lax-14 font-medium text-lax-fg">{card.title}</p>
            <p className="text-lax-13 text-lax-muted">{card.detail}</p>
          </div>
        </div>
      );
  }
}
