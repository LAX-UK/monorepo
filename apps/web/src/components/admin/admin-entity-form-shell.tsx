import { AppScreen } from "@/components/dashboard/dashboard-page";
import { DisplayHeading } from "@/components/ui/typography";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type AdminEntityFormShellProps = {
  /** Breadcrumb / back navigation above the title */
  breadcrumbs?: ReactNode;
  title: string;
  description?: string | undefined;
  children: ReactNode;
  /** Sticky actions row (Cancel, Save, Save & add another) */
  footer?: ReactNode;
  /** `max-w-3xl` (default) or `max-w-6xl` for two-column layouts */
  maxWidthClassName?: string | undefined;
};

export function AdminEntityFormShell({
  breadcrumbs,
  title,
  description,
  children,
  footer,
  maxWidthClassName = "max-w-3xl",
}: AdminEntityFormShellProps) {
  return (
    <AppScreen className={cn("mx-auto space-y-8 pb-28", maxWidthClassName)}>
      {breadcrumbs ? <div className="text-on-surface-variant">{breadcrumbs}</div> : null}
      <div className="space-y-2">
        <DisplayHeading as="h1" className="text-4xl">
          {title}
        </DisplayHeading>
        {description ? (
          <p className="font-body text-sm text-on-surface-variant">{description}</p>
        ) : null}
      </div>
      {children}
      {footer ? (
        <div className="sticky bottom-0 z-10 -mx-4 border-t border-outline-variant/30 bg-surface-container-lowest/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface-container-lowest/80 md:-mx-0 md:px-0">
          {footer}
        </div>
      ) : null}
    </AppScreen>
  );
}
