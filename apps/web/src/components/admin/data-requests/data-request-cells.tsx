import {
  PRODUCT_LABELS,
  dueCell,
  productDots,
  productsDoneText,
} from "@/lib/admin/data-requests/data-requests.vm";
import type {
  DataRequestProduct,
  DataRequestView,
} from "@auction/identity-contracts/data-requests";
import { StatusBadge, cn } from "@auction/staff-ui";

/** The products a request covers as small outlined chips: Account, Bid, Shop. */
export function ProductChips({ products }: { products: readonly DataRequestProduct[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {products.map((product) => (
        <span
          key={product}
          className="inline-flex h-5 items-center rounded-staff-xs border border-staff-line px-1.5 text-staff-xs text-staff-fg"
        >
          {PRODUCT_LABELS[product]}
        </span>
      ))}
    </span>
  );
}

const DOT = {
  done: "bg-staff-ink",
  wait: "border border-staff-control-border bg-transparent",
  retry: "bg-staff-warning-dot",
} as const;

/** One dot per product in scope, filled when gathered, and the count in words beside them. */
export function ProductsDone({ request }: { request: DataRequestView }) {
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      <span aria-hidden className="inline-flex gap-1">
        {productDots(request).map((dot, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the dots are positional and never reorder
          <i key={index} className={cn("size-2 rounded-full", DOT[dot])} />
        ))}
      </span>
      <span className="text-staff-sm text-staff-muted">{productsDoneText(request)}</span>
    </span>
  );
}

/** The legal date over where the request stands against it; the tone is never the only cue. */
export function DueColumn({ request }: { request: DataRequestView }) {
  const cell = dueCell(request);
  return (
    <span className="flex min-w-0 flex-col items-start gap-0.5">
      <span className="tabular-nums text-staff-fg">{cell.date}</span>
      {cell.badge ? (
        <StatusBadge tone={cell.tone}>{cell.text}</StatusBadge>
      ) : (
        <span className="truncate text-staff-xs leading-4 text-staff-muted">{cell.text}</span>
      )}
    </span>
  );
}
