import { Notice, type NoticeTone } from "@auction/ui/lax";
import type { ReactNode } from "react";

export type PolicyNoticeVariant = "error" | "primary" | "warning";

export type PolicyNoticeProps = {
  variant: PolicyNoticeVariant;
  title: string;
  children: ReactNode;
  className?: string;
};

/** Which kit tone each policy variant takes: information is calm, the others keep their tint. */
const toneByVariant: Record<PolicyNoticeVariant, NoticeTone> = {
  error: "danger",
  primary: "info",
  warning: "warning",
};

/** Why something cannot be done on a public page, on the kit notice. */
export function PolicyNotice({ variant, title, children, className }: PolicyNoticeProps) {
  return (
    <Notice tone={toneByVariant[variant]} title={title} {...(className ? { className } : {})}>
      {children}
    </Notice>
  );
}
