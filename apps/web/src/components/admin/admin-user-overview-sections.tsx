import { AdminSectionLabel } from "@/components/admin/admin-section-label";
import { cn } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";

export type AdminUserOverviewSection = {
  id: string;
  label: string;
  content: ReactNode;
};

type Props = {
  sections: AdminUserOverviewSection[];
};

/** Renders overview tab panels with a compact non-sticky section index. */
export function AdminUserOverviewSections({ sections }: Props) {
  if (sections.length === 0) return null;

  return (
    <div className="space-y-6">
      <nav
        aria-label="Overview sections"
        className="rounded-lg border border-border-hairline/60 bg-surface-container-low/30 px-3 py-2"
      >
        <AdminSectionLabel as="p" className="mb-2">
          On this page
        </AdminSectionLabel>
        <ul className="flex flex-wrap gap-2">
          {sections.map((section) => (
            <li key={section.id}>
              <Link
                href={`#${section.id}`}
                className={cn(
                  "inline-flex min-h-8 items-center rounded-md border border-border-hairline/60 px-2.5 py-1",
                  "font-label text-[10px] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)]",
                  "text-on-surface-variant transition-colors hover:border-primary/30 hover:text-on-surface",
                )}
              >
                {section.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-32">
            {section.content}
          </section>
        ))}
      </div>
    </div>
  );
}
