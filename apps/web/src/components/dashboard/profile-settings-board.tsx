"use client";

import { SettingsField } from "@/components/dashboard/settings-field";
import { SettingsSection } from "@/components/dashboard/settings-section";
import { SettingsTag } from "@/components/dashboard/settings-tag";
import { ImageUploadField } from "@/components/forms/image-upload-field";
import { PhoneNumberField } from "@/components/forms/phone-number-field";
import { UnderlineInput } from "@/components/ui/input";
import { RhfSelect } from "@/components/ui/rhf-select";
import {
  updateProfileImageAction,
  updateProfilePhoneFromValuesAction,
} from "@/lib/actions/profile";
import { useCreateAddressController } from "@/lib/forms/profile/use-create-address-controller";
import { useProfileMobileController } from "@/lib/forms/profile/use-profile-mobile-controller";
import { useProfileNameController } from "@/lib/forms/profile/use-profile-name-controller";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
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
import { StatusBadge } from "@auction/ui/components/status-badge";
import { CreditCard, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
  initialMobile: string | null;
  initialMobileCountry: string | null;
  phoneDefaultCountry: string;
  addresses: ProfileAddressRow[];
  /** When set, shows email + verification in Personal details */
  email?: string;
  emailVerified?: boolean;
  emailStatus?: string;
};

function emailStatusLabel(status: string | undefined, verified: boolean | undefined): string {
  if (status === "bounced") return "Bounced";
  if (status === "complained") return "Complained";
  if (verified === false) return "Unverified";
  return "Verified";
}

function emailStatusVariant(
  status: string | undefined,
  verified: boolean | undefined,
): "success" | "danger" | "warning" {
  if (status === "bounced" || status === "complained") return "danger";
  if (verified === false) return "warning";
  return "success";
}

function PersonalMobileBlock({
  initialMobile,
  initialMobileCountry,
  phoneDefaultCountry,
}: {
  initialMobile: string | null;
  initialMobileCountry: string | null;
  phoneDefaultCountry: string;
}) {
  const router = useRouter();
  const { form, onSubmit, isSubmitting } = useProfileMobileController(
    initialMobile,
    initialMobileCountry,
    phoneDefaultCountry as import("libphonenumber-js").CountryCode,
  );
  const [removePending, startRemove] = useTransition();

  return (
    <div className="rounded-xl border border-border-hairline bg-surface-container-lowest p-6">
      <Form {...form}>
        <form id="profile-mobile-form" onSubmit={onSubmit} className="space-y-3">
          <FormField
            control={form.control}
            name="phone"
            render={({ field, fieldState }) => (
              <PhoneNumberField
                id="profile-phone"
                defaultCountry={phoneDefaultCountry as import("libphonenumber-js").CountryCode}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message ?? null}
                description="Optional contact number for live bidding updates and fulfilment. We do not verify this number yet."
              />
            )}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              variant="secondaryOutline"
              disabled={isSubmitting || removePending}
              className="min-w-28"
            >
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
            {initialMobile ? (
              <Button
                type="button"
                variant="ghost"
                disabled={isSubmitting || removePending}
                onClick={() => {
                  startRemove(async () => {
                    const r = await updateProfilePhoneFromValuesAction({
                      phone: null,
                      mobile: null,
                    });
                    if (r.ok) {
                      notify.success("Phone number removed");
                      form.reset({
                        phone: { country: phoneDefaultCountry, number: "" },
                      });
                      router.refresh();
                      return;
                    }
                    notify.error(r.error);
                  });
                }}
              >
                {removePending ? "Removing…" : "Remove"}
              </Button>
            ) : null}
          </div>
        </form>
      </Form>
    </div>
  );
}

function PersonalNameBlock({ initialName }: { initialName: string }) {
  const { form, onSubmit, isSubmitting } = useProfileNameController(initialName);

  return (
    <SettingsField
      label="Name"
      value={
        <Form {...form}>
          <form id="profile-name-form" onSubmit={onSubmit} className="w-full max-w-lg space-y-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Display name</FormLabel>
                  <FormControl>
                    <UnderlineInput
                      {...field}
                      className="w-full border-b border-outline-variant/50 py-2 font-body text-base font-normal text-on-surface"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              variant="secondaryOutline"
              disabled={isSubmitting}
              className="min-w-28"
            >
              {isSubmitting ? "Saving…" : "Save name"}
            </Button>
          </form>
        </Form>
      }
    />
  );
}

function ProfileAvatarBlock({ initialImage }: { initialImage: string | null }) {
  const [value, setValue] = useState(initialImage ? [initialImage] : []);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function persist(next: string[]) {
    setValue(next);
    startTransition(async () => {
      const r = await updateProfileImageAction({ image: next[0] ?? null });
      if (r.ok) {
        notify.success("Profile image updated");
        router.refresh();
        return;
      }
      notify.error(r.error);
    });
  }

  return (
    <div className="rounded-xl border border-border-hairline bg-surface-container-lowest p-6">
      <p className="font-label text-sm font-bold uppercase tracking-wide text-on-surface">
        Profile photo
      </p>
      <p className="mt-1 font-body text-sm text-on-surface-variant">
        Shown on your profile and bidding account.
      </p>
      <div className="mt-4 max-w-md">
        <ImageUploadField kind="avatar" maxFiles={1} value={value} onChange={persist} />
        {pending ? <p className="mt-2 font-body text-xs text-on-surface-variant">Saving…</p> : null}
      </div>
    </div>
  );
}

function AddAddressBlock() {
  const { form, onSubmit, isSubmitting } = useCreateAddressController();

  return (
    <div className="space-y-4 rounded-xl border border-border-hairline bg-surface-container-low/30 p-5">
      <h3 className="font-label text-xs font-bold uppercase tracking-[0.18em] text-on-surface">
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
                <RhfSelect
                  value={field.value ?? "both"}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  options={[
                    { value: "both", label: "Billing and shipping" },
                    { value: "shipping", label: "Shipping only" },
                    { value: "billing", label: "Billing only" },
                  ]}
                  triggerClassName="min-h-11 w-full font-body text-sm"
                />
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
            <Button
              type="submit"
              variant="secondaryOutline"
              disabled={isSubmitting}
              className="min-w-28"
            >
              {isSubmitting ? "Adding…" : "Add address"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

function addressTypeTags(a: ProfileAddressRow) {
  const tags: { key: string; label: string }[] = [];
  if (a.isDefault) tags.push({ key: "default", label: "Default" });
  if (a.addressType === "both") tags.push({ key: "both", label: "Billing & shipping" });
  else if (a.addressType === "billing") tags.push({ key: "bill", label: "Billing" });
  else tags.push({ key: "ship", label: "Shipping" });
  return tags;
}

export function ProfileSettingsBoard({
  initialName,
  initialImage,
  initialMobile,
  initialMobileCountry,
  phoneDefaultCountry,
  addresses,
  email,
  emailVerified,
  emailStatus,
}: Props) {
  return (
    <div className="space-y-10">
      <ProfileAvatarBlock initialImage={initialImage} />

      <div className="rounded-xl border border-border-hairline bg-surface-container-lowest p-6">
        <SettingsSection title="Personal details" eyebrow bordered={false}>
          <div className="space-y-6">
            <PersonalNameBlock initialName={initialName} />
            {email ? (
              <SettingsField
                label="Email address"
                action={
                  <Link
                    href="/dashboard/settings/account"
                    className="font-label text-sm font-semibold text-on-surface underline underline-offset-2"
                  >
                    Edit
                  </Link>
                }
                value={email}
                valueAccessory={
                  <StatusBadge variant={emailStatusVariant(emailStatus, emailVerified)} size="sm">
                    {emailStatusLabel(emailStatus, emailVerified)}
                  </StatusBadge>
                }
              />
            ) : null}
          </div>
        </SettingsSection>
      </div>

      <SettingsSection
        title="Address management"
        action={
          <Link
            href="/dashboard/settings/addresses"
            className="inline-flex items-center gap-1 font-label text-sm font-semibold text-on-surface underline underline-offset-2"
          >
            <Pencil className="size-3.5" aria-hidden />
            Edit
          </Link>
        }
      >
        {addresses.length === 0 ? (
          <p className="font-body text-sm text-on-surface-variant">No addresses yet.</p>
        ) : (
          <ul className="space-y-6">
            {addresses.map((a, index) => (
              <li
                key={a.id}
                className="rounded-xl border border-border-hairline bg-surface-container-lowest p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-label text-sm font-bold uppercase tracking-wide text-on-surface">
                    {a.label || `Address ${index + 1}`}
                  </span>
                  <Link
                    href="/dashboard/settings/addresses"
                    className="font-label text-sm font-semibold text-on-surface underline underline-offset-2"
                  >
                    Edit
                  </Link>
                </div>
                <p className="mt-3 font-body text-base leading-6 text-on-surface">
                  {a.line1}
                  {a.line2 ? (
                    <>
                      <br />
                      {a.line2}
                    </>
                  ) : null}
                  <br />
                  {a.city}
                  {a.state ? `, ${a.state}` : ""} {a.postalCode}
                  <br />
                  {a.country}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {addressTypeTags(a).map((t) => (
                    <SettingsTag key={t.key} variant="outline">
                      {t.label}
                    </SettingsTag>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
        <Separator className="bg-outline-variant/20" />
        <AddAddressBlock />
      </SettingsSection>

      <SettingsSection title="Phone" bordered={false}>
        <PersonalMobileBlock
          initialMobile={initialMobile}
          initialMobileCountry={initialMobileCountry}
          phoneDefaultCountry={phoneDefaultCountry}
        />
      </SettingsSection>

      <SettingsSection
        title="Payment method"
        bordered={false}
        action={
          <Link
            href="/dashboard/settings/payment-methods"
            className="inline-flex items-center gap-1 font-label text-sm font-semibold text-on-surface underline underline-offset-2"
          >
            <CreditCard className="size-3.5" aria-hidden />
            Manage
          </Link>
        }
      >
        <p className="font-body text-sm text-on-surface-variant">
          Cards are saved during checkout and used for future invoices. View saved cards on the
          payment methods page.
        </p>
      </SettingsSection>
    </div>
  );
}
