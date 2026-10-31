"use client";

import type { InvoiceDetailsView } from "@/lib/data/http/organisation-team.types";
import {
  type InvoiceDetailsForm,
  invoiceAddressLine,
  invoiceDetailsForm,
  invoiceDetailsInput,
  validateInvoiceDetails,
} from "@/lib/organisation-team/invoice-details.vm";
import { saveInvoiceDetailsAction } from "@/lib/organisation-team/organisation-team.actions";
import { countriesByName } from "@/lib/ui/countries";
import { notify } from "@/lib/ui/notify";
import { Button, Field, Notice, SelectMenu, Switch, TextInput } from "@auction/ui/lax";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { SettingsCard, SettingsRow } from "./settings-section";

type Editing = "billingEmail" | "address" | "poReference" | null;

type Props = { legalEntityId: string; details: InvoiceDetailsView };

/**
 * The details printed on the organisation's invoices, each edited in place: where invoices are
 * sent, the address they carry (the registered one unless another is set) and a purchase order
 * reference. One row opens at a time; Save sends the whole set, so the others stay as they are.
 */
export function InvoiceDetailsCard({ legalEntityId, details }: Props) {
  const router = useRouter();
  const saved = useMemo(() => invoiceDetailsForm(details), [details]);
  const [form, setForm] = useState<InvoiceDetailsForm>(saved);
  const [editing, setEditing] = useState<Editing>(null);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const errors = tried ? validateInvoiceDetails(form) : {};
  const countries = useMemo(() => countriesByName(), []);

  const open = (row: Editing) => {
    setForm(saved);
    setTried(false);
    setError(null);
    setEditing(row);
  };
  const cancel = () => open(null);
  const save = () => {
    setTried(true);
    if (Object.keys(validateInvoiceDetails(form)).length > 0) return;
    startTransition(async () => {
      const result = await saveInvoiceDetailsAction(legalEntityId, invoiceDetailsInput(form));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      notify.success("Invoice details saved", {
        description: "New invoices use them from now on.",
      });
      setEditing(null);
      router.refresh();
    });
  };
  const set = (patch: Partial<InvoiceDetailsForm>) => setForm((f) => ({ ...f, ...patch }));
  const setAddress = (patch: Partial<InvoiceDetailsForm["address"]>) =>
    setForm((f) => ({ ...f, address: { ...f.address, ...patch } }));

  const edit = (row: Exclude<Editing, null>, label: string, empty: boolean) =>
    details.canEdit && editing === null ? (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => open(row)}
        aria-label={`${empty ? "Add" : "Edit"} ${label.toLowerCase()}`}
      >
        {empty ? "Add" : "Edit"}
      </Button>
    ) : null;

  const actions = (
    <div className="flex flex-col gap-3">
      {error ? <Notice tone="danger" alert title={error} /> : null}
      <div className="flex gap-2 max-md:[&>*]:flex-1 md:justify-end">
        <Button disabled={pending} onClick={cancel}>
          Cancel
        </Button>
        <Button variant="primary" loading={pending} onClick={save}>
          Save
        </Button>
      </div>
    </div>
  );

  return (
    <SettingsCard>
      {editing === "billingEmail" ? (
        <div className="flex flex-col gap-3 bg-lax-sunken px-4 py-4 md:px-5">
          <Field
            label="Send invoices to"
            description="Your accounts team's address. Leave empty for none."
            error={errors.billingEmail ?? null}
            optional
          >
            <TextInput
              type="email"
              autoComplete="email"
              autoFocus
              value={form.billingEmail}
              onChange={(e) => set({ billingEmail: e.target.value })}
              disabled={pending}
            />
          </Field>
          {actions}
        </div>
      ) : (
        <SettingsRow
          label="Send invoices to"
          value={details.billingEmail ?? "None. Add one so your accounts team gets every invoice."}
          muted={!details.billingEmail}
          action={edit("billingEmail", "Send invoices to", !details.billingEmail)}
        />
      )}

      {editing === "address" ? (
        <div className="flex flex-col gap-4 bg-lax-sunken px-4 py-4 md:px-5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-lax-ui font-medium text-lax-fg" id="own-address-label">
              Use a different address on invoices
            </span>
            <Switch
              aria-labelledby="own-address-label"
              checked={form.ownAddress}
              onCheckedChange={(ownAddress) => set({ ownAddress })}
              disabled={pending}
            />
          </div>
          {form.ownAddress ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Address line 1" error={errors.line1 ?? null} className="md:col-span-2">
                <TextInput
                  autoComplete="address-line1"
                  value={form.address.line1}
                  onChange={(e) => setAddress({ line1: e.target.value })}
                  disabled={pending}
                />
              </Field>
              <Field label="Address line 2" optional className="md:col-span-2">
                <TextInput
                  autoComplete="address-line2"
                  value={form.address.line2}
                  onChange={(e) => setAddress({ line2: e.target.value })}
                  disabled={pending}
                />
              </Field>
              <Field label="Town or city" error={errors.city ?? null}>
                <TextInput
                  autoComplete="address-level2"
                  value={form.address.city}
                  onChange={(e) => setAddress({ city: e.target.value })}
                  disabled={pending}
                />
              </Field>
              <Field label="County or region" optional>
                <TextInput
                  autoComplete="address-level1"
                  value={form.address.region}
                  onChange={(e) => setAddress({ region: e.target.value })}
                  disabled={pending}
                />
              </Field>
              <Field label="Postcode" error={errors.postalCode ?? null}>
                <TextInput
                  autoComplete="postal-code"
                  value={form.address.postalCode}
                  onChange={(e) => setAddress({ postalCode: e.target.value })}
                  disabled={pending}
                />
              </Field>
              <Field label="Country" error={errors.country ?? null}>
                <SelectMenu
                  label="Country"
                  value={form.address.country}
                  onValueChange={(country) => setAddress({ country })}
                  options={countries.map((c) => ({ value: c.code, label: c.name }))}
                  disabled={pending}
                  className="w-full"
                />
              </Field>
            </div>
          ) : (
            <p className="text-lax-13 text-lax-muted">Invoices carry the registered address.</p>
          )}
          {actions}
        </div>
      ) : (
        <SettingsRow
          label="Invoice address"
          value={
            details.address ? invoiceAddressLine(details.address) : "Same as registered address"
          }
          action={edit("address", "Invoice address", false)}
        />
      )}

      {editing === "poReference" ? (
        <div className="flex flex-col gap-3 bg-lax-sunken px-4 py-4 md:px-5">
          <Field
            label="Purchase order reference"
            description="Printed on every invoice. Leave empty for none."
            error={errors.poReference ?? null}
            optional
          >
            <TextInput
              autoFocus
              maxLength={60}
              value={form.poReference}
              onChange={(e) => set({ poReference: e.target.value })}
              disabled={pending}
            />
          </Field>
          {actions}
        </div>
      ) : (
        <SettingsRow
          label="Purchase order reference"
          value={details.poReference ?? "None. Add one to show it on every invoice."}
          muted={!details.poReference}
          action={edit("poReference", "Purchase order reference", !details.poReference)}
        />
      )}
    </SettingsCard>
  );
}
