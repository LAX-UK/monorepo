"use client";

import { UserPicker } from "@/components/admin/user-picker";
import { UnderlineInput } from "@/components/ui/input";
import { LabelCaps } from "@/components/ui/typography";
import { adminCreateArtistResultAction, adminUpdateArtistResultAction } from "@/lib/actions/admin";
import { ARTIST_KIND_OPTIONS, artistKindMeta } from "@/lib/artists/kind-presenter";
import { notify } from "@/lib/ui/notify";
import type { ArtistKind, ArtistStatus } from "@auction/types";
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
import { Textarea } from "@auction/ui/components/textarea";
import { adminCreateArtistBodySchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useController, useForm } from "react-hook-form";
import type { z } from "zod";

const ARTIST_STATUS_OPTIONS: ReadonlyArray<{ value: ArtistStatus; label: string }> = [
  { value: "approved", label: "Approved (visible to public)" },
  { value: "pending", label: "Pending review" },
  { value: "rejected", label: "Rejected (hidden)" },
];

type ArtistFormValues = z.infer<typeof adminCreateArtistBodySchema>;

type Props = {
  mode: "create" | "edit";
  artistId?: string;
  defaultValues: ArtistFormValues;
};

export function AdminArtistForm({ mode, artistId, defaultValues }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<ArtistFormValues>({
    resolver: zodResolver(adminCreateArtistBodySchema),
    defaultValues,
  });

  return (
    <Form {...form}>
      <form
        className="space-y-6"
        onSubmit={form.handleSubmit((values) => {
          startTransition(async () => {
            const result =
              mode === "create"
                ? await adminCreateArtistResultAction(values)
                : artistId
                  ? await adminUpdateArtistResultAction(artistId, values)
                  : { ok: false as const, error: "Missing artist" };
            if (result.ok) {
              notify.success(mode === "create" ? "Artist created" : "Artist saved");
              router.push("/admin/artists");
              router.refresh();
              return;
            }
            notify.error(result.error);
          });
        })}
      >
        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <LabelCaps>Display name</LabelCaps>
              </FormLabel>
              <FormControl>
                <UnderlineInput placeholder="Artist name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Slug</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UnderlineInput
                    placeholder="Auto-generated"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ownerUserId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Linked client (optional)</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UserPicker
                    value={field.value ?? null}
                    onChange={(id) => field.onChange(id)}
                    disabled={pending}
                  />
                </FormControl>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Only used in Flow B (the seller is also the maker). The link does not grant the
                  client edit access — admins remain the sole writer.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="kind"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Kind</LabelCaps>
                </FormLabel>
                <FormControl>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Artist kind">
                    {ARTIST_KIND_OPTIONS.map((opt) => {
                      const active = (field.value ?? "artist") === opt.value;
                      return (
                        <button
                          key={opt.value}
                          // biome-ignore lint/a11y/useSemanticElements: pill segmented control; native radios break layout
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => field.onChange(opt.value as ArtistKind)}
                          className={`rounded-full border px-3 py-1 font-label text-[11px] uppercase tracking-wide transition-colors ${
                            active
                              ? "border-primary bg-primary text-on-primary"
                              : "border-outline-variant/60 bg-surface-container-lowest text-on-surface-variant hover:border-primary/50"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </FormControl>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {artistKindMeta((field.value as ArtistKind | undefined) ?? "artist").description}
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Status</LabelCaps>
                </FormLabel>
                <FormControl>
                  <select
                    value={field.value ?? "approved"}
                    onChange={(event) => field.onChange(event.target.value as ArtistStatus)}
                    onBlur={field.onBlur}
                    className="min-h-11 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface"
                  >
                    {ARTIST_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Approved artists appear in the public directory. Pending hides them and flags any
                  attached lots for review.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <TextField name="portraitUrl" label="Portrait URL" form={form} />
          <TextField name="websiteUrl" label="Website URL" form={form} />
          <TextField name="nationality" label="Nationality" form={form} />
          <TextField name="location" label="Location" form={form} />
          <TextField name="birthYear" label="Birth year" form={form} />
          <TextField name="deathYear" label="Death year" form={form} />
        </div>
        <TextareaField name="shortBio" label="Short bio" form={form} rows={3} />
        <TextareaField name="longBio" label="Long bio" form={form} rows={6} />
        <TextareaField name="statement" label="Artist statement" form={form} rows={6} />
        <div className="grid gap-3 sm:grid-cols-3">
          <FlagCheckbox name="featured" control={form.control} />
          <FlagCheckbox name="verified" control={form.control} />
          <FlagCheckbox name="archived" control={form.control} />
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.push("/admin/artists")}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : mode === "create" ? "Create artist" : "Save artist"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

/** Boolean flag checkbox bound directly via `useController` so optional
 * `boolean | undefined` Zod fields don't trip over the FormField inference
 * helper (it can't always narrow `TFieldValues` from a literal `name` on
 * optional booleans). */
function FlagCheckbox({
  name,
  control,
}: {
  name: "featured" | "verified" | "archived";
  control: ReturnType<typeof useForm<ArtistFormValues>>["control"];
}) {
  const { field } = useController({ name, control });
  return (
    <FormItem className="flex items-center gap-2">
      <FormControl>
        <Checkbox
          checked={field.value === true}
          onCheckedChange={(checked) => field.onChange(checked === true)}
        />
      </FormControl>
      <FormLabel className="capitalize">{name}</FormLabel>
    </FormItem>
  );
}

function TextField({
  form,
  name,
  label,
}: {
  form: ReturnType<typeof useForm<ArtistFormValues>>;
  name: keyof ArtistFormValues;
  label: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            <LabelCaps>{label}</LabelCaps>
          </FormLabel>
          <FormControl>
            <UnderlineInput {...field} value={String(field.value ?? "")} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function TextareaField({
  form,
  name,
  label,
  rows,
}: {
  form: ReturnType<typeof useForm<ArtistFormValues>>;
  name: keyof ArtistFormValues;
  label: string;
  rows: number;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            <LabelCaps>{label}</LabelCaps>
          </FormLabel>
          <FormControl>
            <Textarea {...field} value={String(field.value ?? "")} rows={rows} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
