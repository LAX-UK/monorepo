"use client";

import { updateBiddingPreferencesFromValuesAction } from "@/lib/actions/user-bidding-preferences";
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
import { Label } from "@auction/ui/components/label";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { type FieldPath, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const biddingFormSchema = z.object({
  outbidInApp: z.boolean(),
  outbidPush: z.boolean(),
  endingSoonPush: z.boolean(),
  defaultMaxBidAmount: z.string().max(32),
});

type BiddingFormValues = z.infer<typeof biddingFormSchema>;

type Prefs = {
  outbidInApp: boolean;
  outbidPush: boolean;
  endingSoonPush: boolean;
  defaultMaxBidAmount?: string | null;
};

export function BiddingPreferencesForm({ initial }: { initial: Prefs | null }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<BiddingFormValues>({
    resolver: zodResolver(biddingFormSchema),
    defaultValues: {
      outbidInApp: initial?.outbidInApp ?? true,
      outbidPush: initial?.outbidPush ?? true,
      endingSoonPush: initial?.endingSoonPush ?? false,
      defaultMaxBidAmount: initial?.defaultMaxBidAmount ?? "",
    },
  });

  return (
    <Form {...form}>
      <form
        className="space-y-8"
        onSubmit={form.handleSubmit((values) => {
          startTransition(async () => {
            const defaultMaxBidAmount =
              values.defaultMaxBidAmount?.trim() === ""
                ? null
                : (values.defaultMaxBidAmount?.trim() ?? null);
            const r = await updateBiddingPreferencesFromValuesAction({
              outbidInApp: values.outbidInApp,
              outbidPush: values.outbidPush,
              endingSoonPush: values.endingSoonPush,
              defaultMaxBidAmount: defaultMaxBidAmount ?? undefined,
            });
            if (r.ok) {
              toast.success("Preferences saved");
              router.replace("/dashboard/settings/bidding?saved=1");
              router.refresh();
              return;
            }
            if (r.fieldErrors) {
              for (const [key, msgs] of Object.entries(r.fieldErrors)) {
                if (msgs?.[0]) {
                  form.setError(key as FieldPath<BiddingFormValues>, { message: msgs[0] });
                }
              }
            } else {
              toast.error(r.error);
            }
          });
        })}
      >
        <div className="flex items-start justify-between gap-4 rounded-lg border border-outline-variant/15 p-4">
          <div className="min-w-0">
            <Label htmlFor="outbidInApp" className="text-on-surface">
              In-app outbid alerts
            </Label>
            <p className="text-xs text-on-surface-variant">Banner + inbox when you are outbid.</p>
          </div>
          <FormField
            control={form.control}
            name="outbidInApp"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-y-0">
                <FormControl>
                  <input
                    id="outbidInApp"
                    type="checkbox"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="mt-1 size-5 shrink-0 rounded border border-outline-variant text-primary focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        <div className="flex items-start justify-between gap-4 rounded-lg border border-outline-variant/15 p-4">
          <div className="min-w-0">
            <Label htmlFor="outbidPush" className="text-on-surface">
              Push outbid alerts
            </Label>
            <p className="text-xs text-on-surface-variant">
              Requires an enabled push subscription.
            </p>
          </div>
          <FormField
            control={form.control}
            name="outbidPush"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-y-0">
                <FormControl>
                  <input
                    id="outbidPush"
                    type="checkbox"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="mt-1 size-5 shrink-0 rounded border border-outline-variant text-primary focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        <div className="flex items-start justify-between gap-4 rounded-lg border border-outline-variant/15 p-4">
          <div className="min-w-0">
            <Label htmlFor="endingSoonPush" className="text-on-surface">
              Ending soon (push)
            </Label>
          </div>
          <FormField
            control={form.control}
            name="endingSoonPush"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-y-0">
                <FormControl>
                  <input
                    id="endingSoonPush"
                    type="checkbox"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="mt-1 size-5 shrink-0 rounded border border-outline-variant text-primary focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        <div className="space-y-2">
          <FormField
            control={form.control}
            name="defaultMaxBidAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default max bid (optional)</FormLabel>
                <FormControl>
                  <Input
                    id="defaultMaxBidAmount"
                    placeholder="e.g. 5000"
                    className="text-base md:text-sm"
                    {...field}
                  />
                </FormControl>
                <p className="text-xs text-on-surface-variant">
                  Hint for quick bid forms; server stores notification prefs only today.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={pending}>
          {pending ? "Saving…" : "Save preferences"}
        </Button>
      </form>
    </Form>
  );
}
