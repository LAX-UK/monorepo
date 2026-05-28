"use client";

import { getOrganisationOnboardingDisplayNameAction } from "@/app/(task)/onboarding/organisation/onboarding-actions";
import type { OrgOnboardingStepKey } from "@auction/types";
import { LabelCaps } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@auction/ui/components/card";
import { TimelineStages } from "@auction/ui/components/timeline-stages";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

const STEPS: { key: OrgOnboardingStepKey; label: string }[] = [
  { key: "type", label: "Type" },
  { key: "details", label: "Details" },
  { key: "documents", label: "Documents" },
  { key: "connect", label: "Connect" },
  { key: "identity", label: "Identity" },
];

type Props = {
  children: ReactNode;
};

function withQuery(path: string, querySuffix: string) {
  return querySuffix ? `${path}?${querySuffix}` : path;
}

export function OrgOnboardingShell({ children }: Props) {
  const searchParams = useSearchParams();
  const fresh = searchParams.get("fresh") === "1";
  const entityId = fresh ? null : searchParams.get("entityId");
  const qs = new URLSearchParams();
  if (entityId) qs.set("entityId", entityId);
  if (fresh) qs.set("fresh", "1");
  const querySuffix = qs.toString();

  const pathname = usePathname();
  const stepMatch = pathname.match(/\/onboarding\/organisation\/step\/([^/]+)/);
  const segment = stepMatch?.[1] ?? "";
  const stepIndex = Math.max(
    0,
    STEPS.findIndex((s) => s.key === segment),
  );
  const displayStep = segment ? stepIndex + 1 : 1;

  const timelineStages = useMemo(() => STEPS.map((s) => ({ id: s.key, label: s.label })), []);
  const activeIndex = segment ? STEPS.findIndex((s) => s.key === segment) : 0;

  const [orgLabel, setOrgLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!entityId) {
      setOrgLabel(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const r = await getOrganisationOnboardingDisplayNameAction(entityId);
      if (!cancelled && r.ok) setOrgLabel(r.displayName);
    })();
    return () => {
      cancelled = true;
    };
  }, [entityId]);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-col gap-4 border-b border-outline-variant/30 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <LabelCaps>Organisation onboarding</LabelCaps>
          <p className="font-label text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
            Step {displayStep} of {STEPS.length}
            {orgLabel ? (
              <>
                {" "}
                · <span className="text-on-surface">{orgLabel}</span>
              </>
            ) : entityId ? (
              <>
                {" "}
                · <span className="text-on-surface-variant">Loading…</span>
              </>
            ) : (
              <>
                {" "}
                · <span className="text-on-surface">New organisation</span>
              </>
            )}
          </p>
          <TimelineStages
            stages={timelineStages}
            activeIndex={activeIndex >= 0 ? activeIndex : 0}
          />
          <nav aria-label="Jump to step" className="hidden flex-wrap gap-2 pt-2 sm:flex">
            {STEPS.map((s, index) => {
              const isFuture = index > activeIndex;
              const className = `rounded-full px-2 py-1 text-xs font-medium ${
                segment === s.key
                  ? "text-primary underline underline-offset-2"
                  : "text-on-surface-variant"
              } ${isFuture ? "cursor-not-allowed opacity-50" : "hover:underline"}`;
              if (isFuture) {
                return (
                  <span key={s.key} className={className} aria-disabled="true">
                    {s.label}
                  </span>
                );
              }
              return (
                <Link
                  key={s.key}
                  href={withQuery(`/onboarding/organisation/step/${s.key}`, querySuffix)}
                  className={className}
                >
                  {s.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <Button asChild variant="ghost" size="sm" className="shrink-0 self-start sm:self-auto">
          <Link href="/dashboard/organisations">Save and exit</Link>
        </Button>
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>{children}</div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="font-label text-xs font-bold uppercase tracking-[0.18em]">
              What you&apos;ll need
            </CardTitle>
            <CardDescription className="text-on-surface-variant">
              Have these ready for a smoother setup.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-on-surface-variant">
            <ul className="list-disc space-y-2 pl-4">
              <li>Company or trading name and registered address</li>
              <li>Proof of identity documents (varies by entity type)</li>
              <li>Bank-ready details for Stripe Connect payouts</li>
              <li>About 10–15 minutes — you can save and exit any time</li>
            </ul>
            <p className="mt-4 text-xs leading-relaxed">
              Progress is saved to your account. Continue from{" "}
              <Link
                href="/dashboard/organisations"
                className="font-semibold text-primary hover:underline"
              >
                Organisations
              </Link>{" "}
              in the dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
