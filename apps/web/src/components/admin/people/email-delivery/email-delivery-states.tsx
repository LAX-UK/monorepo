"use client";

import { ErrorState, Section, Skeleton, StaffButton } from "@auction/staff-ui";
import { RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** The panel's own shape while it loads, so nothing shifts when it arrives. */
export function EmailDeliverySkeleton() {
  return (
    <Section
      id="email-delivery"
      title="Email delivery"
      className="scroll-mt-20"
      bodyClassName="p-0"
    >
      <div aria-busy="true" className="flex flex-col gap-3 px-4 py-4">
        <span className="sr-only">Loading email delivery</span>
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="flex flex-col gap-3 border-t border-staff-line-subtle px-4 py-4">
        {["a", "b", "c"].map((key) => (
          <div key={key} className="flex items-center gap-4">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-4 w-1/5" />
            <Skeleton className="h-4 w-1/4" />
          </div>
        ))}
      </div>
    </Section>
  );
}

/** A failed email read stays inside the panel; the rest of the person's page works. */
export function EmailDeliveryError({ personName }: { personName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Section id="email-delivery" title="Email delivery" className="scroll-mt-20">
      <ErrorState
        size="compact"
        headingLevel="h3"
        title="Email delivery couldn’t be loaded"
        description={`The rest of ${personName}’s page is fine. Try again in a moment.`}
        action={
          <StaffButton
            variant="secondary"
            loading={pending}
            icon={<RotateCw aria-hidden />}
            onClick={() => startTransition(() => router.refresh())}
          >
            Try again
          </StaffButton>
        }
      />
    </Section>
  );
}
