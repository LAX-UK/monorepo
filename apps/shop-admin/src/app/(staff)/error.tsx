"use client";

import { ErrorState, StaffButton } from "@auction/staff-ui";
import Link from "next/link";

export default function StaffError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-staff-lg border border-staff-line bg-staff-surface">
      <ErrorState
        title="Something went wrong"
        description="This page could not be shown. Try again, or go back to the overview and sign in again if it keeps happening."
        action={
          <>
            <StaffButton variant="secondary" onClick={() => reset()}>
              Retry
            </StaffButton>
            <StaffButton asChild variant="secondary">
              <Link href="/overview">Back to overview</Link>
            </StaffButton>
          </>
        }
      />
    </div>
  );
}
