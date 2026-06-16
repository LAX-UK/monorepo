import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";

export type AdminHubQuickLink = {
  href: string;
  label: string;
  count?: number;
};

type Props = {
  links: readonly AdminHubQuickLink[];
  ariaLabel: string;
};

/** Shared quick-link grid for staff hub pages (finance, saleroom, conveyor, event RSVPs). */
export function AdminHubQuickLinks({ links, ariaLabel }: Props) {
  return (
    <section aria-label={ariaLabel} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {links.map((item) => (
        <Surface
          key={item.href}
          variant="quiet"
          padding="md"
          className="transition-colors hover:bg-surface-container-high"
        >
          <Link
            href={item.href}
            className="flex min-h-11 items-center justify-between gap-2 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface"
          >
            <span>{item.label}</span>
            {item.count != null && item.count > 0 ? (
              <span className="rounded-full bg-primary-container px-2 py-0.5 text-[10px] font-bold text-primary">
                {item.count}
              </span>
            ) : null}
          </Link>
        </Surface>
      ))}
    </section>
  );
}
