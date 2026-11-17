import type { MoveAgreementLine } from "@/lib/move-agreement-line";
import { Notice, StaffButtonLink } from "@auction/staff-ui";
import Link from "next/link";

/** The consignor agreement line in a move dialog, with its one action when there is one. */
export function MoveAgreementNotice({ line }: { line: MoveAgreementLine }) {
  return (
    <Notice
      tone={line.tone}
      title={line.text}
      actions={
        line.link ? (
          <StaffButtonLink href={line.link.href} Link={Link} size="sm" variant="secondary">
            {line.link.label}
          </StaffButtonLink>
        ) : undefined
      }
    />
  );
}
