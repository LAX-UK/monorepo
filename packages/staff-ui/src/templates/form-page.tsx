import type * as React from "react";
import { Skeleton } from "../display/states.js";
import { PageHeader } from "../shell/page-header.js";

export type FormPageProps = {
  /** StaffBreadcrumbs: section, the record being edited, this form. */
  breadcrumbs?: React.ReactNode;
  /** "New lot", "Edit lot". */
  title: React.ReactNode;
  /** One sentence: what the form is for, or what is locked. */
  description?: React.ReactNode;
  /** TabNav when the record is edited in separate sections, each saved on its own. */
  tabs?: React.ReactNode;
  /** A Notice about the whole form (e.g. a record synced elsewhere). */
  notice?: React.ReactNode;
  /** The form: FormSections, then its FormActions. */
  children: React.ReactNode;
};

/**
 * The staff create and edit page, in one fixed order: breadcrumbs, title and purpose, section
 * tabs, a notice, then the form at a reading width, so labels and fields stay close on wide
 * screens. Saving lives in the form's own actions, not the header.
 */
export function FormPage({
  breadcrumbs,
  title,
  description,
  tabs,
  notice,
  children,
}: FormPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        {...(breadcrumbs ? { breadcrumbs } : {})}
        {...(description ? { description } : {})}
        {...(tabs ? { tabs } : {})}
      />
      {notice}
      <div className="flex w-full max-w-[1040px] min-w-0 flex-col gap-6">{children}</div>
    </div>
  );
}

/** A form page while it loads: its title, then sections of label and field placeholders. */
export function FormPageSkeleton({ title, sections = 3 }: { title: string; sections?: number }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <PageHeader title={title} />
      <div className="flex w-full max-w-[1040px] flex-col gap-6">
        {Array.from({ length: sections }, (_, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholder sections have no identity
            key={index}
            className="grid gap-4 border-b border-staff-line-subtle pb-6 last:border-b-0 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8"
          >
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-44" />
            </div>
            <div className="flex flex-col gap-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
