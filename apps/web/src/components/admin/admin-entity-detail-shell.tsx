import { AppScreen } from "@/components/dashboard/dashboard-page";
import { cn } from "@auction/ui";
import { PageHeader } from "@auction/ui/components/page-header";
import type { ReactNode } from "react";

export type AdminEntityDetailShellProps = {
  breadcrumbs?: ReactNode;
  title: string;
  description?: string | undefined;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  className?: string | undefined;
};

export function AdminEntityDetailShell({
  breadcrumbs,
  title,
  description,
  meta,
  actions,
  children,
  aside,
  className,
}: AdminEntityDetailShellProps) {
  return (
    <AppScreen className={className ?? "space-y-8"}>
      <PageHeader
        title={title}
        {...(description ? { description } : {})}
        {...(meta ? { meta } : {})}
        {...(breadcrumbs ? { breadcrumbs } : {})}
        {...(actions ? { actions } : {})}
      />
      <div
        className={cn(
          "mx-auto max-w-6xl gap-8",
          aside ? "grid lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]" : "",
        )}
      >
        <div className="min-w-0 space-y-6">{children}</div>
        {aside ? <aside className="min-w-0 space-y-4">{aside}</aside> : null}
      </div>
    </AppScreen>
  );
}
