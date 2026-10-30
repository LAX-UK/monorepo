import type { HomeLinkView } from "@/lib/organisation-home/organisation-home-view";
import { CalendarDays, ChevronRight, type LucideIcon, ReceiptText, UserPlus } from "lucide-react";
import Link from "next/link";
import { HomePanel, HomeSection } from "./home-section";

const ICON: Record<string, LucideIcon> = {
  invite: UserPlus,
  statements: ReceiptText,
  sales: CalendarDays,
};

/**
 * Pages the people who run the organisation use often, as a short list. "Sell a work" sits beside
 * the page title, so it is not repeated here. The domain gives shortcuts only to owners and
 * admins; any other role's list is empty and the section is left out.
 */
export function HomeShortcuts({ shortcuts }: { shortcuts: readonly HomeLinkView[] }) {
  if (shortcuts.length === 0) return null;
  return (
    <HomeSection id="home-shortcuts" title="Shortcuts">
      <HomePanel>
        <nav aria-labelledby="home-shortcuts">
          <ul className="p-1">
            {shortcuts.map((shortcut) => {
              const Icon = ICON[shortcut.id] ?? ChevronRight;
              return (
                <li key={shortcut.id}>
                  <Link
                    href={shortcut.href}
                    className="flex h-11 items-center gap-3 rounded-lax-menu px-4 text-lax-14 font-medium text-lax-fg transition-colors duration-150 hover:bg-lax-hover active:bg-lax-pressed focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-lax-focus"
                  >
                    <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
                    {shortcut.label}
                    <ChevronRight
                      className="ml-auto size-3.5 shrink-0 text-lax-muted"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </HomePanel>
    </HomeSection>
  );
}
