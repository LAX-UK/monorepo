"use client";

import { SeoFieldsInputs } from "@/components/seo-fields-inputs.client";
import { useAdminMutation } from "@/components/use-admin-mutation";
import { type FieldErrors, hasFieldErrors } from "@/lib/form-validation";
import { schemaFieldErrors } from "@/lib/schema-field-errors";
import {
  SEO_FIELD_ERRORS,
  type SeoFieldsFormValues,
  seoFieldsFormValues,
} from "@/lib/seo-fields-form";
import { updateArtistSeo } from "@/server/application/admin-people-actions.server";
import { ArtistSeoWriteBodySchema } from "@auction/shop-contracts";
import { useState } from "react";
import { AdminForm } from "../admin-form";

export function ArtistSeoForm({
  artistId,
  initial,
}: {
  artistId: string;
  initial: { seoTitle?: string | null; seoDescription?: string | null };
}) {
  const mutation = useAdminMutation();
  const [seo, setSeo] = useState<SeoFieldsFormValues>(seoFieldsFormValues(initial));
  const [errors, setErrors] = useState<FieldErrors>({});

  return (
    <AdminForm
      title="Search metadata"
      mutation={mutation}
      errors={errors}
      submitLabel="Save SEO"
      onSubmit={() => {
        // A blank field clears the override, which the API expresses as null.
        const body = {
          seoTitle: seo.seoTitle.trim() || null,
          seoDescription: seo.seoDescription.trim() || null,
        };
        const next = schemaFieldErrors(ArtistSeoWriteBodySchema, body, SEO_FIELD_ERRORS);
        setErrors(next);
        if (hasFieldErrors(next)) return;
        void mutation.run(
          () => updateArtistSeo({ artistId, ...body, idempotencyKey: mutation.idempotencyKey }),
          "SEO metadata saved",
        );
      }}
    >
      <SeoFieldsInputs
        values={seo}
        disabled={mutation.pending}
        blankHint="blank uses the generated default"
        errors={errors}
        onChange={setSeo}
      />
    </AdminForm>
  );
}
