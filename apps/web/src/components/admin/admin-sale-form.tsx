"use client";

import { UnderlineInput } from "@/components/ui/input";
import { LabelCaps } from "@/components/ui/typography";
import { Textarea } from "@auction/ui/components/textarea";
import {
  adminCreateSaleResultAction,
  adminUpdateSaleResultAction,
} from "@/lib/actions/admin-sales";
import {
  type AdminSaleFormValues,
  adminSaleFormValuesSchema,
  safeParseCreateSaleFromForm,
  safeParseUpdateSaleFromForm,
} from "@/lib/forms/schemas/admin-sale-form";
import { saleDeliveryModes } from "@auction/types";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { toast } from "sonner";

type Props = {
  mode: "create" | "edit";
  saleId?: string;
  defaultValues: AdminSaleFormValues;
};

function applyZodErrorsToForm(
  form: ReturnType<typeof useForm<AdminSaleFormValues>>,
  path: (string | number)[],
  message: string,
): void {
  if (!path.length) {
    form.setError("root", { message });
    return;
  }
  form.setError(path.map(String).join(".") as FieldPath<AdminSaleFormValues>, { message });
}

export function AdminSaleForm({ mode, saleId, defaultValues }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<AdminSaleFormValues>({
    resolver: zodResolver(adminSaleFormValuesSchema),
    defaultValues,
  });

  return (
    <Form {...form}>
      <form
        className="space-y-8"
        onSubmit={form.handleSubmit((values) => {
          startTransition(async () => {
            form.clearErrors("root");
            if (mode === "create") {
              const api = safeParseCreateSaleFromForm(values);
              if (!api.success) {
                for (const iss of api.error.issues) {
                  applyZodErrorsToForm(form, iss.path, iss.message);
                }
                toast.error("Check the form for errors");
                return;
              }
              const r = await adminCreateSaleResultAction(api.data);
              if (r.ok) {
                toast.success("Draft sale created");
                if (r.data?.id) router.push(`/admin/sales/${r.data.id}`);
                return;
              }
              toast.error(r.error);
              return;
            }
            if (!saleId) {
              toast.error("Missing sale");
              return;
            }
            const api = safeParseUpdateSaleFromForm(values);
            if (!api.success) {
              for (const iss of api.error.issues) {
                applyZodErrorsToForm(form, iss.path, iss.message);
              }
              toast.error("Check the form for errors");
              return;
            }
            const r = await adminUpdateSaleResultAction(saleId, api.data);
            if (r.ok) {
              toast.success("Saved");
              router.push(`/admin/sales/${saleId}`);
              return;
            }
            toast.error(r.error);
          });
        })}
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-2 block">
                <LabelCaps>Title</LabelCaps>
              </FormLabel>
              <FormControl>
                <UnderlineInput placeholder="Sale title" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-2 block">
                <LabelCaps>Description</LabelCaps>
              </FormLabel>
              <FormControl>
                <Textarea id="description" rows={4} className="font-body text-sm" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="coverImages"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-2 block">
                <LabelCaps>Cover image URLs (one per line)</LabelCaps>
              </FormLabel>
              <FormControl>
                <Textarea
                  id="coverImages"
                  rows={3}
                  className="font-body text-sm"
                  placeholder="https://..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-2 block">
                <LabelCaps>Theme category ID (optional UUID)</LabelCaps>
              </FormLabel>
              <FormControl>
                <UnderlineInput id="categoryId" placeholder="" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="deliveryMode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <LabelCaps>Saleroom delivery</LabelCaps>
              </FormLabel>
              <FormControl>
                <select
                  className="w-full rounded-md border border-outline-variant/25 bg-surface-container-lowest px-3 py-3 font-body text-sm"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                >
                  {saleDeliveryModes.map((m) => (
                    <option key={m} value={m}>
                      {m === "onsite" ? "Onsite only" : m === "online" ? "Online only" : "Online + onsite (hybrid)"}
                    </option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="streamUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-2 block">
                <LabelCaps>Stream URL (optional)</LabelCaps>
              </FormLabel>
              <FormControl>
                <UnderlineInput
                  id="streamUrl"
                  placeholder="https://www.youtube.com/watch?v=…"
                  {...field}
                />
              </FormControl>
              <p className="mt-2 font-body text-xs text-on-surface-variant">
                Allowed: YouTube, Vimeo, Twitch, Cloudflare Stream. Leave empty for onsite-only.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="startTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Start (local)</LabelCaps>
                </FormLabel>
                <FormControl>
                  <input
                    type="datetime-local"
                    className="w-full rounded-md border border-outline-variant/25 bg-surface-container-lowest px-3 py-3 font-body text-sm"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>End (local)</LabelCaps>
                </FormLabel>
                <FormControl>
                  <input
                    type="datetime-local"
                    className="w-full rounded-md border border-outline-variant/25 bg-surface-container-lowest px-3 py-3 font-body text-sm"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="previewStartTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <LabelCaps>Preview start (optional)</LabelCaps>
              </FormLabel>
              <FormControl>
                <input
                  type="datetime-local"
                  className="w-full rounded-md border border-outline-variant/25 bg-surface-container-lowest px-3 py-3 font-body text-sm"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="buyerPremiumRate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <LabelCaps>Buyer premium (0–1)</LabelCaps>
              </FormLabel>
              <FormControl>
                <UnderlineInput id="buyerPremiumRate" placeholder="0.25" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="terms"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-2 block">
                <LabelCaps>Terms of sale</LabelCaps>
              </FormLabel>
              <FormControl>
                <Textarea id="terms" rows={4} className="font-body text-sm" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.formState.errors.root ? (
          <p className="text-sm text-error" role="alert">
            {form.formState.errors.root.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-gradient-to-br from-primary to-primary-container py-4 font-label text-xs font-bold uppercase tracking-[0.3em] text-on-primary shadow-md hover:opacity-95 disabled:opacity-60"
        >
          {pending
            ? "Saving…"
            : mode === "create"
              ? "Create draft sale"
              : "Save"}
        </button>
      </form>
    </Form>
  );
}
