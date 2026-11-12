"use client";

import {
  type EnquiryFormValues,
  budgetOptions,
  contactPreferenceOptions,
  departmentOptions,
  timingOptions,
} from "@/lib/private-sales/enquiry-values";
import { Checkbox } from "@auction/ui/lax/checkbox";
import { Field } from "@auction/ui/lax/field";
import { TextArea, TextInput } from "@auction/ui/lax/input";
import { NativeSelect } from "@auction/ui/lax/native-select";
import { useId } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";

type Form = UseFormReturn<EnquiryFormValues>;

/** The control ids the error summary links to, per path, in page order. */
export const FIELD_IDS = {
  sell: {
    departmentSlug: "enquiry-department",
    artist: "enquiry-artist",
    title: "enquiry-title",
    mediumSize: "enquiry-medium",
    location: "enquiry-location",
    price: "enquiry-price",
    name: "enquiry-name",
    email: "enquiry-email",
    phone: "enquiry-phone",
    contactPreference: "enquiry-contact",
  },
  buy: {
    lookingFor: "enquiry-looking-for",
    budgetBand: "enquiry-budget",
    timing: "enquiry-timing",
    notes: "enquiry-notes",
    name: "enquiry-name",
    email: "enquiry-email",
    phone: "enquiry-phone",
    contactPreference: "enquiry-contact",
  },
} as const;

const DEPARTMENTS = [{ value: "", label: "Choose a department" }, ...departmentOptions()];
const BUDGETS = [{ value: "", label: "Choose a budget" }, ...budgetOptions];

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">{children}</div>;
}

function SelectField({
  form,
  name,
  label,
  id,
  options,
  optional,
  description,
}: {
  form: Form;
  name: keyof EnquiryFormValues &
    ("departmentSlug" | "budgetBand" | "timing" | "contactPreference");
  label: string;
  id: string;
  options: readonly { value: string; label: string }[];
  optional?: boolean;
  description?: string;
}) {
  return (
    <Field
      label={label}
      id={id}
      error={form.formState.errors[name]?.message}
      {...(optional ? { optional: true } : {})}
      {...(description ? { description } : {})}
    >
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <NativeSelect
            value={String(field.value)}
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            options={options}
          />
        )}
      />
    </Field>
  );
}

/** What a seller tells a specialist about the work. */
export function SellFields({ form }: { form: Form }) {
  const errors = form.formState.errors;
  const notSure = form.watch("priceNotSure");
  const notSureId = useId();
  return (
    <>
      <SelectField
        form={form}
        name="departmentSlug"
        label="Department"
        id={FIELD_IDS.sell.departmentSlug}
        options={DEPARTMENTS}
      />
      <Field label="Artist or maker" id={FIELD_IDS.sell.artist} error={errors.artist?.message}>
        <TextInput maxLength={200} autoComplete="off" {...form.register("artist")} />
      </Field>
      <Field
        label="Title or short description"
        id={FIELD_IDS.sell.title}
        error={errors.title?.message}
      >
        <TextInput maxLength={300} autoComplete="off" {...form.register("title")} />
      </Field>
      <Row>
        <Field
          label="Medium and size"
          id={FIELD_IDS.sell.mediumSize}
          optional
          error={errors.mediumSize?.message}
        >
          <TextInput
            maxLength={200}
            placeholder="Oil on board, 61 × 76 cm"
            autoComplete="off"
            {...form.register("mediumSize")}
          />
        </Field>
        <Field
          label="Where the work is now"
          id={FIELD_IDS.sell.location}
          error={errors.location?.message}
        >
          <TextInput
            maxLength={240}
            placeholder="London, UK"
            autoComplete="off"
            {...form.register("location")}
          />
        </Field>
      </Row>
      <Field
        label="Price in mind"
        id={FIELD_IDS.sell.price}
        optional
        description="It helps us suggest the right route. Leave it blank if you're not sure."
        error={errors.price?.message}
      >
        <div className="flex flex-col gap-2">
          <TextInput
            inputMode="decimal"
            autoComplete="off"
            disabled={notSure}
            leading={
              <span aria-hidden className="text-lax-muted">
                £
              </span>
            }
            {...form.register("price")}
          />
          <Controller
            control={form.control}
            name="priceNotSure"
            render={({ field }) => (
              <div className="flex min-h-6 items-center gap-2 text-lax-13 text-lax-fg">
                <Checkbox
                  id={notSureId}
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
                <label htmlFor={notSureId} className="cursor-pointer">
                  Not sure yet
                </label>
              </div>
            )}
          />
        </div>
      </Field>
    </>
  );
}

/** What a buyer asks a specialist to look for. */
export function BuyFields({ form }: { form: Form }) {
  const errors = form.formState.errors;
  return (
    <>
      <Field
        label="What are you looking for?"
        id={FIELD_IDS.buy.lookingFor}
        description="An artist, a period or a kind of work."
        error={errors.lookingFor?.message}
      >
        <TextArea rows={4} maxLength={2000} {...form.register("lookingFor")} />
      </Field>
      <Row>
        <SelectField
          form={form}
          name="budgetBand"
          label="Budget"
          id={FIELD_IDS.buy.budgetBand}
          options={BUDGETS}
        />
        <SelectField
          form={form}
          name="timing"
          label="Timing"
          id={FIELD_IDS.buy.timing}
          options={timingOptions}
        />
      </Row>
      <Field
        label="Anything else we should know"
        id={FIELD_IDS.buy.notes}
        optional
        error={errors.notes?.message}
      >
        <TextArea rows={3} maxLength={5000} {...form.register("notes")} />
      </Field>
    </>
  );
}

/** Who is asking, for a visitor who is not signed in. */
export function GuestContactFields({ form }: { form: Form }) {
  const errors = form.formState.errors;
  return (
    <>
      <Row>
        <Field label="Your name" id={FIELD_IDS.sell.name} error={errors.name?.message}>
          <TextInput maxLength={120} autoComplete="name" {...form.register("name")} />
        </Field>
        <Field label="Email" id={FIELD_IDS.sell.email} error={errors.email?.message}>
          <TextInput
            type="email"
            inputMode="email"
            autoComplete="email"
            {...form.register("email")}
          />
        </Field>
      </Row>
    </>
  );
}

export function PhoneField({ form }: { form: Form }) {
  const preference = form.watch("contactPreference");
  return (
    <Field
      label="Phone"
      id={FIELD_IDS.sell.phone}
      {...(preference === "email"
        ? { optional: true, description: "Only if you'd like a call." }
        : {})}
      error={form.formState.errors.phone?.message}
    >
      <TextInput type="tel" inputMode="tel" autoComplete="tel" {...form.register("phone")} />
    </Field>
  );
}

export function ContactPreferenceField({ form }: { form: Form }) {
  return (
    <SelectField
      form={form}
      name="contactPreference"
      label="How should we contact you?"
      id={FIELD_IDS.sell.contactPreference}
      options={contactPreferenceOptions}
    />
  );
}
