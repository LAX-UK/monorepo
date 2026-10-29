import type { FirstRunView } from "@/lib/organisation-home/organisation-dashboard-view";
import { Button } from "@auction/ui/components/button";
import { EmptyState } from "@auction/ui/components/empty-state";
import Link from "next/link";

/** The people who run a new organisation get the full first steps; other members a quiet note. */
const SIZE: Record<FirstRunView["addressee"], "panel" | "compact"> = {
  organisation: "panel",
  member: "compact",
};

/**
 * Home before anything has happened for this member: their first steps instead of a grid of
 * empty figures. The first step is the primary action; the second, if any, is secondary.
 */
export function HomeFirstRun({ firstRun }: { firstRun: FirstRunView }) {
  return (
    <EmptyState
      illustration="easel"
      size={SIZE[firstRun.addressee]}
      headingLevel="h2"
      title={firstRun.title}
      description={firstRun.description}
      {...(firstRun.actions.length > 0
        ? {
            action: firstRun.actions.map((action, index) => (
              <Button
                key={action.id}
                asChild
                variant={index === 0 ? "primary" : "outline"}
                className="w-full sm:w-auto"
              >
                <Link href={action.href}>{action.label}</Link>
              </Button>
            )),
          }
        : {})}
    />
  );
}
