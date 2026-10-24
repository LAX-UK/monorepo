import type { ReactNode } from "react";

export type AdminUserOverviewSection = {
  id: string;
  label: string;
  content: ReactNode;
};

type Props = {
  sections: AdminUserOverviewSection[];
};

/** The overview tab's panels in order, each addressable by its id (e.g. `#kyc-history`). */
export function AdminUserOverviewSections({ sections }: Props) {
  if (sections.length === 0) return null;
  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => (
        <section
          key={section.id}
          id={section.id}
          aria-label={section.label}
          className="scroll-mt-20"
        >
          {section.content}
        </section>
      ))}
    </div>
  );
}
