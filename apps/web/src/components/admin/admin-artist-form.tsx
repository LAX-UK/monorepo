"use client";

import { UnderlineInput } from "@/components/ui/input";
import { LabelCaps } from "@/components/ui/typography";
import { adminCreateArtistResultAction, adminUpdateArtistResultAction } from "@/lib/actions/admin";
import type { AdminUserRow } from "@/lib/data/http/admin.server";
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
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

type ArtistFormValues = z.infer<typeof adminCreateArtistBodySchema>;

type Props = {
  mode: "create" | "edit";
  artistId?: string;
  users: AdminUserRow[];
  defaultValues: ArtistFormValues;
};

export function AdminArtistForm({ mode, artistId, users, defaultValues }: Props) {
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
              toast.success(mode === "create" ? "Artist created" : "Artist saved");
              router.push("/admin/artists");
              router.refresh();
              return;
            }
            toast.error(result.error);
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
                  <LabelCaps>Linked client</LabelCaps>
                </FormLabel>
                <FormControl>
                  <select
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(event.target.value || null)}
                    onBlur={field.onBlur}
                    className="min-h-11 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface"
                  >
                    <option value="">Unclaimed / unlinked</option>
                    {users
                      .filter((user) => user.role === "client")
                      .map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} · {user.email}
                        </option>
                      ))}
                  </select>
                </FormControl>
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
          {(["featured", "verified", "archived"] as const).map((name) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value === true}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                  </FormControl>
                  <FormLabel className="capitalize">{name}</FormLabel>
                </FormItem>
              )}
            />
          ))}
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
