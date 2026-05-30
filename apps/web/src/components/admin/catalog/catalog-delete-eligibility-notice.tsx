type Props = {
  blockers: readonly string[];
  entityLabel: "sale" | "lot";
};

/** Explains why soft-delete is blocked for pre-live catalogue rows. */
export function CatalogDeleteEligibilityNotice({ blockers, entityLabel }: Props) {
  if (blockers.length === 0) return null;

  return (
    <div className="rounded-lg border border-border-hairline bg-surface-container-low px-4 py-3">
      <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
        Cannot delete {entityLabel}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-4 font-body text-sm text-on-surface-variant">
        {blockers.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      <p className="mt-3 font-body text-xs text-on-surface-variant">
        Use cancel if the {entityLabel} must stop while staying visible in admin lists.
      </p>
    </div>
  );
}
