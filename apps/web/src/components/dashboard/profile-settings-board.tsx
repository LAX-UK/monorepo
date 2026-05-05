"use client";

import { UploadField } from "@/components/forms/upload-field";
import { Button } from "@/components/ui/button";
import { UnderlineInput } from "@/components/ui/input";
import { LabelCaps } from "@/components/ui/typography";
import { updateProfileImageAction } from "@/lib/actions/profile";
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
import { CreditCard, Pencil, Phone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export type ProfileAddressRow = {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  addressType: "shipping" | "billing" | "both";
  isDefault: boolean;
};

type Props = {
  initialName: string;
  initialImage: string | null;
  addresses: ProfileAddressRow[];
};

function ProfileNameCard({ initialName }: { initialName: string }) {
  const { form, onSubmit, isSubmitting } = useProfileNameController(initialName);

  return (
    <Card className="rounded-sm border-outline-variant/20 shadow-none">
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="font-label text-xs font-bold uppercase tracking-[0.18em] text-on-surface">
            Personal details
          </CardTitle>
          <CardDescription className="mt-1 text-xs">
            Your public display name and profile details.
          </CardDescription>
        </div>
        <Button
          type="submit"
          form="profile-name-form"
          variant="tertiary"
          className="h-8 px-2 text-on-surface"
        >
          <Pencil className="mr-1 size-3.5" aria-hidden />
          Edit
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <Form {...form}>
          <form id="profile-name-form" onSubmit={onSubmit} className="space-y-4">
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
                      className="w-full border-b border-outline-variant/40 py-2 font-medium"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" variant="primary" disabled={isSubmitting} className="min-w-28">
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
          {" · "}
          <Link
            href="/dashboard/settings/account"
            className="text-primary underline-offset-2 hover:underline"
          >
            Manage email and sign-in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function ProfileAvatarCard({ initialImage }: { initialImage: string | null }) {
  const [value, setValue] = useState(initialImage ? [initialImage] : []);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function persist(next: string[]) {
    setValue(next);
    startTransition(async () => {
      const r = await updateProfileImageAction({ image: next[0] ?? null });
      if (r.ok) {
        toast.success("Profile image updated");
        router.refresh();
        return;
      }
      toast.error(r.error);
    });
  }

  return (
    <Card className="rounded-sm border-outline-variant/20 shadow-none">
      <CardHeader>
        <CardTitle className="font-label text-xs font-bold uppercase tracking-[0.18em] text-on-surface">
          Profile picture
        </CardTitle>
        <CardDescription>Shown on your profile and bidding account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <UploadField kind="avatar" maxFiles={1} value={value} onChange={persist} />
        {pending ? <p className="font-body text-xs text-on-surface-variant">Saving…</p> : null}
      </CardContent>
    </Card>
  );
}

function AddAddressCard() {
  const { form, onSubmit, isSubmitting } = useCreateAddressController();

  return (
    <div className="space-y-4">
      <h3 className="font-label text-xs uppercase tracking-[0.18em] text-on-surface">
        Add new address
      </h3>
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
            name="addressType"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <select
                    value={field.value ?? "both"}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    className="min-h-11 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface"
                  >
                    <option value="both">Billing and shipping</option>
                    <option value="shipping">Shipping only</option>
                    <option value="billing">Billing only</option>
                  </select>
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
            <Button type="submit" variant="secondary" disabled={isSubmitting} className="min-w-28">
              {isSubmitting ? "Adding…" : "Add address"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

export function ProfileSettingsBoard({ initialName, initialImage, addresses }: Props) {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <ProfileAvatarCard initialImage={initialImage} />
      <ProfileNameCard initialName={initialName} />

      <Card className="rounded-sm border-outline-variant/20 shadow-none">
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="font-label text-xs font-bold uppercase tracking-[0.18em] text-on-surface">
              Address management
            </CardTitle>
            <CardDescription>Shipping addresses used for invoices and delivery.</CardDescription>
          </div>
          <Button asChild type="button" variant="tertiary" className="h-8 px-2 text-on-surface">
            <Link href="/dashboard/settings/addresses">
              <Pencil className="mr-1 size-3.5" aria-hidden />
              Manage all addresses
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {addresses.length === 0 ? (
            <p className="font-body text-sm text-on-surface-variant">No addresses yet.</p>
          ) : (
            <ul className="space-y-3">
              {addresses.map((a) => (
                <li
                  key={a.id}
                  className="rounded-sm border border-outline-variant/20 bg-surface-container-low/40 px-4 py-3 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-label text-[11px] uppercase tracking-[0.16em] text-on-surface">
                      {a.label}
                    </span>
                    {a.isDefault ? (
                      <span className="rounded bg-success/10 px-2 py-0.5 font-label text-[10px] uppercase text-success">
                        Default
                      </span>
                    ) : null}
                    <span className="rounded bg-surface-container-high px-2 py-0.5 font-label text-[10px] uppercase text-on-surface-variant">
                      {a.addressType === "both" ? "Billing + shipping" : a.addressType}
                    </span>
                  </div>
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

      <Card className="rounded-sm border-outline-variant/20 shadow-none">
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="font-label text-xs font-bold uppercase tracking-[0.18em] text-on-surface">
              Phone book
            </CardTitle>
            <CardDescription>Phone numbers for bid and delivery updates.</CardDescription>
          </div>
          <Button type="button" variant="tertiary" className="h-8 px-2 text-on-surface">
            <Phone className="mr-1 size-3.5" aria-hidden />
            Add number
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            Phone management is not connected yet in this release.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-sm border-outline-variant/20 shadow-none">
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="font-label text-xs font-bold uppercase tracking-[0.18em] text-on-surface">
              Payment method
            </CardTitle>
            <CardDescription>Saved payment methods appear here.</CardDescription>
          </div>
          <Button type="button" variant="tertiary" className="h-8 px-2 text-on-surface">
            <CreditCard className="mr-1 size-3.5" aria-hidden />
            Add card
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            Payment method management is not connected yet in this release.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
