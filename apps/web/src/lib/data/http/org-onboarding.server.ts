import "server-only";

import type { OrgOnboardingResumeVm } from "@/lib/data/dto/dashboard-dtos";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { ORG_ONBOARDING_STEPS, type OrgOnboardingStepKey } from "@auction/types";
import { cache } from "react";

export type { OrgOnboardingResumeVm };

/** First organisation membership (lead) with incomplete onboarding steps, if any. */
export const getServerOrgOnboardingResume = cache(
  async function getServerOrgOnboardingResume(): Promise<OrgOnboardingResumeVm | null> {
    const res = await authedServerFetch("/legal-entities/me", { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      data?: Array<{ id: string; displayName: string; kind: string; status: string }>;
    };
    const memberships = body.data ?? [];
    const leads = memberships.filter((m) => m.kind === "organisation" && m.status === "lead");
    for (const org of leads) {
      const o = await authedServerFetch(`/organizations/${org.id}/onboarding`, {
        cache: "no-store",
      });
      if (!o.ok) continue;
      const ob = (await o.json()) as { data?: { completedSteps?: OrgOnboardingStepKey[] } };
      const done = new Set(ob.data?.completedSteps ?? []);
      const missing = ORG_ONBOARDING_STEPS.find((s) => !done.has(s));
      if (missing) {
        const qs = new URLSearchParams({ entityId: org.id });
        return {
          entityId: org.id,
          displayName: org.displayName,
          resumeHref: `/onboarding/organisation/step/${missing}?${qs.toString()}`,
        };
      }
    }
    return null;
  },
);
