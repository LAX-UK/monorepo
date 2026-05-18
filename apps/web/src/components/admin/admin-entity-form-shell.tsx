import { EntityForm, StickySaveBar, cn } from "@auction/ui";
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
    <EntityForm
      className={cn("mx-auto pb-28", maxWidthClassName)}
      header={{
        title,
        ...(description ? { description } : {}),
        ...(breadcrumbs ? { breadcrumbs } : {}),
        className: "mb-0 border-0 pb-0",
      }}
      sections={[{ id: "main", children }]}
      {...(footer
        ? {
            actions: <StickySaveBar>{footer}</StickySaveBar>,
          }
        : {})}
    />
  );
}
