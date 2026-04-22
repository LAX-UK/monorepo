import { ChevronLeft } from "lucide-react";
import Link from "next/link";

type Props = {
  backHref: string;
  title: string;
  lotCount: number;
  closesLabel: string;
};

/** Thin context row above the lot split: return to parent sale, title, size, end. */
export function LotSaleContext({ backHref, title, lotCount, closesLabel }: Props) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-outline-variant/20 pb-4 text-sm text-on-surface-variant">
      <Link
        href={backHref}
        className="inline-flex min-w-0 max-w-full items-center gap-1 font-medium text-on-surface transition-colors hover:text-primary"
      >
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        Back to sale
      </Link>
      <span className="text-on-surface-variant" aria-hidden>
        ·
      </span>
      <span
        className="min-w-0 max-w-[min(100%,28rem)] truncate font-medium text-on-surface"
        title={title}
      >
        {title}
      </span>
      <span className="text-on-surface-variant" aria-hidden>
        ·
      </span>
      <span>
        {lotCount} {lotCount === 1 ? "lot" : "lots"}
      </span>
      <span className="text-on-surface-variant" aria-hidden>
        ·
      </span>
      <span>Closes {closesLabel}</span>
    </div>
  );
}
