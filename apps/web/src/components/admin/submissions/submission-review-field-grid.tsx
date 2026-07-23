import type { ReactNode } from "react";

type FieldProps = {
  label: string;
  children: ReactNode;
};

export function SubmissionReviewField({ label, children }: FieldProps) {
  return (
    <div className="space-y-2 border-b border-border-hairline py-3">
      <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
        {label}
      </p>
      <div className="font-body text-base text-on-surface">{children}</div>
    </div>
  );
}

type GridProps = {
  children: ReactNode;
};

export function SubmissionReviewFieldGrid({ children }: GridProps) {
  return <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">{children}</div>;
}
