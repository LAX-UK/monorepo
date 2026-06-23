import { formatArtistLotsLabel } from "@/lib/artists/lot-count-presenter";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import Link from "next/link";

type Props = {
  lotCount: number;
  href: string;
  artistName: string;
  className?: string;
  /** Footer link on cards vs inline label in list rows. */
  variant?: "footer" | "inline";
};

const variantClassName = {
  footer:
    "text-[length:var(--text-label-1)] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link",
  inline:
    "text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant hover:text-link",
} as const;

/** Footer "N lots" link for directory cards — omitted when count is zero. */
export function ArtistDirectoryLotsLink({
  lotCount,
  href,
  artistName,
  className,
  variant = "footer",
}: Props) {
  if (lotCount === 0) return null;

  const lotsLabel = formatArtistLotsLabel(lotCount);
  return (
    <Link
      href={`${href}#works`}
      className={cn(
        `rounded-sm font-label hover:underline ${FOCUS_RING}`,
        variantClassName[variant],
        className,
      )}
      aria-label={`Browse ${lotsLabel} by ${artistName}`}
    >
      {lotsLabel}
    </Link>
  );
}
