"use client";

import { type AccountNavItemVm, activeAccountNavId } from "@/server/domain/account-nav.vm";
import { cn } from "@auction/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountNavIcon } from "./account-nav-icons";

/**
 * The signed-in menu: a left rail on desktop and the body of the phone menu sheet. The current
 * page is marked with `aria-current` and a heavier weight with a filled row, so colour is never
 * the only cue.
 */
export function AccountNav({
  items,
  onNavigate,
  className,
}: {
  items: AccountNavItemVm[];
  /** Called when a link is followed, so the phone sheet can close. */
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const active = activeAccountNavId(pathname ?? "", items);
  return (
    <nav aria-label="Account" className={className}>
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const current = item.id === active;
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                {...(onNavigate ? { onClick: onNavigate } : {})}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                  current
                    ? "bg-surface-container font-semibold text-on-surface"
                    : "font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
                )}
              >
                <AccountNavIcon id={item.id} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
