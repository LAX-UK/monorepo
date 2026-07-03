"use client";

import type { ArtistSearchHit } from "@/components/artists/artist-search";
import { CreateArtistDialog } from "@/components/artists/create-artist-dialog";
import { RhfAsyncCombobox } from "@/components/ui/rhf-async-combobox";
import { LabelCaps } from "@/components/ui/typography";
import { searchAdminArtistsAction } from "@/lib/actions/admin-artists-search";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { artistKindMeta, artistStatusLabel } from "@/lib/artists/kind-presenter";
import { apiBaseUrl } from "@/lib/auth/api-base";
import { Button } from "@auction/ui/components/button";
import { Form, FormField, FormItem, FormMessage } from "@auction/ui/components/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type RefObject, useCallback, useState } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
import { type ApproveFormValues, approveFormSchema } from "./use-submission-decision-actions";

async function searchArtistHits(trimmed: string): Promise<ArtistSearchHit[]> {
  const result = await searchAdminArtistsAction(trimmed);
  if (!result.ok) throw new Error("search");
  return result.data ?? [];
}

async function resolveArtistHit(id: string): Promise<ArtistSearchHit | null> {
  const res = await fetch(`${apiBaseUrl()}/admin/artists/${encodeURIComponent(id)}`, {
    credentials: "include",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("resolve");
  const body = (await res.json()) as { data: unknown };
  const o = body.data as Record<string, unknown>;
  const rawKind = o.kind;
  const kind =
    rawKind === "artist" || rawKind === "maker" || rawKind === "brand" || rawKind === "marque"
      ? rawKind
      : "artist";
  const rawStatus = o.status;
  const status =
    rawStatus === "pending" ||
    rawStatus === "approved" ||
    rawStatus === "rejected" ||
    rawStatus === "merged_into"
      ? rawStatus
      : "approved";
  return {
    id: String(o.id ?? id),
    displayName: String(o.displayName ?? ""),
    slug: String(o.slug ?? ""),
    kind,
    status,
    matchedAlias: null,
    matchType: "exact",
    score: 0,
  };
}

type Props = {
  pending: boolean;
  formRef: RefObject<HTMLFormElement | null>;
  submitterDisplayName?: string | undefined;
  submitterUserId?: string | undefined;
  onSubmit: (values: ApproveFormValues, form: UseFormReturn<ApproveFormValues>) => void;
};

export function SubmissionConvertForm({
  pending,
  formRef,
  submitterDisplayName,
  submitterUserId,
  onSubmit,
}: Props) {
  const [createSeed, setCreateSeed] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(approveFormSchema),
    defaultValues: { reviewNotes: "", artistId: null },
  });

  const searchHits = useCallback(async (query: string) => searchArtistHits(query), []);
  const resolveHit = useCallback(async (id: string) => resolveArtistHit(id), []);

  return (
    <>
      <Form {...form}>
        <form
          id={CATALOG_FORM_IDS.submissionApprove}
          ref={formRef}
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => onSubmit(values, form))}
        >
          <div className="space-y-3 rounded-md border border-outline-variant/30 bg-surface-container-lowest/60 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <LabelCaps>Catalogue artist</LabelCaps>
              {submitterDisplayName ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCreateSeed(submitterDisplayName);
                    setCreateOpen(true);
                  }}
                  disabled={pending}
                  className="inline-flex h-auto min-h-0 items-center rounded-md border border-outline-variant/50 bg-surface-container-lowest px-2.5 py-1 font-label text-[11px] uppercase tracking-wide text-on-surface shadow-none transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Use submitter as artist
                </Button>
              ) : null}
            </div>
            <FormField
              control={form.control}
              name="artistId"
              render={({ field }) => (
                <FormItem>
                  <RhfAsyncCombobox<ArtistSearchHit>
                    value={field.value ?? null}
                    onChange={(id) => {
                      field.onChange(id ?? null);
                      setCreateSeed(null);
                    }}
                    onBlur={field.onBlur}
                    disabled={pending}
                    searchHits={searchHits}
                    resolveHit={resolveHit}
                    renderHit={(hit) => (
                      <span className="text-left font-body text-sm text-on-surface">
                        <span className="font-medium">{hit.displayName}</span>
                        <span className="mt-0.5 block font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
                          {artistKindMeta(hit.kind).badge} · /{hit.slug}
                        </span>
                      </span>
                    )}
                    renderSelected={(hit) => (
                      <div className="text-sm">
                        <p className="font-medium text-on-surface">{hit.displayName}</p>
                        <p className="mt-1 font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
                          {artistKindMeta(hit.kind).badge} · {artistStatusLabel(hit.status).label} ·
                          /{hit.slug}
                        </p>
                      </div>
                    )}
                    placeholder="Search by name, slug, alias…"
                    clearLabel="Clear artist"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={pending}>
            Convert to draft lot
          </Button>
        </form>
      </Form>

      <CreateArtistDialog
        open={createOpen}
        initialName={createSeed ?? ""}
        approveOnCreate
        {...(submitterUserId ? { ownerUserId: submitterUserId } : {})}
        onCreated={(a) => {
          setCreateOpen(false);
          setCreateSeed(null);
          form.setValue("artistId", a.id, { shouldDirty: true });
        }}
        onCancel={() => {
          setCreateOpen(false);
          setCreateSeed(null);
        }}
      />
    </>
  );
}
