"use client";

import {
  EVENT_STATUS_OPTIONS,
  type EventFormValues,
  emptySegment,
  eventFormDefaults,
  eventFormPayload,
  hasEventFormErrors,
  validateEventForm,
} from "@/components/admin/event-rsvps/onsite-event-form-model";
import { StaffBreadcrumbs } from "@/components/admin/staff/staff-breadcrumbs";
import {
  adminCreateOnsiteEventAction,
  adminUpdateOnsiteEventAction,
} from "@/lib/actions/admin/admin-onsite-event";
import type { SaleroomSalePickerOption } from "@/lib/admin/load-saleroom-sales-picker";
import { notify } from "@/lib/ui/notify";
import {
  DateTimeInput,
  type EntityOption,
  EntityPicker,
  EnumSelect,
  Field,
  FormActions,
  FormErrorSummary,
  FormPage,
  FormSection,
  ListEditor,
  Notice,
  StaffButton,
  TextArea,
  TextInput,
  UnsavedChangesDialog,
  useUnsavedChanges,
} from "@auction/staff-ui";
import type { OnsiteEventAdminDetail } from "@auction/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import {
  Controller,
  type FieldErrors,
  type Resolver,
  useFieldArray,
  useForm,
} from "react-hook-form";

type Props = {
  mode: "create" | "edit";
  initial?: OnsiteEventAdminDetail | null;
  saleroomSales?: SaleroomSalePickerOption[];
  /** The linked sale's name, when it is not among `saleroomSales`. */
  linkedSaleTitle?: string | null;
};

const DELIVERY_LABEL: Record<string, string> = {
  onsite: "Onsite sale",
  hybrid: "Hybrid sale",
};

const MAX_SEGMENTS = 10;

type FieldName =
  | "slug"
  | "title"
  | "status"
  | "startsAt"
  | "rsvpCloseAt"
  | "venue"
  | "dressCode"
  | "arrivalNote"
  | "saleId"
  | "segments"
  | "opsEmail"
  | "micrositeUrl";

/** Maps the form's checks onto react-hook-form's error shape, so the library re-checks on change. */
function eventResolver(mode: "create" | "edit"): Resolver<EventFormValues> {
  return (values) => {
    const errors = validateEventForm(values, mode);
    if (!hasEventFormErrors(errors)) return { values, errors: {} };
    const out: Record<string, unknown> = {};
    for (const key of ["slug", "title", "opsEmail", "micrositeUrl", "rsvpCloseAt"] as const) {
      const message = errors[key];
      if (message) out[key] = { type: "validate", message };
    }
    const rows: unknown[] = [];
    for (const [index, message] of Object.entries(errors.segmentLabels)) {
      rows[Number(index)] = { label: { type: "validate", message } };
    }
    if (rows.length > 0 || errors.segments) {
      out.segments = Object.assign(
        rows,
        errors.segments ? { root: { type: "validate", message: errors.segments } } : {},
      );
    }
    return { values: {}, errors: out as FieldErrors<EventFormValues> };
  };
}

/**
 * Creates or edits an invitation-only event. Validates on submit, then again as each field
 * changes; a failed save stays here with its reason, and leaving with unsaved changes asks first.
 */
export function OnsiteEventForm({
  mode,
  initial = null,
  saleroomSales = [],
  linkedSaleTitle = null,
}: Props) {
  const router = useRouter();
  const base = useId();
  const [failure, setFailure] = useState<string | null>(null);

  const form = useForm<EventFormValues>({
    defaultValues: eventFormDefaults(initial),
    resolver: eventResolver(mode),
    mode: "onSubmit",
    shouldFocusError: false,
    reValidateMode: "onChange",
  });
  const segments = useFieldArray({ control: form.control, name: "segments" });
  const { errors, isDirty, isSubmitting, submitCount } = form.formState;

  const backHref = initial
    ? `/admin/event-rsvps/${encodeURIComponent(initial.slug)}`
    : "/admin/event-rsvps";
  const guard = useUnsavedChanges(isDirty, {
    label: initial ? `“${initial.title}”` : "the new event",
    navigate: (href) => router.push(href),
  });

  const id = (name: string) => `${base}-${name}`;
  const fieldId: Record<FieldName, string> = {
    slug: id("slug"),
    title: id("title"),
    status: id("status"),
    startsAt: id("starts"),
    rsvpCloseAt: id("rsvp-close"),
    venue: id("venue"),
    dressCode: id("dress"),
    arrivalNote: id("arrival"),
    saleId: id("sale"),
    segments: id("segment-0-label"),
    opsEmail: id("ops-email"),
    micrositeUrl: id("microsite"),
  };

  const salePickerOptions: EntityOption[] = saleroomSales.map((sale) => ({
    id: sale.id,
    label: sale.title,
    description: DELIVERY_LABEL[sale.deliveryMode] ?? "Sale",
  }));
  const linkedSale: EntityOption | null = initial?.saleId
    ? { id: initial.saleId, label: linkedSaleTitle ?? "Linked sale" }
    : null;

  const segmentErrors = segments.fields.flatMap((_, index) => {
    const message = errors.segments?.[index]?.label?.message;
    return message ? [{ fieldId: id(`segment-${index}-label`), message }] : [];
  });
  const rootSegmentError = errors.segments?.root?.message;
  const summary = [
    ...(errors.slug?.message ? [{ fieldId: fieldId.slug, message: errors.slug.message }] : []),
    ...(errors.title?.message ? [{ fieldId: fieldId.title, message: errors.title.message }] : []),
    ...(errors.rsvpCloseAt?.message
      ? [{ fieldId: fieldId.rsvpCloseAt, message: errors.rsvpCloseAt.message }]
      : []),
    ...(rootSegmentError ? [{ fieldId: fieldId.segments, message: rootSegmentError }] : []),
    ...segmentErrors,
    ...(errors.opsEmail?.message
      ? [{ fieldId: fieldId.opsEmail, message: errors.opsEmail.message }]
      : []),
    ...(errors.micrositeUrl?.message
      ? [{ fieldId: fieldId.micrositeUrl, message: errors.micrositeUrl.message }]
      : []),
  ];

  const onSubmit = form.handleSubmit(async (values) => {
    setFailure(null);
    const payload = eventFormPayload(values);
    const result =
      mode === "create"
        ? await adminCreateOnsiteEventAction(payload)
        : await adminUpdateOnsiteEventAction({ ...payload, slug: initial?.slug ?? payload.slug });
    if (!result.ok) {
      setFailure(result.error);
      return;
    }
    const slug = result.data?.slug ?? payload.slug;
    notify.success(mode === "create" ? `${payload.title} created` : "Changes saved");
    await guard.release();
    router.push(`/admin/event-rsvps/${encodeURIComponent(slug)}`);
    router.refresh();
  });

  return (
    <FormPage
      breadcrumbs={
        <StaffBreadcrumbs
          items={[
            { label: "Event RSVPs", href: "/admin/event-rsvps" },
            ...(initial ? [{ label: initial.title, href: backHref }] : []),
            { label: mode === "create" ? "New event" : "Edit event" },
          ]}
        />
      }
      title={mode === "create" ? "New event" : "Edit event"}
      description="An invitation-only event. Link it to an onsite or hybrid sale to give expected guests the express lane at check-in."
    >
      <form
        noValidate
        aria-label="Event details"
        className="flex flex-col gap-6"
        onSubmit={onSubmit}
      >
        <FormErrorSummary errors={summary} focusKey={submitCount} />
        {failure ? (
          <Notice tone="danger" alert title="That did not go through">
            {failure}
          </Notice>
        ) : null}

        <FormSection title="Event" description="What guests see on their invitation.">
          {mode === "create" ? (
            <Field
              label="Slug"
              id={fieldId.slug}
              description="Used in the event's links and cannot be changed later. Lowercase letters, numbers and hyphens, for example lax002."
              error={errors.slug?.message}
            >
              <TextInput placeholder="e.g. lax002" autoComplete="off" {...form.register("slug")} />
            </Field>
          ) : null}
          <Field label="Title" id={fieldId.title} error={errors.title?.message}>
            <TextInput placeholder="e.g. Opening evening" {...form.register("title")} />
          </Field>
          <Field label="Status" id={fieldId.status}>
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <EnumSelect
                  value={field.value}
                  onValueChange={field.onChange}
                  options={EVENT_STATUS_OPTIONS}
                />
              )}
            />
          </Field>
        </FormSection>

        <FormSection title="When and where" description="Times are in London.">
          <Field label="Starts" optional id={fieldId.startsAt}>
            <Controller
              control={form.control}
              name="startsAt"
              render={({ field }) => (
                <DateTimeInput value={field.value} onValueChange={field.onChange} />
              )}
            />
          </Field>
          <Field
            label="RSVPs close"
            optional
            id={fieldId.rsvpCloseAt}
            error={errors.rsvpCloseAt?.message}
          >
            <Controller
              control={form.control}
              name="rsvpCloseAt"
              render={({ field }) => (
                <DateTimeInput
                  value={field.value}
                  onValueChange={field.onChange}
                  timeLabel="RSVP closing time, 24-hour clock"
                />
              )}
            />
          </Field>
          <Field label="Venue" optional id={fieldId.venue}>
            <TextInput {...form.register("venue")} />
          </Field>
          <Field label="Dress code" optional id={fieldId.dressCode}>
            <TextInput placeholder="e.g. Smart formal" {...form.register("dressCode")} />
          </Field>
          <Field
            label="Arrival note"
            optional
            id={fieldId.arrivalNote}
            description="Shown to guests with their pass."
          >
            <TextArea
              rows={2}
              placeholder="e.g. Doors open at 6pm. Passes are personal."
              {...form.register("arrivalNote")}
            />
          </Field>
        </FormSection>

        <FormSection
          title="Guests"
          description="How guests can attend, and the sale that gives them the express lane."
        >
          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="text-staff-sm font-medium text-staff-fg">Ways to attend</legend>
            <p className="text-staff-xs text-staff-muted">
              Guests pick one when they RSVP. The order here is the order they see.
            </p>
            <ListEditor
              items={segments.fields}
              getKey={(item) => item.id}
              itemLabel={(index) => `option ${index + 1}`}
              addLabel="Add an option"
              emptyText="No options yet."
              max={MAX_SEGMENTS}
              onAdd={() => segments.append(emptySegment())}
              onRemove={(index) => segments.remove(index)}
              onMove={(from, to) => segments.move(from, to)}
              renderItem={(_, index) => (
                <>
                  <Field
                    label={
                      <>
                        Name<span className="sr-only"> of option {index + 1}</span>
                      </>
                    }
                    id={id(`segment-${index}-label`)}
                    error={errors.segments?.[index]?.label?.message}
                  >
                    <TextInput
                      placeholder="e.g. Full evening"
                      {...form.register(`segments.${index}.label` as const)}
                    />
                  </Field>
                  <Field
                    label={
                      <>
                        Note<span className="sr-only"> for option {index + 1}</span>
                      </>
                    }
                    optional
                    id={id(`segment-${index}-helper`)}
                  >
                    <TextInput
                      placeholder="e.g. From 7pm"
                      {...form.register(`segments.${index}.helper` as const)}
                    />
                  </Field>
                </>
              )}
            />
            {rootSegmentError ? (
              <p className="text-staff-xs font-medium text-staff-danger-fg">{rootSegmentError}</p>
            ) : null}
          </fieldset>
          <Field
            label="Linked sale"
            optional
            id={fieldId.saleId}
            description="An onsite or hybrid sale. Choose the selected sale again to unlink it."
          >
            <Controller
              control={form.control}
              name="saleId"
              render={({ field }) => (
                <EntityPicker
                  value={field.value}
                  onValueChange={(option) => field.onChange(option?.id ?? null)}
                  options={salePickerOptions}
                  selected={linkedSale}
                  placeholder="No linked sale"
                  searchPlaceholder="Search sales"
                  emptyText="No onsite or hybrid sales match."
                />
              )}
            />
          </Field>
        </FormSection>

        <FormSection title="Contact" description="Where guests are sent for help and details.">
          <Field label="Ops email" optional id={fieldId.opsEmail} error={errors.opsEmail?.message}>
            <TextInput
              type="email"
              placeholder="e.g. events@lax.bid"
              autoComplete="off"
              {...form.register("opsEmail")}
            />
          </Field>
          <Field
            label="Microsite address"
            optional
            id={fieldId.micrositeUrl}
            error={errors.micrositeUrl?.message}
          >
            <TextInput
              inputMode="url"
              placeholder="e.g. https://event.lax.bid/lax002"
              autoComplete="off"
              {...form.register("micrositeUrl")}
            />
          </Field>
        </FormSection>

        <FormActions>
          <StaffButton asChild variant="secondary">
            <Link href={backHref}>Cancel</Link>
          </StaffButton>
          <StaffButton type="submit" variant="primary" loading={isSubmitting}>
            {mode === "create" ? "Create event" : "Save changes"}
          </StaffButton>
        </FormActions>
      </form>
      <UnsavedChangesDialog guard={guard} />
    </FormPage>
  );
}
