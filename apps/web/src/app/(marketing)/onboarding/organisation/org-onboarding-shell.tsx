"use client";

import type { OrgOnboardingStepKey } from "@auction/types";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

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

  return (
    <div className="container mx-auto max-w-3xl py-10">
      <nav
        aria-label="Onboarding progress"
        className="mb-8 flex flex-wrap gap-2 border-b border-outline-variant/30 pb-4"
      >
        {STEPS.map((s) => {
          const active = segment === s.key;
          return (
            <Link
              key={s.key}
              href={withQuery(`/onboarding/organisation/step/${s.key}`, querySuffix)}
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                active
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-high text-on-surface-variant"
              }`}
            >
              {s.label}
            </Link>
          );
        })}
        <Link
          href="/dashboard"
          className="ml-auto text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          Save and continue later
        </Link>
      </nav>
      {children}
    </div>
  );
}
