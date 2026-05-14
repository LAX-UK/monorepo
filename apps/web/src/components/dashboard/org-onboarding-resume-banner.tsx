import "server-only";

import { SITE_SUPPORT_EMAIL } from "@/lib/brand";
import type { OrgOnboardingResumeVm } from "@/lib/data/dto/dashboard-dtos";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import Link from "next/link";

type Props = {
  resume: OrgOnboardingResumeVm;
};

export function OrgOnboardingResumeBanner({ resume }: Props) {
  return (
    <Alert className="mb-0 border-primary/30 bg-surface-container-low/80" variant="default">
      <AlertTitle>Finish organisation setup</AlertTitle>
      <AlertDescription className="text-on-surface">
        Continue setting up <span className="font-semibold">{resume.displayName}</span> before
        submitting for review.{" "}
        <Link className="font-medium underline underline-offset-2" href={resume.resumeHref}>
          Resume onboarding
        </Link>
        {" · "}
        <a
          className="font-medium underline underline-offset-2"
          href={`mailto:${SITE_SUPPORT_EMAIL}`}
        >
          Contact support
        </a>
      </AlertDescription>
    </Alert>
  );
}
