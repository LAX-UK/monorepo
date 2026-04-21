type Props = {
  owned: boolean;
  className?: string;
};

/** Shown on lot cards when the signed-in user is the lot seller. */
export function OwnerBadge({ owned, className = "" }: Props) {
  if (!owned) return null;
  return (
    <span
      className={`inline-flex shrink-0 rounded-md bg-surface/95 px-2 py-1 font-label text-[0.6rem] font-bold uppercase tracking-widest text-primary shadow-sm ring-1 ring-primary/25 ${className}`}
      aria-label="Your listing"
    >
      Your listing
    </span>
  );
}
