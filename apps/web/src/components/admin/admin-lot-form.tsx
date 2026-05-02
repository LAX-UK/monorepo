"use client";

import { UploadField } from "@/components/forms/upload-field";
import { UnderlineInput } from "@/components/ui/input";
import { RhfSelect } from "@/components/ui/rhf-select";
import { LabelCaps } from "@/components/ui/typography";
import { adminCreateLotResultAction, adminUpdateLotResultAction } from "@/lib/actions/admin";
import {
  type AdminLotFormValues,
  adminLotFormValuesSchema,
  safeParseCreateLotFromForm,
  safeParseUpdateLotFromForm,
} from "@/lib/forms/schemas/admin-lot-form";
import { lotAuctionTypes } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import { Textarea } from "@auction/ui/components/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { type FieldPath, useForm } from "react-hook-form";
import { toast } from "sonner";

type Props = {
  mode: "create" | "edit";
  lotId?: string;
  defaultValues: AdminLotFormValues;
};

function applyZodErrorsToForm(
  form: ReturnType<typeof useForm<AdminLotFormValues>>,
  path: (string | number)[],
  message: string,
): void {
  const key = path.length ? path.map(String).join(".") : "root";
  if (key === "root" || !path.length) {
    form.setError("root", { message });
    return;
  }
  form.setError(key as FieldPath<AdminLotFormValues>, { message });
}

export function AdminLotForm({ mode, lotId, defaultValues }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<AdminLotFormValues>({
    resolver: zodResolver(adminLotFormValuesSchema),
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
              const api = safeParseCreateLotFromForm(values);
              if (!api.success) {
                for (const iss of api.error.issues) {
                  applyZodErrorsToForm(form, iss.path, iss.message);
                }
                toast.error("Check the form for errors");
                return;
              }
              const r = await adminCreateLotResultAction(api.data);
              if (r.ok) {
                toast.success("Draft created");
                router.push(`/admin/lots/${r.data?.id}`);
                return;
              }
              toast.error(r.error);
              return;
            }
            if (!lotId) {
              toast.error("Missing lot");
              return;
            }
            const api = safeParseUpdateLotFromForm(values);
            if (!api.success) {
              for (const iss of api.error.issues) {
                applyZodErrorsToForm(form, iss.path, iss.message);
              }
              toast.error("Check the form for errors");
              return;
            }
            const r = await adminUpdateLotResultAction(lotId, api.data);
            if (r.ok) {
              toast.success("Saved");
              router.push(`/admin/lots/${lotId}`);
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
                <UnderlineInput placeholder="Lot title" {...field} />
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
              <FormLabel htmlFor="description" className="mb-2 block">
                <LabelCaps>Description</LabelCaps>
              </FormLabel>
              <FormControl>
                <Textarea id="description" rows={5} className="font-body text-sm" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="auctionType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <LabelCaps>Lot type</LabelCaps>
              </FormLabel>
              <RhfSelect
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                options={lotAuctionTypes.map((t) => ({ value: t, label: t }))}
                triggerClassName="w-full font-body text-sm"
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="startingPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Starting price</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UnderlineInput placeholder="0.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="reservePrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Reserve (optional)</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UnderlineInput placeholder="0.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="buyNowPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Buy now (optional)</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UnderlineInput placeholder="0.00" {...field} />
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
                  <UnderlineInput placeholder="0.25" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="minBidIncrement"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Min bid increment</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UnderlineInput placeholder="1.00" {...field} />
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
                <FormLabel>
                  <LabelCaps>Category ID (UUID)</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UnderlineInput placeholder="Category UUID" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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
                  <Input
                    type="datetime-local"
                    className="min-h-11 py-3 font-body text-sm"
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
                  <Input
                    type="datetime-local"
                    className="min-h-11 py-3 font-body text-sm"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="medium"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Medium (optional)</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UnderlineInput {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dimensions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Dimensions (optional)</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UnderlineInput {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="dutchDecrementAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Dutch decrement (optional)</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UnderlineInput {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dutchDecrementIntervalMs"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Dutch interval ms (optional)</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UnderlineInput placeholder="60000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="images"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-2 block">
                <LabelCaps>Lot images</LabelCaps>
              </FormLabel>
              <FormControl>
                <UploadField
                  kind="lot_image"
                  multiple
                  maxFiles={20}
                  value={field.value}
                  onChange={field.onChange}
                />
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

        <Button
          type="submit"
          disabled={pending}
          className="h-auto w-full rounded-md bg-gradient-to-br from-primary to-primary-container py-4 font-label text-xs font-bold uppercase tracking-[0.3em] text-on-primary shadow-md hover:opacity-95 disabled:opacity-60"
        >
          {pending ? "Saving…" : mode === "create" ? "Create draft" : "Save changes"}
        </Button>
      </form>
    </Form>
  );
}
