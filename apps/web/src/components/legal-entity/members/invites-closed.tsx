import { invitesClosedCopy } from "@/lib/legal-entity/member-change-copy";
import { Info } from "lucide-react";

type Props = { refusalCode: string; organisationName: string };

/** In place of the invite form while the organisation's state closes inviting. */
export function InvitesClosed({ refusalCode, organisationName }: Props) {
  const copy = invitesClosedCopy(refusalCode, organisationName);
  return (
    <p
      className="flex items-start gap-2 font-body text-sm leading-5.5 text-on-surface-variant"
      data-testid="invites-closed"
    >
      <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
      <span>{copy.line}</span>
    </p>
  );
}
