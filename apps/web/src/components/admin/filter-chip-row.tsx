import Link from "next/link";

export type FilterChip = {
  id: string;
  label: string;
  href: string;
  active?: boolean;
};

export function FilterChipRow({ chips, label }: { chips: FilterChip[]; label: string }) {
  return (
    <fieldset className="flex min-w-0 flex-wrap gap-2 border-0 p-0">
      <legend className="sr-only">{label}</legend>
      {chips.map((chip) => (
        <Link
          key={chip.id}
          href={chip.href}
          aria-current={chip.active ? "page" : undefined}
          className={`min-h-11 rounded-full px-4 py-2 font-label text-xs uppercase tracking-widest ring-1 transition-colors ${
            chip.active
              ? "bg-primary text-on-primary ring-primary"
              : "bg-surface-container-low text-on-surface ring-outline-variant/20 hover:bg-surface-container-high/80"
          }`}
        >
          {chip.label}
        </Link>
      ))}
    </fieldset>
  );
}
