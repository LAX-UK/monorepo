"use client";

import {
  ARTIST_FIELD_ORDER,
  ARTIST_FORM_ID,
} from "@/components/admin/artist-form/admin-artist-form.constants";
import { scenarioFromOwnerUserId } from "@/components/admin/artist-form/scenario-config";
import type { ArtistFormValues, ArtistScenario } from "@/components/admin/artist-form/types";
import { useFormDraft } from "@/components/admin/forms/use-form-draft";
import { useStaffForm } from "@/components/admin/forms/use-staff-form";
import { adminCreateArtistResultAction, adminUpdateArtistResultAction } from "@/lib/actions/admin";
import { applyActionFieldErrors } from "@/lib/forms/apply-action-field-errors";
import { STAFF_PARSE_PARAMS } from "@/lib/forms/staff-error-map";
import { notify } from "@/lib/ui/notify";
import type { ArtistKind } from "@auction/types";
import { adminCreateArtistBodySchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { type Resolver, useWatch } from "react-hook-form";

type Args = {
  mode: "create" | "edit";
  artistId?: string | undefined;
  displayName?: string | undefined;
  defaultValues: ArtistFormValues;
  readOnly?: boolean;
};

/** A maker needs an account to be linked to; a historical or external profile does not. */
export const MAKER_NEEDS_ACCOUNT = "Link the platform account of the seller who makes this work.";

const validateArtist = zodResolver(adminCreateArtistBodySchema, STAFF_PARSE_PARAMS);

/**
 * Attribute fields that were never typed in hold no value at all, which the schema reads as
 * missing; they are left out before validating, as empty ones are on the server.
 */
const artistResolver: Resolver<ArtistFormValues> = (values, context, options) => {
  const attributes = Object.fromEntries(
    Object.entries(values.attributes ?? {}).filter(([, value]) => value !== undefined),
  );
  return validateArtist({ ...values, attributes }, context, options);
};

export function useAdminArtistForm({
  mode,
  artistId,
  displayName,
  defaultValues,
  readOnly = false,
}: Args) {
  const state = useStaffForm<ArtistFormValues>({
    resolver: artistResolver,
    defaultValues,
    formId: ARTIST_FORM_ID,
    fieldOrder: ARTIST_FIELD_ORDER,
    readOnly,
    ...(displayName ? { label: displayName } : {}),
  });
  const { form, setFormError, leave, markSaved } = state;
  const [saving, setSaving] = useState(false);
  const draft = useFormDraft({ form, entityKind: "admin_artist_new", enabled: mode === "create" });

  const watchedKind =
    (useWatch({ control: form.control, name: "kind" }) as ArtistKind | undefined) ?? "artist";
  const watchedOwnerUserId =
    (useWatch({ control: form.control, name: "ownerUserId" }) as string | null | undefined) ?? null;
  const watchedDisplay = useWatch({ control: form.control, name: "displayName" }) ?? "";
  const watchedShortBio = useWatch({ control: form.control, name: "shortBio" }) ?? "";
  const watchedPortrait = useWatch({ control: form.control, name: "portraitUrl" }) ?? "";

  const scenario: ArtistScenario = useMemo(() => {
    if (mode === "edit") return scenarioFromOwnerUserId(watchedOwnerUserId);
    if (watchedOwnerUserId) return "maker-seller";
    return watchedKind === "maker" ? "maker-seller" : "historical";
  }, [mode, watchedKind, watchedOwnerUserId]);

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    if (mode === "create" && scenario === "maker-seller" && !values.ownerUserId) {
      form.setError("ownerUserId", { type: "manual", message: MAKER_NEEDS_ACCOUNT });
      return;
    }
    setSaving(true);
    try {
      const result =
        mode === "create"
          ? await adminCreateArtistResultAction(values)
          : artistId
            ? await adminUpdateArtistResultAction(artistId, values)
            : { ok: false as const, error: "This artist could not be found." };
      if (result.ok) {
        markSaved();
        draft.clear();
        notify.success(mode === "create" ? `${values.displayName} created` : "Changes saved");
        const created = mode === "create" && result.data && "id" in result.data;
        await leave(
          created
            ? `/admin/artists/${(result.data as { id: string }).id}`
            : mode === "edit" && artistId
              ? `/admin/artists/${artistId}`
              : "/admin/artists",
        );
        return;
      }
      if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
        applyActionFieldErrors(form, result.fieldErrors, { focusField: false });
        return;
      }
      setFormError(result.error);
    } finally {
      setSaving(false);
    }
  });

  return {
    ...state,
    submit,
    saving,
    draft,
    scenario,
    watchedKind,
    watchedDisplay,
    watchedShortBio,
    watchedPortrait,
  };
}
