"use client";

import { Button } from "@auction/ui/components/button";
import type { ReactNode } from "react";

export function WizardReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="font-label text-[10px] uppercase tracking-wide text-secondary">{label}</dt>
      <dd className="font-body text-sm text-on-surface">{value || "—"}</dd>
    </div>
  );
}

type SectionProps = {
  title: string;
  onEdit: () => void;
  children: ReactNode;
};

export function WizardFormReviewSection({ title, onEdit, children }: SectionProps) {
  return (
    <section className="space-y-3 rounded-xl border border-border-hairline bg-surface-container-low/30 p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-label text-xs uppercase tracking-wide text-secondary">{title}</h3>
        <Button type="button" variant="ghost" size="sm" className="min-h-10" onClick={onEdit}>
          Edit
        </Button>
      </div>
      <dl className="space-y-2">{children}</dl>
    </section>
  );
}
