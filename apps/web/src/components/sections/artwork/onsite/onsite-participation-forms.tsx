"use client";

import { submitAbsenteeBidRequest } from "@/app/(marketing)/lot/[slug]/[id]/onsite-participation-actions";
import { SITE_SUPPORT_EMAIL } from "@/lib/brand";
import { useActionForm } from "@/lib/forms/use-action-form";
import {
  type OnsiteParticipationContext,
  absenteeBidFormSchema,
  buildAbsenteeMailto,
} from "@/lib/onsite/participation-request-input";
import { createTelephoneBooking } from "@/lib/telephone/telephone-booking-api";
import type { TelephoneBookingSnapshot } from "@/lib/telephone/telephone-booking-types";
import { TelephoneParticipationGate } from "@/lib/telephone/telephone-participation-gate";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@auction/ui/components/dialog";
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
import { Mail, Phone } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const fieldClass = "font-body text-sm";

const telephoneBookingFormSchema = z.object({
  buyerLegalEntityId: z.string().uuid("Select a buyer profile"),
  authorizedMax: z.string().optional(),
  buyerNotes: z.string().max(2000).optional(),
});

type TelephoneBookingFormValues = z.infer<typeof telephoneBookingFormSchema>;

type Entity = {
  id: string;
  displayName: string;
  memberRole: string;
};

type FormShellProps = {
  trigger: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  done: boolean;
  doneMessage: ReactNode;
};

type AbsenteeProps = {
  ctx: OnsiteParticipationContext;
  triggerClassName?: string;
};

export function OnsiteAbsenteeBidForm({ ctx, triggerClassName }: AbsenteeProps) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const { form, onSubmit, isSubmitting, rootError } = useActionForm({
    schema: absenteeBidFormSchema,
    defaultValues: {
      maxHammerBid: "",
      name: "",
      email: "",
      phone: "",
      billingAddress: "",
      website: "",
    },
    action: (values) => submitAbsenteeBidRequest(ctx, values),
    onSuccess: () => {
      setDone(true);
      const mailto = buildAbsenteeMailto(ctx, form.getValues(), SITE_SUPPORT_EMAIL);
      window.location.href = mailto;
    },
  });

  return (
    <FormShell
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setDone(false);
      }}
      done={done}
      doneMessage="Request received. If your email client did not open, use the mailto fallback below or contact support directly."
      title="Submit absentee bid"
      description="Set a confidential maximum hammer price. Our team will confirm receipt and execute bids on your behalf in the saleroom."
      trigger={
        <Button size="sm" className={cn("w-full gap-1.5", triggerClassName)}>
          <Mail className="size-3.5" />
          Submit Bid Form
        </Button>
      }
    >
      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {rootError ? <p className="text-sm text-error">{rootError}</p> : null}
          <FormField
            control={form.control}
            name="maxHammerBid"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Maximum hammer bid</FormLabel>
                <FormControl>
                  <Input {...field} className={fieldClass} placeholder="e.g. £5,000" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <Input {...field} className={fieldClass} autoComplete="name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input {...field} type="email" className={fieldClass} autoComplete="email" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input {...field} type="tel" className={fieldClass} autoComplete="tel" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="billingAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Billing address</FormLabel>
                <FormControl>
                  <Textarea {...field} className={fieldClass} rows={3} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <input
            type="text"
            {...form.register("website")}
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
          />
          <div className="flex flex-col gap-2 pt-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting…" : "Submit request"}
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={buildAbsenteeMailto(ctx, form.getValues(), SITE_SUPPORT_EMAIL)}>
                Use email client instead
              </a>
            </Button>
          </div>
        </form>
      </Form>
    </FormShell>
  );
}

function FormShell({
  trigger,
  title,
  description,
  children,
  open,
  onOpenChange,
  done,
  doneMessage,
}: FormShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {done ? (
          <output
            className="rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-5 text-sm text-on-surface"
            aria-live="polite"
          >
            {doneMessage}
          </output>
        ) : (
          children
        )}
      </DialogContent>
    </Dialog>
  );
}

type TelephoneProps = {
  ctx: OnsiteParticipationContext;
  saleId: string;
  lotId: string;
  loginNextPath: string;
  isAuthenticated: boolean;
  kycApproved: boolean;
  mobile: string | null;
  mobileDisplay?: string | null;
  buyerEntities: Entity[];
  existingBooking?: TelephoneBookingSnapshot | null;
  orgModuleEnabled?: boolean;
  triggerClassName?: string;
};

export function OnsiteTelephoneBidForm({
  ctx,
  saleId,
  lotId,
  loginNextPath,
  isAuthenticated,
  kycApproved,
  mobile,
  mobileDisplay,
  buyerEntities,
  existingBooking = null,
  orgModuleEnabled = true,
  triggerClassName,
}: TelephoneProps) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);
  const [rootError, setRootError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const eligibleEntities = buyerEntities;
  const defaultEntity =
    eligibleEntities.find((e) => e.memberRole === "individual") ?? eligibleEntities[0];

  const form = useForm<TelephoneBookingFormValues>({
    resolver: zodResolver(telephoneBookingFormSchema),
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
        lotIds: [lotId],
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

  return (
    <FormShell
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setDone(false);
          setCreatedBookingId(null);
          setRootError(null);
        }
      }}
      done={done}
      doneMessage={
        <div className="space-y-3">
          <p>
            Telephone line requested for {ctx.saleTitle}
            {ctx.lotNumber != null ? ` · Lot ${ctx.lotNumber}` : ""}. Our team will confirm before
            your lot opens.
          </p>
          {createdBookingId ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/dashboard/telephone-bids/${createdBookingId}`}>View booking</Link>
            </Button>
          ) : null}
        </div>
      }
      title="Request telephone line"
      description="Register for a live telephone bidding line. A representative will call you before this lot opens."
      trigger={
        <Button size="sm" variant="outline" className={cn("w-full gap-1.5", triggerClassName)}>
          <Phone className="size-3.5" />
          Request Line
        </Button>
      }
    >
      <TelephoneParticipationGate
        isAuthenticated={isAuthenticated}
        kycApproved={kycApproved}
        mobile={mobile}
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
                      <SelectTrigger className={fieldClass}>
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
                    <Input {...field} className={fieldClass} placeholder="e.g. £5,000" />
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
                    <Textarea {...field} className={fieldClass} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <p className="font-body text-xs text-on-surface-variant">
              We will call {mobileDisplay ?? mobile} when your lot is approaching the block.
            </p>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Submitting…" : "Submit request"}
            </Button>
          </form>
        </Form>
      </TelephoneParticipationGate>
    </FormShell>
  );
}
