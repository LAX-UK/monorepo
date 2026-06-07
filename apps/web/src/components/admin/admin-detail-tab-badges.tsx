/** Shared tab badges for admin entity detail pages. */

export function AdminDetailTabCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="rounded-full bg-surface-container-high px-1.5 font-mono text-[10px] tabular-nums text-on-surface-variant">
      {count}
    </span>
  );
}

export function AdminDetailTabAttentionBadge() {
  return (
    <span className="size-1.5 shrink-0 rounded-full bg-warning" aria-label="Needs attention" />
  );
}
