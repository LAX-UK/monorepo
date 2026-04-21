import type { BidErrorPresentation, BidErrorSeverity } from "@/lib/ui/bid-error";

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
        <p className={`font-label text-xs font-bold uppercase tracking-widest ${tone}`}>
          {error.title}
        </p>
      ) : null}
      <p className={`text-sm ${tone} ${error.title ? "mt-1" : ""}`}>{error.message}</p>
    </div>
  );
}
