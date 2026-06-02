"use client";

import {
  submitAbsenteeBidRequest,
  submitTelephoneBidRequest,
} from "@/app/(marketing)/lot/[slug]/[id]/onsite-participation-actions";
import { SITE_SUPPORT_EMAIL } from "@/lib/brand";
import { useActionForm } from "@/lib/forms/use-action-form";
import {
  type OnsiteParticipationContext,
  absenteeBidFormSchema,
  buildAbsenteeMailto,
  buildTelephoneMailto,
  telephoneBidFormSchema,
} from "@/lib/onsite/participation-request-input";
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
import { Textarea } from "@auction/ui/components/textarea";
import { Mail, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

type FormShellProps = {
  ctx: OnsiteParticipationContext;
  trigger: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  done: boolean;
  doneMessage: string;
};

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

const fieldClass = "font-body text-sm";

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
      ctx={ctx}
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

type TelephoneProps = {
  ctx: OnsiteParticipationContext;
  triggerClassName?: string;
};

export function OnsiteTelephoneBidForm({ ctx, triggerClassName }: TelephoneProps) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const { form, onSubmit, isSubmitting, rootError } = useActionForm({
    schema: telephoneBidFormSchema,
    defaultValues: {
      primaryPhone: "",
      backupPhone: "",
      name: "",
      email: "",
      phone: "",
      billingAddress: "",
      website: "",
    },
    action: (values) => submitTelephoneBidRequest(ctx, values),
    onSuccess: () => {
      setDone(true);
      const mailto = buildTelephoneMailto(ctx, form.getValues(), SITE_SUPPORT_EMAIL);
      window.location.href = mailto;
    },
  });

  return (
    <FormShell
      ctx={ctx}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setDone(false);
      }}
      done={done}
      doneMessage="Request received. If your email client did not open, use the mailto fallback below or contact support directly."
      title="Request telephone line"
      description="Register for a live telephone bidding line. A representative will call you before this lot opens."
      trigger={
        <Button size="sm" variant="outline" className={cn("w-full gap-1.5", triggerClassName)}>
          <Phone className="size-3.5" />
          Request Line
        </Button>
      }
    >
      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {rootError ? <p className="text-sm text-error">{rootError}</p> : null}
          <FormField
            control={form.control}
            name="primaryPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Primary phone</FormLabel>
                <FormControl>
                  <Input {...field} type="tel" className={fieldClass} autoComplete="tel" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="backupPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Backup phone (optional)</FormLabel>
                <FormControl>
                  <Input {...field} type="tel" className={fieldClass} autoComplete="tel" />
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
                <FormLabel>Contact phone</FormLabel>
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
              <a href={buildTelephoneMailto(ctx, form.getValues(), SITE_SUPPORT_EMAIL)}>
                Use email client instead
              </a>
            </Button>
          </div>
        </form>
      </Form>
    </FormShell>
  );
}
