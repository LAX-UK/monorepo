import { cn } from "@auction/ui";
import type { ReactNode } from "react";

type SettingsSectionProps = {
  title: string;
  titleAs?: "h2" | "h3";
  /** Uppercase small heading (mockup: PERSONAL DETAILS) */
  eyebrow?: boolean;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Bottom divider between stacked sections */
  bordered?: boolean;
};

export function SettingsSection({
  title,
  titleAs = "h2",
  eyebrow = false,
  action,
  children,
  className,
  bordered = true,
}: SettingsSectionProps) {
  const Heading = titleAs;
  return (
    <section
      className={cn(
        "space-y-6 py-2",
        bordered && "border-b border-outline-variant/50 pb-8 last:border-b-0 last:pb-0",
        className,
      )}
    >
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-3">
        <Heading
          className={cn(
            eyebrow
              ? "font-label text-sm font-bold uppercase tracking-wide text-on-surface"
              : "font-headline text-lg font-semibold text-on-surface",
          )}
        >
          {title}
        </Heading>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
