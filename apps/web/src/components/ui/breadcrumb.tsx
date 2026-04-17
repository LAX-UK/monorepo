import Link from "next/link";

export type BreadcrumbItem = { label: string; href?: string | undefined };

export function Breadcrumb({
  items,
  ariaLabel = "Breadcrumb",
}: { items: BreadcrumbItem[]; ariaLabel?: string }) {
  return (
    <nav
      aria-label={ariaLabel}
      className="font-label text-xs uppercase tracking-[0.2em] text-secondary"
    >
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-2">
            {i > 0 ? (
              <span aria-hidden className="text-outline-variant">
                /
              </span>
            ) : null}
            {item.href ? (
              <Link href={item.href} className="transition-colors hover:text-primary">
                {item.label}
              </Link>
            ) : (
              <span className="text-on-surface" aria-current="page">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
