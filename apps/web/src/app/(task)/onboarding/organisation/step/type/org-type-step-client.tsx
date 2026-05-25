"use client";

import { postOrgOnboardingStepCompleteAction } from "@/app/(task)/onboarding/organisation/onboarding-actions";
import { Button } from "@auction/ui/components/button";
import { Label } from "@auction/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@auction/ui/components/radio-group";
import type { PublicOrganisationSubkind } from "@auction/validators";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

type SubkindOption = { value: PublicOrganisationSubkind; label: string };

const TOOLTIPS: Partial<Record<PublicOrganisationSubkind, string>> = {
  gallery:
    "A physical or online showroom presenting works to the public, typically with curated exhibitions and artist representation.",
  dealer: "Trades works for clients, often with private inventory and direct-relationship sales.",
  estate: "Managing inheritance, probate, or settlement sales of an art collection.",
  other:
    "Doesn't fit the above? Tell us about your organisation and we'll work with you on requirements.",
};

type Props = {
  subkinds: SubkindOption[];
  entityId?: string;
  fresh: boolean;
};

export function OrgTypeStepClient({ subkinds, entityId, fresh }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [subkind, setSubkind] = useState<PublicOrganisationSubkind | "">("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const nextSuffix = useCallback(() => {
    const qs = new URLSearchParams();
    const eid = searchParams.get("entityId");
    const fr = searchParams.get("fresh") === "1";
    if (eid && !fr) qs.set("entityId", eid);
    if (fr) qs.set("fresh", "1");
    return qs.toString();
  }, [searchParams]);

  const onContinue = () => {
    setError(null);
    if (!subkind) {
      setError("Please choose an organisation type.");
      return;
    }
    startTransition(async () => {
      if (entityId) {
        const res = await postOrgOnboardingStepCompleteAction(entityId, "type");
        if (!res.ok) {
          setError(res.error ?? "Could not save this step.");
          return;
        }
        router.push(`/onboarding/organisation/step/details?${nextSuffix()}`);
        return;
      }
      const qs = new URLSearchParams();
      qs.set("subkind", subkind);
      if (fresh) qs.set("fresh", "1");
      router.push(`/onboarding/organisation/step/details?${qs.toString()}`);
    });
  };

  return (
    <div className="space-y-6 px-4">
      <h2 className="text-xl font-semibold">Organisation type</h2>
      <RadioGroup
        value={subkind}
        onValueChange={(v) => setSubkind(v as PublicOrganisationSubkind)}
        className="space-y-3"
      >
        {subkinds.map((s) => (
          <div
            key={s.value}
            className="flex gap-3 rounded-lg border border-outline-variant/30 p-4 hover:bg-surface-container-low/60"
          >
            <RadioGroupItem id={`sk-${s.value}`} value={s.value} />
            <div className="space-y-1">
              <Label htmlFor={`sk-${s.value}`} className="cursor-pointer font-medium">
                {s.label}
              </Label>
              {TOOLTIPS[s.value] ? (
                <p className="text-sm text-on-surface-variant">{TOOLTIPS[s.value]}</p>
              ) : null}
            </div>
          </div>
        ))}
      </RadioGroup>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={pending} onClick={onContinue}>
          {pending ? "Saving…" : "Continue"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard">Save and continue later</Link>
        </Button>
      </div>
    </div>
  );
}
