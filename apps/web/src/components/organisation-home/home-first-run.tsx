import type { FirstRunView } from "@/lib/organisation-home/organisation-dashboard-view";
import { Button } from "@auction/ui/components/button";
import { EmptyState } from "@auction/ui/components/empty-state";
import Link from "next/link";

/**
 * A new organisation's Home before anything has happened: its first steps instead of a grid of
 * empty figures. The first step is the primary action; the second, if any, is secondary.
 */
export function HomeFirstRun({ firstRun }: { firstRun: FirstRunView }) {
  return (
    <EmptyState
      illustration="easel"
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
