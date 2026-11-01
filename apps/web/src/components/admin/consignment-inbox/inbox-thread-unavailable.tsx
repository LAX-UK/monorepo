"use client";

import { inboxReadRoles } from "@/lib/admin/consignment-inbox/inbox-access";
import { INBOX_PATH } from "@/lib/admin/consignment-inbox/inbox-list-state";
import {
  AccessDeniedState,
  ErrorState,
  StaffBreadcrumbs,
  StaffButton,
  StaffButtonLink,
  type StaffLinkComponent,
} from "@auction/staff-ui";
import { RotateCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const NextLink: StaffLinkComponent = Link;

/**
 * A thread that could not be shown, inside the page frame: the service did not answer (the
 * draft is kept in this browser; try again or open the consignment), or the person's role
 * cannot read it.
 */
export function InboxThreadUnavailable({
  submissionId,
  reason,
}: {
  submissionId: string;
  reason: "forbidden" | "unavailable";
}) {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-6">
      <StaffBreadcrumbs
        Link={NextLink}
        items={[{ label: "Inbox", href: INBOX_PATH }, { label: "Thread" }]}
      />
      <div className="rounded-staff-lg border border-staff-line bg-staff-surface">
        {reason === "forbidden" ? (
          <AccessDeniedState resource="this thread" requiredRole={inboxReadRoles()} />
        ) : (
          <ErrorState
            title="This thread didn’t load"
            description="Your draft is kept in this browser. Try again, or open the consignment instead."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <StaffButton
                  size="sm"
                  icon={<RotateCw aria-hidden />}
                  onClick={() => router.refresh()}
                >
                  Try again
                </StaffButton>
                <StaffButtonLink
                  href={`/admin/submissions/${submissionId}`}
                  Link={NextLink}
                  size="sm"
                  variant="ghost"
                >
                  Open consignment
                </StaffButtonLink>
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}
