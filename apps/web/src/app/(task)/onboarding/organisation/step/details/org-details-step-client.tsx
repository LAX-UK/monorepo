"use client";

import {
  patchOrgOnboardingProfileAction,
  postOrgOnboardingStepCompleteAction,
} from "@/app/(task)/onboarding/organisation/onboarding-actions";
import {
  checkOrgNameAction,
  createOrganizationAction,
} from "@/lib/legal-entity/organization-onboarding.actions";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import type { CreateOrganizationInput, PublicOrganisationSubkind } from "@auction/validators";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type Address = NonNullable<CreateOrganizationInput["primaryAddress"]>;

const EMPTY_ADDRESS: Address = {
  addressType: "registered_office",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  isDefault: true,
};

type Props = {
  entityId?: string;
  subkind?: PublicOrganisationSubkind;
  fresh: boolean;
  initialDisplayName?: string;
  initialLegalName?: string;
  initialVat?: string;
  initialAddress?: Address;
};

export function OrgDetailsStepClient({
  entityId,
  subkind,
  fresh,
  initialDisplayName = "",
  initialLegalName = "",
  initialVat = "",
  initialAddress,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [legalName, setLegalName] = useState(initialLegalName);
  const [vatNumber, setVatNumber] = useState(initialVat);
  const [address, setAddress] = useState<Address>(initialAddress ?? EMPTY_ADDRESS);
  const [nameCheck, setNameCheck] = useState<{ available: boolean; suggestions: string[] } | null>(
    null,
  );
  const [checkingName, setCheckingName] = useState(false);

  useEffect(() => {
    if (entityId) return;
    if (displayName.trim().length < 2) {
      setNameCheck(null);
      return;
    }
    setCheckingName(true);
    const handle = setTimeout(async () => {
      const result = await checkOrgNameAction(displayName);
      setNameCheck(result);
      setCheckingName(false);
    }, 350);
    return () => clearTimeout(handle);
  }, [displayName, entityId]);

  const buildQuery = (id: string) => {
    const qs = new URLSearchParams({ entityId: id });
    if (fresh) qs.set("fresh", "1");
    return qs.toString();
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!entityId && !subkind) {
      setError("Missing organisation type; go back to step 1.");
      return;
    }
    if (!address.line1 || !address.city || !address.postalCode || !address.country) {
      setError("Please complete the registered address.");
      return;
    }
    if (!entityId && nameCheck && !nameCheck.available) {
      setError("That name is already in use; please pick a different one.");
      return;
    }

    startTransition(async () => {
      if (entityId) {
        const patch = await patchOrgOnboardingProfileAction(entityId, {
          displayName: displayName.trim(),
          legalName: legalName.trim() || undefined,
          vatNumber: vatNumber.trim() || undefined,
          primaryAddress: address,
        });
        if (!patch.ok) {
          setError(patch.error ?? "Could not save details.");
          return;
        }
        const done = await postOrgOnboardingStepCompleteAction(entityId, "details");
        if (!done.ok) {
          setError(done.error ?? "Could not mark details complete.");
          return;
        }
        router.push(`/onboarding/organisation/step/documents?${buildQuery(entityId)}`);
        return;
      }

      if (!subkind) {
        setError("Missing organisation type.");
        return;
      }

      const input: CreateOrganizationInput = {
        displayName: displayName.trim(),
        subkind,
        ...(legalName.trim() ? { legalName: legalName.trim() } : {}),
        ...(vatNumber.trim() ? { vatNumber: vatNumber.trim() } : {}),
        primaryAddress: address,
      };
      const res = await createOrganizationAction(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const id = res.entity.id;
      const step = await postOrgOnboardingStepCompleteAction(id, "details");
      if (!step.ok) {
        setError(step.error ?? "Could not record progress.");
        return;
      }
      router.push(`/onboarding/organisation/step/documents?${buildQuery(id)}`);
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6 px-4">
      <h2 className="text-xl font-semibold">Organisation details</h2>
      <div className="space-y-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          maxLength={200}
        />
        {!entityId ? (
          <>
            {checkingName ? (
              <p className="text-xs text-on-surface-variant">Checking availability…</p>
            ) : null}
            {nameCheck && !checkingName ? (
              <p className={`text-xs ${nameCheck.available ? "text-success" : "text-destructive"}`}>
                {nameCheck.available
                  ? "Name is available."
                  : `Name is taken. Try: ${nameCheck.suggestions.join(", ")}`}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="legalName">Legal name (optional)</Label>
        <Input
          id="legalName"
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          maxLength={200}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="vatNumber">VAT number (optional)</Label>
        <Input
          id="vatNumber"
          value={vatNumber}
          onChange={(e) => setVatNumber(e.target.value)}
          maxLength={50}
        />
      </div>
      <fieldset className="space-y-3 border-t pt-6">
        <legend className="text-sm font-semibold">Registered address</legend>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="line1">Line 1</Label>
            <Input
              id="line1"
              value={address.line1}
              onChange={(e) => setAddress({ ...address, line1: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="line2">Line 2</Label>
            <Input
              id="line2"
              value={address.line2 ?? ""}
              onChange={(e) => setAddress({ ...address, line2: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={address.city}
              onChange={(e) => setAddress({ ...address, city: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">County / state</Label>
            <Input
              id="state"
              value={address.state ?? ""}
              onChange={(e) => setAddress({ ...address, state: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postalCode">Postcode</Label>
            <Input
              id="postalCode"
              value={address.postalCode}
              onChange={(e) => setAddress({ ...address, postalCode: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={address.country}
              onChange={(e) => setAddress({ ...address, country: e.target.value })}
              required
            />
          </div>
        </div>
      </fieldset>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Continue"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard">Save and continue later</Link>
        </Button>
      </div>
    </form>
  );
}
