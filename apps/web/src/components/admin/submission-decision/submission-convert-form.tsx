"use client";

import { CreateArtistDialog } from "@/components/admin/artists/create-artist-dialog";
import { staffFieldId } from "@/components/admin/forms/staff-form-fields";
import { searchArtistOptions } from "@/lib/admin/pickers/staff-entity-search";
import { STAFF_PARSE_PARAMS } from "@/lib/forms/staff-error-map";
import {
  type EntityOption,
  EntityPicker,
  Field,
  FormActions,
  Notice,
  Section,
  StaffButton,
} from "@auction/staff-ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { type RefObject, useEffect, useState } from "react";
import { type UseFormReturn, useController, useForm } from "react-hook-form";
import { SUBMISSION_APPROVE_FORM_ID } from "./form-ids";
import { type ApproveFormValues, approveFormSchema } from "./use-submission-decision-actions";

type Props = {
  pending: boolean;
  formRef: RefObject<HTMLFormElement | null>;
  submitterDisplayName?: string | undefined;
  submitterUserId?: string | undefined;
  onSubmit: (values: ApproveFormValues, form: UseFormReturn<ApproveFormValues>) => void;
  /** Reports whether anything is chosen, so the page can ask before it is lost. */
  onDirtyChange: (dirty: boolean) => void;
};

/**
 * Turning an accepted submission into a draft lot: choose the catalogue artist by name, or add the
 * submitter as a new artist without leaving the page. The artist can also be chosen later.
 */
export function SubmissionConvertForm({
  pending,
  formRef,
  submitterDisplayName,
  submitterUserId,
  onSubmit,
  onDirtyChange,
}: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<EntityOption | null>(null);
  const form = useForm<ApproveFormValues>({
    resolver: zodResolver(approveFormSchema, STAFF_PARSE_PARAMS),
    defaultValues: { reviewNotes: "", artistId: null },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const artist = useController({ control: form.control, name: "artistId" });
  const dirty = form.formState.isDirty;
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  const failure = form.formState.errors.root?.server?.message;
  const artistFieldId = staffFieldId(SUBMISSION_APPROVE_FORM_ID, "artistId");

  return (
    <Section
      title="Create the draft lot"
      description="The lot starts as a draft with the seller's details. Finish its catalogue entry from the lot."
    >
      <form
        id={SUBMISSION_APPROVE_FORM_ID}
        ref={formRef}
        noValidate
        aria-label="Create the draft lot"
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => onSubmit(values, form))}
      >
        {failure ? (
          <Notice tone="danger" alert title="The lot was not created">
            {failure}
          </Notice>
        ) : null}
        <Field
          id={artistFieldId}
          label="Catalogue artist"
          optional
          description="The artist, maker or brand the lot is catalogued under. You can set it later."
          error={artist.fieldState.error?.message}
        >
          <EntityPicker
            id={artistFieldId}
            value={artist.field.value ?? null}
            selected={selected}
            search={searchArtistOptions}
            placeholder="No artist yet"
            searchPlaceholder="Search by name, web address or alias"
            emptyText="No artists match. Add one below."
            disabled={pending}
            onValueChange={(option) => {
              setSelected(option);
              artist.field.onChange(option?.id ?? null);
            }}
          />
        </Field>
        {submitterDisplayName ? (
          <div>
            <StaffButton
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => setCreateOpen(true)}
            >
              Use submitter as artist
            </StaffButton>
          </div>
        ) : null}
        <FormActions>
          <StaffButton type="submit" variant="primary" loading={pending}>
            Convert to draft lot
          </StaffButton>
        </FormActions>
      </form>

      <CreateArtistDialog
        open={createOpen}
        initialName={submitterDisplayName ?? ""}
        approveOnCreate
        {...(submitterUserId ? { ownerUserId: submitterUserId } : {})}
        onCreated={(created) => {
          setCreateOpen(false);
          setSelected({ id: created.id, label: created.displayName });
          form.setValue("artistId", created.id, { shouldDirty: true });
        }}
        onCancel={() => setCreateOpen(false)}
      />
    </Section>
  );
}
