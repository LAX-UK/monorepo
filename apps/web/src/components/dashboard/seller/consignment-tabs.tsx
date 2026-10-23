import { cn } from "@auction/ui";
import Link from "next/link";

export type ConsignmentTabLink = {
  id: string;
  label: string;
  count: number;
  href: string;
  active: boolean;
};

type Props = {
  tabs: readonly ConsignmentTabLink[];
};

/** Status tabs for the consignments list: plain links, so the tab lives in the URL. */
export function ConsignmentTabs({ tabs }: Props) {
  return (
    <nav aria-label="Consignment status">
      <ul className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <li key={tab.id}>
            <Link
              href={tab.href}
              scroll={false}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 font-body text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                tab.active
                  ? "border-primary bg-surface-container-low font-semibold text-on-surface"
                  : "border-border-hairline text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
              )}
            >
              {tab.label}
              <span className="tabular-nums text-on-surface-variant">{tab.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
