"use client";

import { ArtistPreview } from "@/components/admin/artist-form/artist-preview";
import { ArtistScenarioBadge } from "@/components/admin/artist-form/scenario-badge";
import {
  SCENARIO_REGISTRY,
  scenarioFromOwnerUserId,
} from "@/components/admin/artist-form/scenario-config";
import { ScenarioSelector } from "@/components/admin/artist-form/scenario-selector";
import { BiographySection } from "@/components/admin/artist-form/sections/biography-section";
import { CatalogueSection } from "@/components/admin/artist-form/sections/catalogue-section";
import { FlagsSection } from "@/components/admin/artist-form/sections/flags-section";
import { IdentitySection } from "@/components/admin/artist-form/sections/identity-section";
import { LifespanSection } from "@/components/admin/artist-form/sections/lifespan-section";
import { MediaSection } from "@/components/admin/artist-form/sections/media-section";
import { UserLinkSection } from "@/components/admin/artist-form/sections/user-link-section";
import type { ArtistFormValues, ArtistScenario } from "@/components/admin/artist-form/types";
import { FormDirtyGuard } from "@/components/admin/form-dirty-guard";
import { CatalogFormSection as ArtistFormSection } from "@/components/admin/forms/catalog-form-section";
import { adminCreateArtistResultAction, adminUpdateArtistResultAction } from "@/lib/actions/admin";
import { artistKindMeta } from "@/lib/artists/kind-presenter";
import { applyActionFieldErrors } from "@/lib/forms/apply-action-field-errors";
import { notify } from "@/lib/ui/notify";
import type { ArtistKind } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Form } from "@auction/ui/components/form";
import { LoadingButton } from "@auction/ui/components/loading-button";
import { adminCreateArtistBodySchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";

type Props = {
  mode: "create" | "edit";
  artistId?: string;
  defaultValues: ArtistFormValues;
  /** From URL `?scenario=historical` or `maker-seller` */
  initialScenario?: ArtistScenario | null;
  /** When true all fields are disabled (e.g. merged artist) */
  readOnly?: boolean;
  /** DOM id on the root `<form>` for external submit triggers (e.g. mobile action bar). */
  htmlFormId?: string;
};

export function AdminArtistForm({
  mode,
  artistId,
  defaultValues,
  initialScenario = null,
  readOnly = false,
  htmlFormId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<ArtistFormValues>({
    resolver: zodResolver(adminCreateArtistBodySchema),
    defaultValues,
  });

  const editScenario = useMemo(
    () => scenarioFromOwnerUserId(defaultValues.ownerUserId),
    [defaultValues.ownerUserId],
  );

  const [createScenario, setCreateScenario] = useState<ArtistScenario | null>(() => {
    if (mode === "edit") return null;
    if (defaultValues.ownerUserId) return "maker-seller";
    if (initialScenario) return initialScenario;
    return null;
  });

  const activeScenario: ArtistScenario =
    mode === "edit" ? editScenario : (createScenario ?? "historical");

  const watchedDisplay = useWatch({ control: form.control, name: "displayName" }) ?? "";
  const watchedKind =
    (useWatch({ control: form.control, name: "kind" }) as ArtistKind | undefined) ?? "artist";
  const watchedShortBio = useWatch({ control: form.control, name: "shortBio" }) ?? "";
  const watchedPortrait = useWatch({ control: form.control, name: "portraitUrl" }) ?? "";

  function applyScenarioChange(next: ArtistScenario) {
    setCreateScenario(next);
    if (next === "historical") {
      form.setValue("ownerUserId", null);
      const kind = form.getValues("kind");
      if (kind === "maker") {
        form.setValue("kind", SCENARIO_REGISTRY.historical.defaultKind);
      }
      return;
    }
    const currentKind = form.getValues("kind");
    if (currentKind === "artist" || currentKind === undefined) {
      form.setValue("kind", SCENARIO_REGISTRY["maker-seller"].defaultKind);
    }
  }

  const showFormBody = mode === "edit" || createScenario !== null;
  const showPreview = showFormBody;

  return (
    <>
      <FormDirtyGuard isDirty={form.formState.isDirty} />
      <Form {...form}>
        <form
          id={htmlFormId}
          className="space-y-8"
          onSubmit={form.handleSubmit((values) => {
            if (mode === "create" && createScenario === "maker-seller" && !values.ownerUserId) {
              notify.error("Link a platform user for a maker–seller profile.");
              return;
            }
            startTransition(async () => {
              const result =
                mode === "create"
                  ? await adminCreateArtistResultAction(values)
                  : artistId
                    ? await adminUpdateArtistResultAction(artistId, values)
                    : { ok: false as const, error: "Missing artist" };
              if (result.ok) {
                notify.success(mode === "create" ? "Artist created" : "Artist saved");
                if (mode === "edit" && artistId) {
                  router.push(`/admin/artists/${artistId}`);
                } else {
                  router.push("/admin/artists");
                }
                router.refresh();
                return;
              }
              if (result.fieldErrors) {
                applyActionFieldErrors(form, result.fieldErrors);
              }
              notify.error(result.error);
            });
          })}
        >
          {mode === "edit" ? <ArtistScenarioBadge scenario={editScenario} /> : null}

          {mode === "create" ? (
            <ScenarioSelector
              value={createScenario}
              onChange={applyScenarioChange}
              disabled={pending}
            />
          ) : null}

          {mode === "create" && createScenario === null ? (
            <p className="text-sm text-on-surface-variant">
              Choose a profile type above to continue. Fields stay tailored to catalogue-only vs
              linked maker–seller workflows.
            </p>
          ) : null}

          {showFormBody ? (
            <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
              <div className="min-w-0 space-y-6">
                {activeScenario === "maker-seller" ? (
                  <ArtistFormSection
                    title="Platform user"
                    description="Who this catalogue profile represents when they sell their own work."
                    defaultOpen
                  >
                    <UserLinkSection
                      control={form.control}
                      disabled={pending || readOnly}
                      emphasize
                    />
                  </ArtistFormSection>
                ) : null}

                <ArtistFormSection
                  title="Identity"
                  description="Public name, URL slug, and place."
                  defaultOpen
                >
                  <IdentitySection control={form.control} disabled={pending || readOnly} />
                </ArtistFormSection>

                <ArtistFormSection
                  title="Lifespan"
                  description="Optional years for biographical context."
                  defaultOpen={false}
                >
                  <LifespanSection control={form.control} disabled={pending || readOnly} />
                </ArtistFormSection>

                <ArtistFormSection
                  title="Biography"
                  description="Copy shown on the public artist profile."
                  defaultOpen
                >
                  <BiographySection control={form.control} disabled={pending || readOnly} />
                </ArtistFormSection>

                <ArtistFormSection
                  title="Media"
                  description="Portrait, hero, and website links."
                  defaultOpen={false}
                >
                  <MediaSection control={form.control} disabled={pending || readOnly} />
                </ArtistFormSection>

                <ArtistFormSection
                  title="Catalogue"
                  description="Taxonomy and lifecycle for the registry."
                  defaultOpen
                >
                  <CatalogueSection control={form.control} disabled={pending || readOnly} />
                </ArtistFormSection>

                {activeScenario === "historical" ? (
                  <ArtistFormSection
                    title="Optional user link"
                    description="Rarely needed for external profiles; use maker–seller path when the seller is the maker."
                    defaultOpen={false}
                  >
                    <UserLinkSection
                      control={form.control}
                      disabled={pending || readOnly}
                      emphasize={false}
                    />
                  </ArtistFormSection>
                ) : null}

                <ArtistFormSection
                  title="Visibility"
                  description="Featured, verified, and archive flags."
                  defaultOpen={false}
                >
                  <FlagsSection control={form.control} disabled={pending || readOnly} />
                </ArtistFormSection>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/admin/artists")}
                  >
                    Cancel
                  </Button>
                  <LoadingButton
                    type="submit"
                    loading={pending}
                    loadingLabel="Saving…"
                    disabled={readOnly}
                  >
                    {mode === "create" ? "Create artist" : "Save artist"}
                  </LoadingButton>
                </div>
              </div>

              {showPreview ? (
                <ArtistPreview
                  className="lg:sticky lg:top-4"
                  scenario={activeScenario}
                  data={{
                    displayName: String(watchedDisplay),
                    kindLabel: artistKindMeta(watchedKind).label,
                    shortBio: String(watchedShortBio ?? ""),
                    portraitUrl: String(watchedPortrait ?? ""),
                  }}
                />
              ) : null}
            </div>
          ) : null}
        </form>
      </Form>
    </>
  );
}
