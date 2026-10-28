import type { HomeSetupView } from "@/lib/organisation-home/organisation-home-view";
import { cn } from "@auction/ui";
import { Clock, TriangleAlert } from "lucide-react";

const TONE_CLASS: Record<HomeSetupView["tone"], string> = {
  warning: "border-warning/50 bg-warning-container/30",
  info: "border-outline-variant/20 bg-surface-container-low",
};

/**
 * The organisation's setup state as one status line, shown only while it is unfinished. It is
 * part of the page, not news, so it is not announced as an alert.
 */
export function HomeSetupLine({ setup }: { setup: HomeSetupView }) {
  const Icon = setup.tone === "warning" ? TriangleAlert : Clock;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-on-surface",
        TONE_CLASS[setup.tone],
      )}
      data-testid="home-setup-line"
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          setup.tone === "warning" ? "text-warning-on-surface" : "text-on-surface-variant",
        )}
        strokeWidth={1.75}
        aria-hidden
      />
      <p className="font-body text-sm">
        <strong className="font-semibold">{setup.title}</strong> {setup.detail}
      </p>
    </div>
  );
}
