"use client";

import { createTelephoneBooking } from "@/lib/telephone/telephone-booking-api";
import type { TelephoneBookingSnapshot } from "@/lib/telephone/telephone-booking-types";
import { TelephoneParticipationGate } from "@/lib/telephone/telephone-participation-gate";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { Textarea } from "@auction/ui/components/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  buyerLegalEntityId: z.string().uuid("Select a buyer profile"),
  authorizedMax: z.string().optional(),
  buyerNotes: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof schema>;

type Entity = {
  id: string;
  displayName: string;
  memberRole: string;
};

type Props = {
  saleId: string;
  saleTitle: string;
  loginNextPath: string;
  isAuthenticated: boolean;
  kycApproved: boolean;
  mobile: string | null;
  phoneNumberVerified?: boolean;
  mobileDisplay?: string | null;
  buyerEntities: Entity[];
  existingBooking?: TelephoneBookingSnapshot | null;
  orgModuleEnabled?: boolean;
};

export type SaleTelephoneBookingPanelProps = Props;

export function SaleTelephoneBookingPanel({
  saleId,
  saleTitle,
  loginNextPath,
  isAuthenticated,
  kycApproved,
  mobile,
  phoneNumberVerified = false,
  mobileDisplay,
  buyerEntities,
  existingBooking = null,
  orgModuleEnabled = true,
}: Props) {
  const [done, setDone] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);
  const [rootError, setRootError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const eligibleEntities = buyerEntities;
  const defaultEntity =
    eligibleEntities.find((e) => e.memberRole === "individual") ?? eligibleEntities[0];

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      buyerLegalEntityId: defaultEntity?.id ?? "",
      authorizedMax: "",
      buyerNotes: "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setRootError(null);
    startTransition(async () => {
      const authorizedRaw = values.authorizedMax?.trim();
      const authorizedMax =
        authorizedRaw && authorizedRaw.length > 0 ? Number.parseFloat(authorizedRaw) : undefined;
      if (authorizedRaw && (!Number.isFinite(authorizedMax) || (authorizedMax ?? 0) <= 0)) {
        form.setError("authorizedMax", { message: "Enter a valid amount" });
        return;
      }
      const result = await createTelephoneBooking({
        saleId,
        buyerLegalEntityId: values.buyerLegalEntityId,
        ...(authorizedMax != null ? { authorizedMax } : {}),
        ...(values.buyerNotes?.trim() ? { buyerNotes: values.buyerNotes.trim() } : {}),
      });
      if (!result.ok) {
        setRootError(result.message);
        return;
      }
      setCreatedBookingId(result.booking.id);
      setDone(true);
    });
  });

  if (done) {
    return (
      <div className="space-y-3 rounded-xl border border-outline-variant/35 bg-surface-container-lowest p-6 dark:bg-surface-container-low/40">
        <p className="font-body text-sm text-on-surface">
          Telephone line requested for {saleTitle}. Our team will confirm before your lots open.
        </p>
        {createdBookingId ? (
          <Button size="sm" variant="outline" asChild>
            <Link href={`/dashboard/telephone-bids/${createdBookingId}`}>View booking</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      id="bid-onsite-hub"
      className="scroll-mt-[calc(var(--header-height)+3.5rem)] space-y-4 rounded-xl border border-outline-variant/35 bg-surface-container-lowest p-6 dark:bg-surface-container-low/40"
    >
      <div className="space-y-1">
        <h4 className="font-headline text-base font-semibold text-on-surface">Telephone bidding</h4>
        <p className="font-body text-xs text-on-surface-variant leading-relaxed">
          Request a live telephone line for this sale. Staff will call the mobile number on your
          profile when your lot is approaching the block.
        </p>
      </div>
      <TelephoneParticipationGate
        isAuthenticated={isAuthenticated}
        kycApproved={kycApproved}
        mobile={mobile}
        phoneNumberVerified={phoneNumberVerified}
        {...(mobileDisplay ? { mobileDisplay } : {})}
        buyerEntities={buyerEntities}
        loginNextPath={loginNextPath}
        orgModuleEnabled={orgModuleEnabled}
        existingBooking={existingBooking}
      >
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {rootError ? <p className="text-sm text-error">{rootError}</p> : null}
            <FormField
              control={form.control}
              name="buyerLegalEntityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Buyer profile</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select profile" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {eligibleEntities.map((entity) => (
                        <SelectItem key={entity.id} value={entity.id}>
                          {entity.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="authorizedMax"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Authorized maximum (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. £5,000" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="buyerNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes for the clerk (optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <p className="font-body text-xs text-on-surface-variant">
              We will call {mobileDisplay ?? mobile} when your lot is approaching the block.
            </p>
            <Button type="submit" disabled={pending}>
              {pending ? "Submitting…" : "Request telephone line"}
            </Button>
          </form>
        </Form>
      </TelephoneParticipationGate>
    </div>
  );
}
