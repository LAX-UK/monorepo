import { MediaImage } from "@/components/ui/media-image";
import type { PaymentDisplayRow } from "@/lib/data/view-models/dashboard-payments.vm";
import { lotPath } from "@/lib/seo/url";
import { Button } from "@auction/ui/components/button";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";

function statusVariant(tone: PaymentDisplayRow["statusTone"]) {
  switch (tone) {
    case "success":
      return "success" as const;
    case "danger":
      return "danger" as const;
    case "info":
      return "info" as const;
    case "neutral":
      return "neutral" as const;
  }
}

function PrimaryActionCell({ row }: { row: PaymentDisplayRow }) {
  const action = row.primaryAction;
  if (action.kind === "none") {
    return <span className="text-xs text-on-surface-variant">—</span>;
  }
  if (action.kind === "pay") {
    return (
      <Button variant="primary" asChild className="min-h-11 px-4 py-2 text-[10px]">
        <Link href={action.href}>{action.label}</Link>
      </Button>
    );
  }
  return (
    <a
      href={action.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={action.ariaLabel}
      className="inline-flex min-h-11 items-center text-xs font-semibold text-link underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {action.label}
    </a>
  );
}

/** Desktop payment row — use with `PaymentsMobileList` below `lg`. */
export function PaymentRowCard({ row }: { row: PaymentDisplayRow }) {
  return (
    <li className="lift-row">
      <Surface variant="card" padding="md" className="transition-colors hover:border-link/20">
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 text-sm">
          <Link
            href={lotPath({ id: row.lotId, title: row.lotTitle })}
            className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label={`View ${row.lotTitle}`}
          >
            <MediaImage src={row.lotImageUrl} alt="" label="Lot artwork" sizes="56px" />
          </Link>
          <div className="min-w-0">
            <Link
              href={lotPath({ id: row.lotId, title: row.lotTitle })}
              className="block truncate font-headline text-sm font-semibold text-on-surface underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {row.lotTitle}
            </Link>
            <p className="text-xs text-on-surface-variant">
              <time dateTime={row.createdAtIso}>{row.createdAtLabel}</time>
              {row.invoiceNumber ? <> · Invoice {row.invoiceNumber}</> : null}
            </p>
          </div>
          <div className="text-right text-base font-semibold tabular-nums text-on-surface">
            {row.amountLabel}
          </div>
          <div className="flex items-center justify-end">
            <StatusBadge variant={statusVariant(row.statusTone)} size="sm">
              {row.statusLabel}
            </StatusBadge>
          </div>
          <div className="flex justify-end">
            <PrimaryActionCell row={row} />
          </div>
        </div>
      </Surface>
    </li>
  );
}
