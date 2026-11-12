"use client";

import { createTelephoneBooking } from "@/lib/telephone/telephone-booking-api";
import type { TelephoneBookingSnapshot } from "@/lib/telephone/telephone-booking-types";
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
import { Button } from "@auction/ui/lax/button";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  buyerLegalEntityId: z.string().uuid("Select a buyer profile"),
  authorizedMax: z.string().optional(),
  buyerNotes: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof schema>;

export type TelephoneBookingFormEntity = {
  id: string;
  displayName: string;
  memberRole: string;
};

export type SaleTelephoneBookingFormProps = {
  saleId: string;
  buyerEntities: TelephoneBookingFormEntity[];
  /** The number staff will call, as shown to the bidder. */
  contactNumber: string | null;
  onBooked: (booking: TelephoneBookingSnapshot) => void;
};

/**
 * The telephone line request form. It is its own download (react-hook-form, the form controls and
 * the validation schema): only an eligible bidder reaches it, as the section nears the screen.
 */
export function SaleTelephoneBookingForm({
  saleId,
  buyerEntities,
  contactNumber,
  onBooked,
}: SaleTelephoneBookingFormProps) {
  const [rootError, setRootError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const defaultEntity =
    buyerEntities.find((e) => e.memberRole === "individual") ?? buyerEntities[0];

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
      onBooked(result.booking);
    });
  });

  return (
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
                  {buyerEntities.map((entity) => (
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
              <FormLabel>Authorised maximum (optional)</FormLabel>
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
          We will call {contactNumber} when your lot is approaching the block.
        </p>
        <Button variant="primary" type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Request telephone line"}
        </Button>
      </form>
    </Form>
  );
}
