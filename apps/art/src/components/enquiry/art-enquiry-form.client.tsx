"use client";

import {
  ENQUIRY_EMAIL_MAX_LENGTH,
  ENQUIRY_NAME_MAX_LENGTH,
  ENQUIRY_PHONE_MAX_LENGTH,
  type EnquiryFieldErrors,
  type EnquiryFormField,
  validateEnquiryContact,
  validateEnquiryEmail,
} from "@/lib/enquiry/enquiry-form.validator";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { Textarea } from "@auction/ui/components/textarea";
import Link from "next/link";
import {
  type ComponentProps,
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useState,
} from "react";

export type ArtEnquiryFormContact = { name: string; email: string; phone: string };

type Props = {
  /** `useActionState` dispatcher; the form posts to it once the client checks pass. */
  action: (formData: FormData) => void;
  pending: boolean;
  /** Prefill for signed-in visitors; everything stays editable. */
  contact: ArtEnquiryFormContact;
  /** Field errors returned by the server action. */
  serverErrors: EnquiryFieldErrors;
  messageRequired: boolean;
  messageMaxLength: number;
  /** Rendered above the contact fields (the general enquiry's Topic select). */
  leading?: ReactNode;
  /** Form-level notice (send failures); rendered above the button. */
  notice?: ReactNode;
};

const FIELD_ORDER: readonly EnquiryFormField[] = ["name", "email", "contactPhone", "message"];

const LABEL_CLASS = "text-sm font-normal leading-5 text-on-surface-variant";

type FieldProps = {
  id: string;
  label: string;
  error: string | undefined;
};

function withField(
  errors: EnquiryFieldErrors,
  field: EnquiryFormField,
  message: string | undefined,
): EnquiryFieldErrors {
  const { [field]: _removed, ...rest } = errors;
  return message ? { ...rest, [field]: message } : rest;
}

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-error">
      {message}
    </p>
  );
}

function fieldA11y(id: string, error: string | undefined) {
  return {
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  };
}

function TextField({
  id,
  label,
  error,
  ...input
}: FieldProps & Omit<ComponentProps<typeof Input>, "id" | "variant">) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </Label>
      <Input
        id={id}
        variant="underline"
        className="min-h-11"
        {...fieldA11y(id, error)}
        {...input}
      />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/**
 * Contact fields and message shared by the artwork and general enquiry sheets (Figma 531:8496,
 * 614:12257). Email is checked on blur and on submit, the first invalid field takes focus, and
 * the form posts to the server action only when the client checks pass; the server repeats them.
 */
export function ArtEnquiryForm({
  action,
  pending,
  contact,
  serverErrors,
  messageRequired,
  messageMaxLength,
  leading,
  notice,
}: Props) {
  const formId = useId();
  const [name, setName] = useState(contact.name);
  const [email, setEmail] = useState(contact.email);
  const [phone, setPhone] = useState(contact.phone);
  const [message, setMessage] = useState("");
  const [clientErrors, setClientErrors] = useState<EnquiryFieldErrors>({});
  const errors = { ...serverErrors, ...clientErrors };

  const fieldId = (field: EnquiryFormField) => `${formId}-${field}`;

  const focusFirstInvalid = (found: EnquiryFieldErrors) => {
    const first = FIELD_ORDER.find((field) => found[field]);
    if (first) document.getElementById(fieldId(first))?.focus();
  };

  // A rejected server response lands after the client checks passed, so move focus here too.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per server response
  useEffect(() => {
    focusFirstInvalid(serverErrors);
  }, [serverErrors]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const found = validateEnquiryContact({ name, email });
    if (messageRequired && !message.trim()) found.message = "Enter a message.";
    setClientErrors(found);
    if (Object.keys(found).length > 0) {
      event.preventDefault();
      focusFirstInvalid(found);
    }
  };

  const clear = (field: EnquiryFormField) => {
    setClientErrors((current) => withField(current, field, undefined));
  };

  return (
    <form action={action} onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {leading}
      <TextField
        id={fieldId("name")}
        label="Name"
        name="name"
        autoComplete="name"
        maxLength={ENQUIRY_NAME_MAX_LENGTH}
        value={name}
        error={errors.name}
        onChange={(event) => {
          setName(event.target.value);
          clear("name");
        }}
      />
      <TextField
        id={fieldId("email")}
        label="Email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        maxLength={ENQUIRY_EMAIL_MAX_LENGTH}
        value={email}
        error={errors.email}
        onChange={(event) => {
          setEmail(event.target.value);
          clear("email");
        }}
        onBlur={() => {
          const invalid = validateEnquiryEmail(email);
          setClientErrors((current) => withField(current, "email", invalid ?? undefined));
        }}
      />
      <TextField
        id={fieldId("contactPhone")}
        label="Phone number (optional)"
        name="contactPhone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        maxLength={ENQUIRY_PHONE_MAX_LENGTH}
        value={phone}
        error={errors.contactPhone}
        onChange={(event) => {
          setPhone(event.target.value);
          clear("contactPhone");
        }}
      />
      <div className="flex flex-col gap-1">
        <Label htmlFor={fieldId("message")} className={LABEL_CLASS}>
          {messageRequired ? "Message" : "Message (optional)"}
        </Label>
        <Textarea
          id={fieldId("message")}
          name="message"
          variant="underline"
          className={cn(errors.message && "border-error")}
          rows={4}
          maxLength={messageMaxLength}
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            clear("message");
          }}
          {...fieldA11y(fieldId("message"), errors.message)}
        />
        <FieldError id={`${fieldId("message")}-error`} message={errors.message} />
      </div>
      <div className="sr-only" aria-hidden="true">
        {/* Honeypot: people never reach this field, bots fill it. */}
        <Label htmlFor={`${formId}-website`}>Website</Label>
        <Input id={`${formId}-website`} name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {notice}
      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="min-h-11 w-full font-label uppercase tracking-wide"
      >
        {pending ? "Sending…" : "Send enquiry"}
      </Button>
      <p className="text-sm leading-5 text-on-surface-variant">
        We will never pass your personal information to anyone outside LAX for their own marketing
        purposes without your consent. See our{" "}
        <Link
          href="/legal/privacy"
          className="art-focus-ring rounded-sm font-medium text-on-surface underline underline-offset-2"
        >
          privacy policy
        </Link>
        .
      </p>
    </form>
  );
}
