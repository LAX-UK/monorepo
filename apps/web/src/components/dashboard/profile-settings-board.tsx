"use client";

import { Button } from "@/components/ui/button";
import { UnderlineInput } from "@/components/ui/input";
import { LabelCaps } from "@/components/ui/typography";
import { useCreateAddressController } from "@/lib/forms/profile/use-create-address-controller";
import { useProfileNameController } from "@/lib/forms/profile/use-profile-name-controller";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@auction/ui/components/card";
import { Checkbox } from "@auction/ui/components/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Separator } from "@auction/ui/components/separator";
import Link from "next/link";

export type ProfileAddressRow = {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  isDefault: boolean;
};

type Props = {
  email: string;
  initialName: string;
  addresses: ProfileAddressRow[];
};

function ProfileNameCard({ email, initialName }: { email: string; initialName: string }) {
  const { form, onSubmit, isSubmitting } = useProfileNameController(initialName);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-label text-xs font-bold uppercase tracking-widest text-secondary">
          Account
        </CardTitle>
        <CardDescription>Signed in as {email}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-label text-xs uppercase text-on-surface-variant">
                    <LabelCaps>Display name</LabelCaps>
                  </FormLabel>
                  <FormControl>
                    <UnderlineInput
                      {...field}
                      className="w-full border-b-2 border-outline-variant/40 py-2"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save name"}
            </Button>
          </form>
        </Form>
        <p className="font-body text-xs text-on-surface-variant">
          <Link
            href="/dashboard/settings/security"
            className="text-primary underline-offset-2 hover:underline"
          >
            Security settings
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function AddAddressCard() {
  const { form, onSubmit, isSubmitting } = useCreateAddressController();

  return (
    <div className="space-y-4">
      <h3 className="font-label text-xs uppercase tracking-widest text-secondary">Add address</h3>
      <Form {...form}>
        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
          <FormField
            control={form.control}
            name="label"
            render={({ field }) => (
              <FormItem className="md:col-span-1">
                <FormControl>
                  <UnderlineInput
                    {...field}
                    placeholder="Label (e.g. Home)"
                    className="border-b py-2"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="line1"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <UnderlineInput
                    {...field}
                    placeholder="Address line 1"
                    className="border-b py-2"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="line2"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <UnderlineInput
                    {...field}
                    placeholder="Line 2 (optional)"
                    className="border-b py-2"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <UnderlineInput {...field} placeholder="City" className="border-b py-2" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <UnderlineInput
                    {...field}
                    placeholder="State / region"
                    className="border-b py-2"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="postalCode"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <UnderlineInput {...field} placeholder="Postal code" className="border-b py-2" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <UnderlineInput {...field} placeholder="Country" className="border-b py-2" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isDefault"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-2 space-y-0 md:col-span-2">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(v) => field.onChange(v === true)}
                  />
                </FormControl>
                <FormLabel className="font-body text-sm font-normal text-on-surface">
                  Set as default shipping address
                </FormLabel>
              </FormItem>
            )}
          />
          <div className="md:col-span-2">
            <Button type="submit" variant="secondary" disabled={isSubmitting}>
              {isSubmitting ? "Adding…" : "Add address"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

export function ProfileSettingsBoard({ email, initialName, addresses }: Props) {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <ProfileNameCard email={email} initialName={initialName} />

      <Card>
        <CardHeader>
          <CardTitle className="font-label text-xs font-bold uppercase tracking-widest text-secondary">
            Addresses
          </CardTitle>
          <CardDescription>Shipping addresses used for invoices and delivery.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {addresses.length === 0 ? (
            <p className="font-body text-sm text-on-surface-variant">No addresses yet.</p>
          ) : (
            <ul className="space-y-3">
              {addresses.map((a) => (
                <li key={a.id} className="rounded-lg bg-surface-container-low/50 px-4 py-3 text-sm">
                  <span className="font-label text-xs uppercase text-primary">{a.label}</span>
                  {a.isDefault ? (
                    <span className="ml-2 rounded bg-primary/10 px-2 py-0.5 font-label text-[10px] uppercase text-primary">
                      Default
                    </span>
                  ) : null}
                  <p className="mt-1 text-on-surface">
                    {a.line1}
                    {a.line2 ? `, ${a.line2}` : ""}
                  </p>
                  <p className="text-on-surface-variant">
                    {a.city}
                    {a.state ? `, ${a.state}` : ""} {a.postalCode}, {a.country}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Separator />
          <AddAddressCard />
        </CardContent>
      </Card>
    </div>
  );
}
