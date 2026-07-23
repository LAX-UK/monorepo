import { cn } from "@auction/ui";

type Props = {
  warnings: string[];
  blocksAccept?: boolean;
  summaryLabel?: string | null;
  compact?: boolean;
};

export function SubmissionQualityBadges({
  warnings,
  blocksAccept = false,
  summaryLabel = null,
  compact,
}: Props) {
  if (!blocksAccept && warnings.length === 0) {
    return <span className="font-body text-xs text-on-surface-variant">—</span>;
  }

  if (compact) {
    const label =
      summaryLabel ??
      (blocksAccept
        ? "Missing required"
        : `${warnings.length} gap${warnings.length === 1 ? "" : "s"}`);
    return (
      <span
        className={cn(
          "inline-flex shrink-0 whitespace-nowrap rounded-md px-2 py-0.5 font-body text-xs font-medium",
          blocksAccept
            ? "bg-error-container/30 text-error"
            : "bg-warning-container/40 text-on-surface",
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <ul className="flex flex-wrap gap-1">
      {blocksAccept ? (
        <li>
          <span className="inline-flex shrink-0 whitespace-nowrap rounded-md bg-error-container/30 px-2 py-0.5 font-body text-[10px] font-medium text-error">
            Missing required fields
          </span>
        </li>
      ) : null}
      {warnings.map((label) => (
        <li key={label}>
          <span className="inline-flex shrink-0 whitespace-nowrap rounded-md bg-warning-container/40 px-2 py-0.5 font-body text-[10px] font-medium text-on-surface">
            {label}
          </span>
        </li>
      ))}
    </ul>
  );
}
