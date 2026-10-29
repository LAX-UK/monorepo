import type { HomeLinkView } from "@/lib/organisation-home/organisation-home-view";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { HomeSection } from "./home-section";

/**
 * Two to four pages the people who run the organisation use often. The domain gives them only
 * to owners and admins; any other role's list is empty and the section is left out.
 */
export function HomeShortcuts({ shortcuts }: { shortcuts: readonly HomeLinkView[] }) {
  if (shortcuts.length === 0) return null;
  return (
    <HomeSection id="home-shortcuts" title="Shortcuts">
      <nav aria-labelledby="home-shortcuts">
        <ul className="flex flex-wrap gap-2">
          {shortcuts.map((shortcut) => (
            <li key={shortcut.id}>
              <Button asChild size="default" variant="outline">
                <Link href={shortcut.href}>{shortcut.label}</Link>
              </Button>
            </li>
          ))}
        </ul>
      </nav>
    </HomeSection>
  );
}
