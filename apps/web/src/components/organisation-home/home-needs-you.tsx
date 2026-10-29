import type { HomeNoticeView, HomeTaskView } from "@/lib/organisation-home/organisation-home-view";
import { Button } from "@auction/ui/components/button";
import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { HomeNotices } from "./home-notices";
import { HomePanel, HomeSection } from "./home-section";

type Props = {
  tasks: readonly HomeTaskView[];
  /** Things to know that are not this member's to do, as quiet lines under the tasks. */
  notices?: readonly HomeNoticeView[];
};

/**
 * "Needs you": one row per task with one button; the first is the primary action. With nothing
 * left it collapses to a single calm line. Notices follow as information, never as tasks.
 */
export function HomeNeedsYou({ tasks, notices = [] }: Props) {
  if (tasks.length === 0) {
    return (
      <div className="space-y-3">
        <p
          className="flex items-center gap-2 font-body text-sm text-on-surface-variant"
          data-testid="home-needs-you-empty"
        >
          <CircleCheck className="size-4 shrink-0 text-success" strokeWidth={1.75} aria-hidden />
          Nothing needs you right now.
        </p>
        <HomeNotices notices={notices} />
      </div>
    );
  }
  return (
    <HomeSection id="home-needs-you" title="Needs you">
      <HomePanel>
        <ul className="divide-y divide-border-hairline">
          {tasks.map((task, index) => (
            <li
              key={task.key}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5"
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
                className="w-full shrink-0 sm:w-auto"
              >
                <Link href={task.action.href}>{task.action.label}</Link>
              </Button>
            </li>
          ))}
        </ul>
      </HomePanel>
      <HomeNotices notices={notices} className="pt-1" />
    </HomeSection>
  );
}
