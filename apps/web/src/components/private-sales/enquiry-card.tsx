"use client";

import {
  loadEnquirerOrganisations,
  startEnquiryDraft,
  submitPrivateSaleEnquiry,
} from "@/app/(marketing)/sell/private-sales/actions";
import { useAppSession } from "@/lib/auth/use-app-session";
import { SITE_CONTACT_EMAIL } from "@/lib/brand";
import { submitFailureCopy } from "@/lib/forms/error-copy";
import { lazyResolver, lazyResolverFailure } from "@/lib/forms/lazy-resolver";
import { useFormErrorSummary } from "@/lib/forms/use-form-error-summary";
import {
  type EnquirerOrganisation,
  enquiringAsChoices,
  resolveChoice,
} from "@/lib/private-sales/enquiring-as";
import { submitButtonState } from "@/lib/private-sales/enquiry-uploads";
import {
  ENQUIRY_PATH_OPTIONS,
  type EnquiryFormValues,
  type EnquiryPath,
  emptyEnquiryValues,
} from "@/lib/private-sales/enquiry-values";
import { Button } from "@auction/ui/lax/button";
import { ErrorSummary } from "@auction/ui/lax/error-summary";
import { Notice } from "@auction/ui/lax/notice";
import { SegmentedControl } from "@auction/ui/lax/tabs";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { EnquiringAsCard } from "./enquiring-as-card";
import { EnquiryConfidentiality } from "./enquiry-confidentiality";
import {
  BuyFields,
  ContactPreferenceField,
  FIELD_IDS,
  GuestContactFields,
  PhoneField,
  SellFields,
} from "./enquiry-sections";
import { EnquirySent, type SentReceipt } from "./enquiry-sent";
import { EnquiryUploadField } from "./enquiry-upload-field";
import { useEnquiryUploads } from "./use-enquiry-uploads";

type Props = {
  initialPath: EnquiryPath;
  /** Starts a fresh form once the sent state is showing. */
  onAnother: (lastPath: EnquiryPath) => void;
};

async function draftToken(): Promise<string | null> {
  const result = await startEnquiryDraft();
  return result.ok && result.data ? result.data.draftToken : null;
}

/** Keeps the address in step with the path, so the page can be shared on either. */
const enquiryFormResolver = lazyResolver<EnquiryFormValues>(
  () => import("./enquiry-card.validation").then((m) => m.enquiryFormResolver),
  { failureMessage: submitFailureCopy.title },
);

function rememberPath(path: EnquiryPath) {
  const url = new URL(window.location.href);
  url.searchParams.set("path", path);
  window.history.replaceState(window.history.state, "", url);
}

/**
 * The private sale enquiry: a switch between selling and buying, one short form for each, and the
 * sent state in its place. Photos upload as they are chosen; the button waits for any still being
 * checked. A signed-in sender is shown who they enquire as instead of retyping it.
 */
export function EnquiryCard({ initialPath, onAnother }: Props) {
  const { user } = useAppSession();
  const isStaff = user?.role === "staff";
  const signedIn = Boolean(user) && !isStaff;

  const [path, setPath] = useState<EnquiryPath>(initialPath);
  const [organisations, setOrganisations] = useState<EnquirerOrganisation[]>([]);
  const [choiceId, setChoiceId] = useState("self");
  const [phase, setPhase] = useState<"editing" | "queued" | "sending" | "sent">("editing");
  const [failure, setFailure] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<SentReceipt | null>(null);
  const queued = useRef<EnquiryFormValues | null>(null);

  const form = useForm<EnquiryFormValues>({
    resolver: enquiryFormResolver,
    defaultValues: emptyEnquiryValues(initialPath),
    reValidateMode: "onBlur",
    shouldFocusError: false,
  });
  const uploads = useEnquiryUploads({ signedIn, startDraft: draftToken });
  const summary = useFormErrorSummary(form, FIELD_IDS[path]);

  // Who is asking comes from LAX Account for a signed-in sender.
  useEffect(() => {
    if (!user || isStaff) return;
    form.setValue("name", user.name?.trim() || user.email);
    form.setValue("email", user.email);
    const phone = user.mobileDisplay ?? user.phoneNumber ?? user.mobile ?? "";
    if (phone && !form.getValues("phone")) form.setValue("phone", phone);
  }, [user, isStaff, form]);

  useEffect(() => {
    if (!signedIn) return;
    let current = true;
    void loadEnquirerOrganisations().then((list) => current && setOrganisations(list));
    return () => {
      current = false;
    };
  }, [signedIn]);

  const choices = enquiringAsChoices(path, organisations);
  const choice = resolveChoice(path, organisations, choiceId);

  const changePath = (next: EnquiryPath) => {
    setPath(next);
    form.setValue("path", next);
    form.clearErrors();
    rememberPath(next);
  };

  const send = useCallback(
    async (values: EnquiryFormValues) => {
      setPhase("sending");
      setFailure(null);
      const result = await submitPrivateSaleEnquiry(values, {
        uploadIds: values.path === "sell" ? uploads.uploadIds : [],
        draftToken: uploads.draftToken ?? undefined,
        legalEntityId: choice.legalEntityId,
      });
      if (result.ok && result.data) {
        setReceipt({
          ...result.data,
          path: values.path,
          email: values.email,
          departmentSlug: values.departmentSlug,
        });
        setPhase("sent");
        return;
      }
      setFailure(result.ok ? submitFailureCopy.title : result.error);
      setPhase("editing");
    },
    [uploads.uploadIds, uploads.draftToken, choice.legalEntityId],
  );

  // The form's check could not be fetched: the same notice as a failed send.
  const shownFailure = failure ?? lazyResolverFailure(form.formState.errors);
  const pendingFiles = uploads.items.filter((item) => item.state === "uploading").length;

  // A send that was asked for while files were still being checked goes when the last one is.
  useEffect(() => {
    if (phase !== "queued" || pendingFiles > 0 || !queued.current) return;
    const values = queued.current;
    queued.current = null;
    void send(values);
  }, [phase, pendingFiles, send]);

  const onSubmit = form.handleSubmit((values) => {
    if (pendingFiles > 0) {
      queued.current = values;
      setPhase("queued");
      return;
    }
    void send(values);
  });

  if (phase === "sent" && receipt) {
    return <EnquirySent receipt={receipt} onAnother={() => onAnother(receipt.path)} />;
  }

  const button = submitButtonState(uploads.items, phase === "sending");
  const busy = phase === "sending" || phase === "queued";
  const phoneNeeded = form.watch("contactPreference") !== "email";

  return (
    <div
      id="enquiry"
      className="scroll-mt-28 rounded-lax-card border border-lax-line bg-lax-surface p-4 shadow-lax-xs sm:p-6"
    >
      <h2 className="m-0 font-lax text-lax-18 font-semibold leading-7 text-lax-fg">
        Tell us about it
      </h2>
      <p className="m-0 mt-1 mb-4 text-lax-13 text-lax-muted">
        A specialist replies within two business days.
      </p>
      <SegmentedControl
        label="What would you like to do?"
        size="md"
        value={path}
        onValueChange={changePath}
        options={ENQUIRY_PATH_OPTIONS}
        className="mb-5 flex w-full [&>*]:flex-1"
      />

      {isStaff ? (
        <Notice tone="info" title="Staff accounts can't send enquiries">
          Private sale enquiries come from clients. Sign in with a client account to send one.
        </Notice>
      ) : (
        <form
          onFocus={enquiryFormResolver.preload}
          onSubmit={onSubmit}
          noValidate
          aria-label={path === "sell" ? "Sell privately enquiry" : "Buy privately enquiry"}
          className="flex flex-col gap-5"
        >
          <ErrorSummary errors={summary.errors} focusKey={summary.focusKey} />
          {shownFailure ? (
            <Notice tone="danger" alert title={submitFailureCopy.title}>
              {shownFailure === submitFailureCopy.title
                ? submitFailureCopy.detail(SITE_CONTACT_EMAIL)
                : `${shownFailure} Your answers are still here.`}
            </Notice>
          ) : null}
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            className="hidden"
            {...form.register("website")}
          />

          {signedIn && user ? (
            <EnquiringAsCard
              name={form.watch("name") || user.name}
              email={user.email}
              choices={choices}
              choiceId={choice.id}
              onChoose={setChoiceId}
            />
          ) : null}

          {path === "sell" ? <SellFields form={form} /> : <BuyFields form={form} />}

          {path === "sell" ? (
            <EnquiryUploadField
              items={uploads.items}
              onFiles={uploads.addFiles}
              onRemove={uploads.remove}
            />
          ) : null}

          {signedIn ? null : <GuestContactFields form={form} />}
          <ContactPreferenceField form={form} />
          {signedIn && !phoneNeeded ? null : <PhoneField form={form} />}

          <EnquiryConfidentiality form={form} />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            loading={busy}
            aria-disabled={busy || undefined}
          >
            {button.label}
          </Button>
        </form>
      )}
    </div>
  );
}
