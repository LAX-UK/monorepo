import type { HomeTaskView } from "@/lib/organisation-home/organisation-home-view";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { HomeSectionHeading } from "./home-section-heading";

type Props = {
  tasks: readonly HomeTaskView[];
};

/**
 * "Needs you": one row per task with one button; the first is the primary action. With nothing
 * left it collapses to a single calm line.
 */
export function HomeNeedsYou({ tasks }: Props) {
  return (
    <Surface
      variant="section"
      padding="none"
      aria-labelledby="home-needs-you"
      className="p-0 sm:p-0"
    >
      <div className="px-4 pt-4 sm:px-6 sm:pt-5">
        <HomeSectionHeading id="home-needs-you">Needs you</HomeSectionHeading>
      </div>
      {tasks.length === 0 ? (
        <p
          className="flex items-center gap-2 px-4 pt-2 pb-5 font-body text-sm text-on-surface-variant sm:px-6"
          data-testid="home-needs-you-empty"
        >
          <CircleCheck className="size-4 shrink-0 text-success" strokeWidth={1.75} aria-hidden />
          Nothing needs you right now.
        </p>
      ) : (
        <ul className="mt-1 divide-y divide-border-hairline px-4 pb-1 sm:px-6">
          {tasks.map((task, index) => (
            <li
              key={task.key}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
              data-testid={`home-task-${task.key}`}
            >
              <div className="min-w-0 space-y-0.5">
                <p className="font-body text-sm font-semibold text-on-surface">{task.title}</p>
                <p className="font-body text-sm text-on-surface-variant">{task.detail}</p>
              </div>
              <Button
                asChild
                size="default"
                variant={index === 0 ? "primary" : "outline"}
                className="shrink-0 self-start sm:self-center"
              >
                <Link href={task.action.href}>{task.action.label}</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}
