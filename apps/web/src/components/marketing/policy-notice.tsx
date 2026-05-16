import { cn } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import type { ReactNode } from "react";

export type PolicyNoticeVariant = "error" | "primary" | "warning";

export type PolicyNoticeProps = {
  variant: PolicyNoticeVariant;
  title: string;
  children: ReactNode;
  className?: string;
};

const variantClass: Record<PolicyNoticeVariant, string> = {
  error: "border-error/30 bg-error-container/10 text-on-surface ring-1 ring-error/15",
  primary: "border-primary/30 bg-primary-container/10 text-on-surface ring-1 ring-primary/15",
  warning:
    "border-lot-orange/40 bg-lot-orange/5 text-on-surface ring-1 ring-lot-orange/20 dark:border-lot-orange/30",
};

export function PolicyNotice({ variant, title, children, className }: PolicyNoticeProps) {
  return (
    <Alert className={cn(variantClass[variant], className)}>
      <AlertTitle className="text-on-surface">{title}</AlertTitle>
      <AlertDescription className="text-on-surface-variant">{children}</AlertDescription>
    </Alert>
  );
}
