import type { BidErrorPresentation, BidErrorSeverity } from "@/lib/ui/bid-error";
import Link from "next/link";

const severityClass: Record<BidErrorSeverity, string> = {
  error: "text-error",
  info: "text-on-surface",
  warning: "text-[color:var(--color-tertiary,#b45309)] dark:text-orange-300",
};

export function BidErrorView({
  error,
  className,
}: {
  error: BidErrorPresentation | null;
  className?: string;
}) {
  if (!error) return null;
  const tone = severityClass[error.severity];
  return (
    <div className={className} role="alert">
      {error.title ? (
        <p
          className={`font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] ${tone}`}
        >
          {error.title}
        </p>
      ) : null}
      <p className={`text-sm ${tone} ${error.title ? "mt-1" : ""}`}>{error.message}</p>
      {error.actionHref ? (
        <Link
          href={error.actionHref}
          className={`mt-2 inline-block text-sm font-medium underline underline-offset-2 ${tone}`}
        >
          {error.actionLabel ?? "Continue"}
        </Link>
      ) : null}
    </div>
  );
}
