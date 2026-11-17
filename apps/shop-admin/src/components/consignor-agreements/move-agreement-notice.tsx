import type { MoveAgreementLine } from "@/lib/move-agreement-line";
import { Notice, StaffButton } from "@auction/staff-ui";
import Link from "next/link";

/** The consignor agreement line in a move dialog, with its one action when there is one. */
export function MoveAgreementNotice({ line }: { line: MoveAgreementLine }) {
  return (
    <Notice
      tone={line.tone}
      title={line.text}
      actions={
        line.link ? (
          <StaffButton asChild size="sm" variant="secondary">
            <Link href={line.link.href}>{line.link.label}</Link>
          </StaffButton>
        ) : undefined
      }
    />
  );
}
