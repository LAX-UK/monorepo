"use client";

import { Button } from "@/components/ui/button";
import {
  type CheckNameResult,
  checkOrgNameAction,
  createOrganizationAction,
} from "@/lib/legal-entity/organization-onboarding.actions";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import type { CreateOrganizationInput, PublicOrganisationSubkind } from "@auction/validators";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type SubkindOption = { value: PublicOrganisationSubkind; label: string };

type Props = {
  subkinds: SubkindOption[];
};

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

export function OrganisationOnboardingForm({ subkinds }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [subkind, setSubkind] = useState<PublicOrganisationSubkind | "">("");
  const [vatNumber, setVatNumber] = useState("");
  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS);

  const [nameCheck, setNameCheck] = useState<CheckNameResult | null>(null);
  const [checkingName, setCheckingName] = useState(false);

  // Debounced name availability check.
  useEffect(() => {
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
  }, [displayName]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!subkind) {
      setError("Please choose an organisation type.");
      return;
    }
    if (nameCheck && !nameCheck.available) {
      setError("That name is already in use; please pick a different one.");
      return;
    }
    const input: CreateOrganizationInput = {
      displayName: displayName.trim(),
      ...(legalName.trim() ? { legalName: legalName.trim() } : {}),
      subkind,
      ...(vatNumber.trim() ? { vatNumber: vatNumber.trim() } : {}),
      ...(address.line1 && address.city && address.postalCode && address.country
        ? { primaryAddress: address }
        : {}),
    };
    startTransition(async () => {
      const res = await createOrganizationAction(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/dashboard/organisations/${res.entity.id}/onboarding`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="displayName">Organisation name</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          autoComplete="organization"
          required
          maxLength={200}
        />
        {checkingName && <p className="text-xs text-on-surface-variant">Checking availability…</p>}
        {nameCheck && !checkingName && (
          <p className={`text-xs ${nameCheck.available ? "text-success" : "text-destructive"}`}>
            {nameCheck.available
              ? "Name is available."
              : `Name is taken. Try: ${nameCheck.suggestions.join(", ")}`}
          </p>
        )}
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
        <Label htmlFor="subkind">Organisation type</Label>
        <Select
          {...(subkind ? { value: subkind } : {})}
          onValueChange={(v) => setSubkind(v as PublicOrganisationSubkind)}
        >
          <SelectTrigger id="subkind">
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            {subkinds.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="vatNumber">VAT number (if applicable)</Label>
        <Input
          id="vatNumber"
          value={vatNumber}
          onChange={(e) => setVatNumber(e.target.value)}
          maxLength={50}
        />
      </div>

      <fieldset className="space-y-3 border-t pt-6">
        <legend className="text-sm font-semibold">
          Registered address (optional — can be added later)
        </legend>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="line1">Line 1</Label>
            <Input
              id="line1"
              value={address.line1}
              onChange={(e) => setAddress({ ...address, line1: e.target.value })}
              autoComplete="address-line1"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="line2">Line 2</Label>
            <Input
              id="line2"
              value={address.line2 ?? ""}
              onChange={(e) => setAddress({ ...address, line2: e.target.value })}
              autoComplete="address-line2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={address.city}
              onChange={(e) => setAddress({ ...address, city: e.target.value })}
              autoComplete="address-level2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">County / state</Label>
            <Input
              id="state"
              value={address.state ?? ""}
              onChange={(e) => setAddress({ ...address, state: e.target.value })}
              autoComplete="address-level1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postalCode">Postcode</Label>
            <Input
              id="postalCode"
              value={address.postalCode}
              onChange={(e) => setAddress({ ...address, postalCode: e.target.value })}
              autoComplete="postal-code"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={address.country}
              onChange={(e) => setAddress({ ...address, country: e.target.value })}
              autoComplete="country"
            />
          </div>
        </div>
      </fieldset>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create organisation"}
      </Button>
    </form>
  );
}
