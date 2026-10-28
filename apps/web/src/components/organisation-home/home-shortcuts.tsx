import type { HomeLinkView } from "@/lib/organisation-home/organisation-home-view";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";
import { HomeSectionHeading } from "./home-section-heading";

/** Two to four pages the role uses often. */
export function HomeShortcuts({ shortcuts }: { shortcuts: readonly HomeLinkView[] }) {
  if (shortcuts.length === 0) return null;
  return (
    <Surface variant="section" padding="none" className="space-y-3 p-4 sm:p-6">
      <HomeSectionHeading id="home-shortcuts">Shortcuts</HomeSectionHeading>
      <nav aria-labelledby="home-shortcuts">
        <ul className="flex flex-wrap gap-2">
          {shortcuts.map((shortcut) => (
            <li key={shortcut.id}>
              <Button asChild size="sm" variant="outline">
                <Link href={shortcut.href}>{shortcut.label}</Link>
              </Button>
            </li>
          ))}
        </ul>
      </nav>
    </Surface>
  );
}
