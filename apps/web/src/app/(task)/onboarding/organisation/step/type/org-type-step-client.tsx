"use client";

import { postOrgOnboardingStepCompleteAction } from "@/app/(task)/onboarding/organisation/onboarding-actions";
import { orgOnboardingStepHref } from "@/lib/legal-entity/org-onboarding-resume";
import { orgSubkindDescription } from "@/lib/legal-entity/org-onboarding-subkind-descriptions";
import { cn } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Label } from "@auction/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@auction/ui/components/radio-group";
import type { PublicOrganisationSubkind } from "@auction/validators";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type SubkindOption = { value: PublicOrganisationSubkind; label: string };

type Props = {
  subkinds: SubkindOption[];
  entityId?: string;
  fresh: boolean;
  initialSubkind?: PublicOrganisationSubkind;
  subkindLocked?: boolean;
  loadFailed?: boolean;
};

export function OrgTypeStepClient({
  subkinds,
  entityId,
  fresh,
  initialSubkind,
  subkindLocked = false,
  loadFailed = false,
}: Props) {
  const router = useRouter();
  const [subkind, setSubkind] = useState<PublicOrganisationSubkind | "">(initialSubkind ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const queryOpts = {
    ...(entityId ? { entityId } : {}),
    ...(fresh ? { fresh: true } : {}),
  };

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
        router.push(orgOnboardingStepHref("details", queryOpts));
        return;
      }
      router.push(
        orgOnboardingStepHref("details", {
          ...queryOpts,
          subkind,
        }),
      );
    });
  };

  if (loadFailed) {
    return (
      <div className="space-y-6 px-4">
        <OrgTypeStepHeader />
        <Alert variant="destructive">
          <AlertTitle>Could not load organisation types</AlertTitle>
          <AlertDescription>
            Refresh the page to try again. If the problem continues, contact support.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (subkinds.length === 0) {
    return (
      <div className="space-y-6 px-4">
        <OrgTypeStepHeader />
        <Alert>
          <AlertTitle>No organisation types available</AlertTitle>
          <AlertDescription>
            We could not load the list of organisation types. Refresh the page or try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4">
      <OrgTypeStepHeader />
      {subkindLocked && initialSubkind ? (
        <p className="text-sm text-on-surface-variant">
          Your organisation type is set and cannot be changed. Continue to the next step when ready.
        </p>
      ) : null}
      <RadioGroup
        value={subkind}
        onValueChange={(v) => {
          if (subkindLocked) return;
          setSubkind(v as PublicOrganisationSubkind);
        }}
        className="space-y-3"
      >
        {subkinds.map((s) => {
          const id = `sk-${s.value}`;
          return (
            <Label
              key={s.value}
              htmlFor={id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border border-outline-variant/40 p-4 transition-colors hover:bg-surface-container-low/60 has-[:checked]:border-primary has-[:checked]:bg-primary/5",
                subkindLocked && s.value !== initialSubkind && "cursor-not-allowed opacity-50",
              )}
            >
              <RadioGroupItem
                id={id}
                value={s.value}
                className="mt-0.5"
                disabled={subkindLocked && s.value !== initialSubkind}
              />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="font-medium text-on-surface">{s.label}</span>
                <span className="text-sm text-on-surface-variant">
                  {orgSubkindDescription(s.value)}
                </span>
              </span>
            </Label>
          );
        })}
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
      </div>
    </div>
  );
}

function OrgTypeStepHeader() {
  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold">Organisation type</h2>
      <p className="text-sm text-on-surface-variant">
        Choose the category that best describes your organisation. This determines document
        requirements for your application.
      </p>
    </div>
  );
}
